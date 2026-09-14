"""Tests for gRPC service authentication at the Intelligence boundary.

Exercises the real ``AuthInterceptor`` against a live in-process gRPC server
so the interceptor — not a mock — is what decides accept/reject.
"""

from __future__ import annotations

from concurrent import futures

import grpc
import pytest
from grpc_health.v1 import health_pb2, health_pb2_grpc

from generated.python import rag_pb2, rag_pb2_grpc
from intelligence.server.auth import AuthInterceptor
from intelligence.server.health import HealthServicer

SECRET = "test-service-secret"


class RecordingServicer(rag_pb2_grpc.IntelligenceServiceServicer):
    """Minimal real servicer; fails the test if business logic runs after a denial."""

    def __init__(self) -> None:
        self.calls = 0

    def ComputeEmbeddings(self, request, context):
        self.calls += 1
        return rag_pb2.ComputeEmbeddingResponse(vector_embeddings=[1.0, 2.0])


def _start_server(secret: str | None) -> dict:
    servicer = RecordingServicer()
    health = HealthServicer()
    health.set_global_serving()

    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=4),
        interceptors=[AuthInterceptor(secret)],
    )
    rag_pb2_grpc.add_IntelligenceServiceServicer_to_server(servicer, server)
    health_pb2_grpc.add_HealthServicer_to_server(health, server)
    port = server.add_insecure_port("localhost:0")
    server.start()
    channel = grpc.insecure_channel(f"localhost:{port}")
    return {
        "server": server,
        "channel": channel,
        "stub": rag_pb2_grpc.IntelligenceServiceStub(channel),
        "health": health_pb2_grpc.HealthStub(channel),
        "servicer": servicer,
    }


@pytest.fixture
def grpc_server():
    ctx = _start_server(SECRET)
    try:
        yield ctx
    finally:
        ctx["server"].stop(0)


def _with_metadata(
    key: str | None, extra: dict[str, str] | None = None
) -> list[tuple[str, str]]:
    meta: list[tuple[str, str]] = []
    if key is not None:
        meta.append(("x-api-key", key))
    if extra:
        meta.extend(extra.items())
    return meta


class TestProtectedRpc:
    def test_missing_credentials_rejected(self, grpc_server) -> None:
        with pytest.raises(grpc.RpcError) as exc:
            grpc_server["stub"].ComputeEmbeddings(
                rag_pb2.ComputeEmbeddingRequest(user_query="x"),
                metadata=_with_metadata(None),
            )
        assert exc.value.code() == grpc.StatusCode.UNAUTHENTICATED
        assert grpc_server["servicer"].calls == 0

    def test_malformed_credentials_rejected(self, grpc_server) -> None:
        with pytest.raises(grpc.RpcError) as exc:
            grpc_server["stub"].ComputeEmbeddings(
                rag_pb2.ComputeEmbeddingRequest(user_query="x"),
                metadata=_with_metadata(SECRET[:-3]),  # truncated credential
            )
        assert exc.value.code() == grpc.StatusCode.UNAUTHENTICATED
        assert grpc_server["servicer"].calls == 0

    def test_invalid_credentials_rejected(self, grpc_server) -> None:
        with pytest.raises(grpc.RpcError) as exc:
            grpc_server["stub"].ComputeEmbeddings(
                rag_pb2.ComputeEmbeddingRequest(user_query="x"),
                metadata=_with_metadata("wrong-secret"),
            )
        assert exc.value.code() == grpc.StatusCode.UNAUTHENTICATED
        assert grpc_server["servicer"].calls == 0

    def test_valid_credentials_accepted(self, grpc_server) -> None:
        resp = grpc_server["stub"].ComputeEmbeddings(
            rag_pb2.ComputeEmbeddingRequest(user_query="x"),
            metadata=_with_metadata(SECRET),
        )
        assert list(resp.vector_embeddings) == [1.0, 2.0]
        assert grpc_server["servicer"].calls == 1

    def test_forged_identity_metadata_cannot_authenticate(self, grpc_server) -> None:
        forged = {
            "x-user-id": "admin",
            "x-org-id": "org-root",
            "x-role": "OWNER",
        }
        with pytest.raises(grpc.RpcError) as exc:
            grpc_server["stub"].ComputeEmbeddings(
                rag_pb2.ComputeEmbeddingRequest(user_query="x"),
                metadata=_with_metadata(None, forged),
            )
        assert exc.value.code() == grpc.StatusCode.UNAUTHENTICATED
        assert grpc_server["servicer"].calls == 0

    def test_identity_metadata_with_valid_credential_changes_nothing(
        self, grpc_server
    ) -> None:
        resp = grpc_server["stub"].ComputeEmbeddings(
            rag_pb2.ComputeEmbeddingRequest(user_query="x"),
            metadata=_with_metadata(
                SECRET, {"x-user-id": "admin", "x-org-id": "org-root"}
            ),
        )
        assert list(resp.vector_embeddings) == [1.0, 2.0]

    def test_no_secret_configured_fails_closed(self) -> None:
        ctx = _start_server(None)
        try:
            with pytest.raises(grpc.RpcError) as exc:
                ctx["stub"].ComputeEmbeddings(
                    rag_pb2.ComputeEmbeddingRequest(user_query="x"),
                    metadata=_with_metadata("anything"),
                )
            assert exc.value.code() == grpc.StatusCode.UNAUTHENTICATED
            assert ctx["servicer"].calls == 0
        finally:
            ctx["server"].stop(0)


class TestPublicHealth:
    def test_health_check_stays_open_without_credentials(self, grpc_server) -> None:
        resp = grpc_server["health"].Check(health_pb2.HealthCheckRequest(service=""))
        assert resp.status == health_pb2.HealthCheckResponse.SERVING

    def test_health_watch_stays_open_without_credentials(self, grpc_server) -> None:
        for resp in grpc_server["health"].Watch(
            health_pb2.HealthCheckRequest(service="")
        ):
            assert resp.status == health_pb2.HealthCheckResponse.SERVING
            break


class TestConfigWiring:
    def test_server_config_reads_grpc_secret(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("KAIROS_SECRET", SECRET)
        from intelligence.server.config import ServerConfig

        assert ServerConfig.from_env().grpc_secret == SECRET

    def test_server_config_defaults_to_none(self) -> None:
        from intelligence.server.config import ServerConfig

        assert ServerConfig().grpc_secret is None
