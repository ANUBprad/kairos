from __future__ import annotations

import logging

import grpc
from prometheus_client import Counter, Gauge, Histogram, start_http_server

logger = logging.getLogger(__name__)

requests_total = Counter(
    "kairos_requests_total",
    "Total gRPC requests",
    labelnames=["method", "status"],
)

request_duration_seconds = Histogram(
    "kairos_request_duration_seconds",
    "gRPC request duration in seconds",
    labelnames=["method"],
    buckets=(0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

planner_decisions_total = Counter(
    "kairos_planner_decisions_total",
    "Planner decisions by query type and confidence band",
    labelnames=["query_type", "confidence_band"],
)

retrieval_duration_seconds = Histogram(
    "kairos_retrieval_duration_seconds",
    "Retrieval duration in seconds",
    labelnames=["retrieval_type"],
    buckets=(0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0),
)

fallback_total = Counter(
    "kairos_fallback_total",
    "Fallback events by escalated tier",
    labelnames=["escalated_tier"],
)

cache_hits_total = Counter(
    "kairos_cache_hits_total",
    "Cache hits by cache name",
    labelnames=["cache_name"],
)

cache_misses_total = Counter(
    "kairos_cache_misses_total",
    "Cache misses by cache name",
    labelnames=["cache_name"],
)

circuit_breaker_state = Gauge(
    "kairos_circuit_breaker_state",
    "Circuit breaker state (1=CLOSED, 2=HALF_OPEN, 3=OPEN)",
    labelnames=["breaker_name"],
)

health_status = Gauge(
    "kairos_health_status",
    "Health check status (1=SERVING, 0=NOT_SERVING)",
    labelnames=["service"],
)


def start_metrics_server(port: int = 8001) -> None:
    """Start an HTTP server exposing Prometheus metrics."""
    start_http_server(port)
    logger.info("Prometheus metrics server started on port %d", port)


class MetricsInterceptor(grpc.ServerInterceptor):
    """gRPC interceptor that records request count and duration metrics."""

    def intercept_service(self, continuation, handler_call_details):
        method = handler_call_details.method

        def wrapper(behavior, request_streaming, response_streaming):
            original = behavior
            if not response_streaming:

                def new_behavior(request, context):
                    with request_duration_seconds.labels(method=method).time():
                        try:
                            response = original(request, context)
                            requests_total.labels(method=method, status="ok").inc()
                            return response
                        except Exception:
                            requests_total.labels(method=method, status="error").inc()
                            raise

                return new_behavior
            return original

        return continuation(handler_call_details).unary_unary(
            wrapper(
                continuation(handler_call_details).unary_unary,
                False,
                False,
            )
        )
