"""Tests for the gRPC transport policy on the Intelligence boundary.

The credential in ``tests/test_grpc_auth.py`` proves *who* may call a protected
RPC. These tests prove *how* the call is carried: that plaintext is confined to
loopback (or refused outright in production), and that when TLS is configured a
plaintext client is rejected, an untrusted CA is rejected, and a hostname the
certificate does not cover is rejected.
"""

from __future__ import annotations

from concurrent import futures
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Sequence
from unittest.mock import patch
import ipaddress
import os

import grpc
import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID
from grpc_health.v1 import health, health_pb2, health_pb2_grpc

from intelligence.server.config import (
    ServerConfig,
    is_loopback_host,
    validate_grpc_transport,
)
from intelligence.server.grpc_server import _configure_transport


# ======================================================================
# Fixtures / helpers
# ======================================================================


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _write_self_signed(
    directory: Path,
    name: str,
    dns_names: Sequence[str] = ("localhost",),
    ip_addresses: Sequence[str] = ("127.0.0.1",),
) -> tuple[Path, Path]:
    """Write a self-signed certificate/key pair usable as a gRPC server identity."""
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    common_name = name
    subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, common_name)])

    san = [x509.DNSName(dns) for dns in dns_names] + [
        x509.IPAddress(ipaddress.ip_address(ip)) for ip in ip_addresses
    ]

    certificate = (
        x509.CertificateBuilder()
        .subject_name(subject)
        .issuer_name(subject)
        .public_key(key.public_key())
        .serial_number(x509.random_serial_number())
        .not_valid_before(_utcnow() - timedelta(days=1))
        .not_valid_after(_utcnow() + timedelta(days=1))
        .add_extension(x509.SubjectAlternativeName(san), critical=False)
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .sign(key, hashes.SHA256())
    )

    cert_path = directory / f"{name}.crt"
    key_path = directory / f"{name}.key"
    cert_path.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
    key_path.write_bytes(
        key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.TraditionalOpenSSL,
            encryption_algorithm=serialization.NoEncryption(),
        )
    )
    return cert_path, key_path


def _cfg(**overrides) -> ServerConfig:
    base = {"environment": "development", "grpc_bind_host": "127.0.0.1"}
    base.update(overrides)
    return ServerConfig(**base)


def _start_server(cfg: ServerConfig) -> tuple[grpc.Server, int]:
    """Start a real gRPC server bound through the production transport code."""
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
    health_servicer = health.HealthServicer()
    health_servicer.set("", health_pb2.HealthCheckResponse.SERVING)
    health_pb2_grpc.add_HealthServicer_to_server(health_servicer, server)

    port = _configure_transport(server, cfg)
    assert port != 0, "transport did not bind a port"
    server.start()
    return server, port


# ======================================================================
# Transport policy
# ======================================================================


class TestLoopbackDetection:
    @pytest.mark.parametrize(
        "host", ["127.0.0.1", "127.0.0.2", "localhost", "LOCALHOST", "::1"]
    )
    def test_loopback_hosts(self, host: str) -> None:
        assert is_loopback_host(host) is True

    @pytest.mark.parametrize("host", ["0.0.0.0", "10.0.0.5", "intelligence", "::", ""])
    def test_non_loopback_hosts(self, host: str) -> None:
        # An unset bind host is not treated as loopback: production must refuse
        # to serve plaintext rather than guess.
        assert is_loopback_host(host) is False


class TestValidateGrpcTransport:
    def test_loopback_default_is_plaintext_safe(self) -> None:
        assert validate_grpc_transport(_cfg()) == []

    def test_development_allows_plaintext_on_a_private_network(self) -> None:
        assert validate_grpc_transport(_cfg(grpc_bind_host="0.0.0.0")) == []

    def test_production_allows_plaintext_on_loopback(self) -> None:
        assert (
            validate_grpc_transport(
                _cfg(environment="production", grpc_bind_host="127.0.0.1")
            )
            == []
        )

    def test_production_refuses_plaintext_on_non_loopback(self) -> None:
        errors = validate_grpc_transport(
            _cfg(environment="production", grpc_bind_host="0.0.0.0")
        )
        assert len(errors) == 1
        assert "plaintext" in errors[0]
        assert "KAIROS_GRPC_TLS_CERT" in errors[0]

    def test_production_refuses_plaintext_on_a_hostname(self) -> None:
        errors = validate_grpc_transport(
            _cfg(environment="production", grpc_bind_host="intelligence")
        )
        assert len(errors) == 1

    def test_production_allows_tls_on_non_loopback(self, tmp_path: Path) -> None:
        cert, key = _write_self_signed(tmp_path, "server")
        assert (
            validate_grpc_transport(
                _cfg(
                    environment="production",
                    grpc_bind_host="0.0.0.0",
                    grpc_tls_cert=str(cert),
                    grpc_tls_key=str(key),
                )
            )
            == []
        )

    @pytest.mark.parametrize(
        "certs,keys",
        [("/tmp/server.crt", None), (None, "/tmp/server.key")],
    )
    def test_half_configured_tls_is_rejected(self, certs, keys) -> None:
        errors = validate_grpc_transport(_cfg(grpc_tls_cert=certs, grpc_tls_key=keys))
        assert len(errors) == 1
        assert "must be set together" in errors[0]


class TestTransportConfigWiring:
    def test_binds_loopback_by_default(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.delenv("KAIROS_GRPC_BIND_HOST", raising=False)
        monkeypatch.delenv("INTELLIGENCE_HOST", raising=False)
        assert ServerConfig.from_env().grpc_bind_host == "127.0.0.1"

    def test_reads_bind_host_and_tls_material(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("KAIROS_GRPC_BIND_HOST", "0.0.0.0")
        monkeypatch.setenv("KAIROS_GRPC_TLS_CERT", "/run/secrets/int.crt")
        monkeypatch.setenv("KAIROS_GRPC_TLS_KEY", "/run/secrets/int.key")
        monkeypatch.setenv("KAIROS_GRPC_TLS_CA", "/run/secrets/ca.crt")

        cfg = ServerConfig.from_env()
        assert cfg.grpc_bind_host == "0.0.0.0"
        assert cfg.grpc_tls_cert == "/run/secrets/int.crt"
        assert cfg.grpc_tls_key == "/run/secrets/int.key"
        assert cfg.grpc_tls_ca == "/run/secrets/ca.crt"

    def test_empty_tls_env_values_become_none(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("KAIROS_GRPC_TLS_CERT", "")
        monkeypatch.setenv("KAIROS_GRPC_TLS_KEY", "")
        monkeypatch.setenv("KAIROS_GRPC_TLS_CA", "")

        cfg = ServerConfig.from_env()
        assert cfg.grpc_tls_cert is None
        assert cfg.grpc_tls_key is None
        assert cfg.grpc_tls_ca is None
        assert validate_grpc_transport(cfg) == []

    def test_reads_environment(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KAIROS_ENVIRONMENT", "production")
        assert ServerConfig.from_env().environment == "production"


class TestServeRejectsUnsafeTransport:
    def test_production_plaintext_non_loopback_stops_startup(self) -> None:
        """serve() must fail before creating any infrastructure.

        ``patch.dict`` rather than monkeypatch: ``serve()`` calls
        ``load_dotenv()``, which adds real environment variables that
        monkeypatch would not undo, leaking them into later tests.
        """
        overrides = {
            "KAIROS_ENVIRONMENT": "production",
            "KAIROS_GRPC_BIND_HOST": "0.0.0.0",
            "KAIROS_GRPC_TLS_CERT": "",
            "KAIROS_GRPC_TLS_KEY": "",
            "KAIROS_LLM_PROVIDER": "gemini",
            "GEMINI_API_KEY": "test-key",
            "KAIROS_GEMINI_MODEL_NAME": "gemini-2.0-flash",
        }
        with patch.dict(os.environ, overrides):
            from intelligence.server.grpc_server import serve

            with pytest.raises(
                ValueError, match="invalid gRPC transport configuration"
            ):
                serve()


# ======================================================================
# TLS handshake against a real server
# ======================================================================


class TestTlsTransport:
    def test_ca_signed_by_the_server_certificate_is_accepted(
        self, tmp_path: Path
    ) -> None:
        cert, key = _write_self_signed(tmp_path, "server")
        cfg = _cfg(grpc_tls_cert=str(cert), grpc_tls_key=str(key))

        server, port = _start_server(cfg)
        try:
            channel = grpc.secure_channel(
                f"localhost:{port}",
                grpc.ssl_channel_credentials(root_certificates=cert.read_bytes()),
            )
            response = health_pb2_grpc.HealthStub(channel).Check(
                health_pb2.HealthCheckRequest(), timeout=5
            )
            assert response.status == health_pb2.HealthCheckResponse.SERVING
        finally:
            server.stop(0)

    def test_untrusted_ca_is_rejected(self, tmp_path: Path) -> None:
        cert, key = _write_self_signed(tmp_path, "server")
        other_cert, _ = _write_self_signed(tmp_path, "other")
        cfg = _cfg(grpc_tls_cert=str(cert), grpc_tls_key=str(key))

        server, port = _start_server(cfg)
        try:
            channel = grpc.secure_channel(
                f"localhost:{port}",
                grpc.ssl_channel_credentials(root_certificates=other_cert.read_bytes()),
            )
            with pytest.raises(grpc.RpcError):
                health_pb2_grpc.HealthStub(channel).Check(
                    health_pb2.HealthCheckRequest(), timeout=5
                )
        finally:
            server.stop(0)

    def test_hostname_not_covered_by_the_certificate_is_rejected(
        self, tmp_path: Path
    ) -> None:
        cert, key = _write_self_signed(tmp_path, "server", dns_names=("localhost",))
        cfg = _cfg(grpc_tls_cert=str(cert), grpc_tls_key=str(key))

        server, port = _start_server(cfg)
        try:
            channel = grpc.secure_channel(
                f"localhost:{port}",
                grpc.ssl_channel_credentials(root_certificates=cert.read_bytes()),
                options=(("grpc.ssl_target_name_override", "wrong.example"),),
            )
            with pytest.raises(grpc.RpcError):
                health_pb2_grpc.HealthStub(channel).Check(
                    health_pb2.HealthCheckRequest(), timeout=5
                )
        finally:
            server.stop(0)

    def test_plaintext_client_cannot_reach_a_tls_server(self, tmp_path: Path) -> None:
        cert, key = _write_self_signed(tmp_path, "server")
        cfg = _cfg(grpc_tls_cert=str(cert), grpc_tls_key=str(key))

        server, port = _start_server(cfg)
        try:
            channel = grpc.insecure_channel(f"localhost:{port}")
            with pytest.raises(grpc.RpcError):
                health_pb2_grpc.HealthStub(channel).Check(
                    health_pb2.HealthCheckRequest(), timeout=5
                )
        finally:
            server.stop(0)

    def test_tls_client_cannot_reach_a_plaintext_server(self, tmp_path: Path) -> None:
        cert, _ = _write_self_signed(tmp_path, "server")
        server, port = _start_server(_cfg())
        try:
            channel = grpc.secure_channel(
                f"localhost:{port}",
                grpc.ssl_channel_credentials(root_certificates=cert.read_bytes()),
            )
            with pytest.raises(grpc.RpcError):
                health_pb2_grpc.HealthStub(channel).Check(
                    health_pb2.HealthCheckRequest(), timeout=5
                )
        finally:
            server.stop(0)
