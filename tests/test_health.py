from __future__ import annotations

from concurrent import futures

import grpc
import pytest

from intelligence.server.health import (
    HealthServicer,
    add_health_servicer_to_server,
    SERVING,
    NOT_SERVING,
    UNKNOWN,
)


class TestHealthServicer:
    def test_initial_global_is_serving(self) -> None:
        h = HealthServicer()
        assert h.is_serving() is True

    def test_set_global_not_serving(self) -> None:
        h = HealthServicer()
        h.set_global_not_serving()
        assert h.is_serving() is False

    def test_set_global_not_serving(self) -> None:
        h = HealthServicer()
        h.set_global_not_serving()
        assert h.is_serving() is False

    def test_set_global_serving_after_not_serving(self) -> None:
        h = HealthServicer()
        h.set_global_not_serving()
        h.set_global_serving()
        assert h.is_serving() is True

    def test_per_service_status(self) -> None:
        h = HealthServicer()
        h.set_serving("my_service")
        assert h.is_serving("my_service") is True
        h.set_not_serving("my_service")
        assert h.is_serving("my_service") is False

    def test_unknown_service_returns_not_serving(self) -> None:
        h = HealthServicer()
        assert h.is_serving("unknown_service") is False

    def test_global_not_serving_allows_per_service_serving(self) -> None:
        h = HealthServicer()
        h.set_global_not_serving()
        h.set_serving("svc")
        assert h.is_serving("svc") is True

    def test_add_readiness_listener(self) -> None:
        h = HealthServicer()
        calls: list[str] = []
        h.add_readiness_listener(lambda: calls.append("called"))
        assert len(h._on_readiness_change) == 1

    def test_set_twice_keeps_serving(self) -> None:
        h = HealthServicer()
        h.set_serving("x")
        h.set_serving("x")
        assert h.is_serving("x") is True

    def test_set_then_unset(self) -> None:
        h = HealthServicer()
        h.set_serving("x")
        h.set_not_serving("x")
        assert h.is_serving("x") is False


class TestHealthServicerGRPC:
    def test_check_via_grpc_returns_serving(self) -> None:
        from grpc_health.v1 import health_pb2, health_pb2_grpc
        h = HealthServicer()
        h.set_serving("test.Keiro")
        server = grpc.server(futures.ThreadPoolExecutor(max_workers=2))
        add_health_servicer_to_server(h, server)
        port = server.add_insecure_port("localhost:0")
        server.start()
        try:
            channel = grpc.insecure_channel(f"localhost:{port}")
            stub = health_pb2_grpc.HealthStub(channel)
            resp = stub.Check(health_pb2.HealthCheckRequest(service="test.Keiro"))
            assert resp.status == SERVING
            resp2 = stub.Check(health_pb2.HealthCheckRequest(service=""))
            assert resp2.status == SERVING
        finally:
            server.stop(0)


class TestHealthConfig:
    def test_health_check_enabled_default(self) -> None:
        from intelligence.server.config import ServerConfig
        cfg = ServerConfig.from_env()
        assert cfg.health_check_enabled is True

    def test_health_check_disabled_via_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KEIRO_HEALTH_CHECK_ENABLED", "False")
        from intelligence.server.config import ServerConfig
        cfg = ServerConfig.from_env()
        assert cfg.health_check_enabled is False
