from __future__ import annotations

import logging
from typing import Callable

import grpc
from grpc_health.v1 import health_pb2, health_pb2_grpc
from grpc_health.v1.health import HealthServicer as _GrpcHealthServicer

logger = logging.getLogger(__name__)

SERVING = health_pb2.HealthCheckResponse.SERVING
NOT_SERVING = health_pb2.HealthCheckResponse.NOT_SERVING
UNKNOWN = health_pb2.HealthCheckResponse.UNKNOWN


class HealthServicer(_GrpcHealthServicer):
    """Production gRPC health check service with per-service status tracking."""

    def __init__(self) -> None:
        super().__init__()
        self._on_readiness_change: list[Callable[[], None]] = []

    def set_serving(self, service: str) -> None:
        super().set(service, SERVING)

    def set_not_serving(self, service: str) -> None:
        super().set(service, NOT_SERVING)

    def set_global_serving(self) -> None:
        super().set("", SERVING)

    def set_global_not_serving(self) -> None:
        super().set("", NOT_SERVING)

    def is_serving(self, service: str = "") -> bool:
        with self._lock:
            return self._server_status.get(service, UNKNOWN) == SERVING

    def add_readiness_listener(self, callback: Callable[[], None]) -> None:
        self._on_readiness_change.append(callback)


def add_health_servicer_to_server(servicer: HealthServicer, server: grpc.Server) -> None:
    health_pb2_grpc.add_HealthServicer_to_server(servicer, server)
