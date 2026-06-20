from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from intelligence.metrics.prometheus_metrics import (
    requests_total,
    request_duration_seconds,
    planner_decisions_total,
    retrieval_duration_seconds,
    fallback_total,
    cache_hits_total,
    cache_misses_total,
    circuit_breaker_state,
    health_status,
    start_metrics_server,
    MetricsInterceptor,
)


class TestMetricsDefinitions:
    def test_requests_total_counter(self) -> None:
        requests_total.labels(method="ClassifyQueryType", status="ok").inc()
        assert (
            requests_total.labels(method="ClassifyQueryType", status="ok")._value.get()
            >= 1
        )

    def test_planner_decisions_counter(self) -> None:
        planner_decisions_total.labels(query_type="complex", confidence_band="low").inc(2)
        sample = planner_decisions_total.labels(
            query_type="complex", confidence_band="low"
        )._value.get()
        assert sample >= 2

    def test_fallback_counter(self) -> None:
        fallback_total.labels(escalated_tier="multi_hop").inc()
        assert (
            fallback_total.labels(escalated_tier="multi_hop")._value.get() >= 1
        )

    def test_cache_hits_counter(self) -> None:
        cache_hits_total.labels(cache_name="embedding").inc(3)
        assert cache_hits_total.labels(cache_name="embedding")._value.get() >= 3

    def test_cache_misses_counter(self) -> None:
        cache_misses_total.labels(cache_name="embedding").inc()
        assert cache_misses_total.labels(cache_name="embedding")._value.get() >= 1

    def test_circuit_breaker_gauge(self) -> None:
        circuit_breaker_state.labels(breaker_name="llm_client").set(1)
        assert (
            circuit_breaker_state.labels(breaker_name="llm_client")._value.get() == 1
        )
        circuit_breaker_state.labels(breaker_name="llm_client").set(3)
        assert (
            circuit_breaker_state.labels(breaker_name="llm_client")._value.get() == 3
        )

    def test_health_status_gauge(self) -> None:
        health_status.labels(service="").set(1)
        assert health_status.labels(service="")._value.get() == 1
        health_status.labels(service="").set(0)
        assert health_status.labels(service="")._value.get() == 0

    def test_retrieval_duration_histogram(self) -> None:
        retrieval_duration_seconds.labels(retrieval_type="MULTI_VECTOR").observe(0.5)
        assert (
            retrieval_duration_seconds.labels(
                retrieval_type="MULTI_VECTOR"
            )._sum.get()
            >= 0.49
        )


class TestMetricsInterceptor:
    def test_interceptor_creates_wrapper(self) -> None:
        interceptor = MetricsInterceptor()
        assert interceptor is not None

    def test_interceptor_counts_requests(self) -> None:
        from grpc import _server, _interceptor

        handler = MagicMock()
        handler.unary_unary = MagicMock(return_value=lambda req, ctx: "ok")

        continuation = MagicMock(return_value=handler)
        call_details = MagicMock()
        call_details.method = "/keiro.v1.IntelligenceService/ExecuteRetrieval"

        interceptor = MetricsInterceptor()
        result = interceptor.intercept_service(continuation, call_details)
        assert result is not None


class TestStartMetricsServer:
    def test_start_metrics_server(self) -> None:
        with patch(
            "intelligence.metrics.prometheus_metrics.start_http_server"
        ) as mock_start:
            start_metrics_server(port=9999)
            mock_start.assert_called_once_with(9999)
