"""Expanded Prometheus metrics for Phase B observability."""

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

ingestion_parsing_seconds = Histogram(
    "kairos_ingestion_parsing_seconds",
    "Document parsing duration in seconds",
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 30.0),
)

ingestion_chunking_seconds = Histogram(
    "kairos_ingestion_chunking_seconds",
    "Chunking duration in seconds",
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 5.0),
)

ingestion_embedding_seconds = Histogram(
    "kairos_ingestion_embedding_seconds",
    "Embedding generation duration in seconds",
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 5.0, 30.0),
)

ingestion_indexing_seconds = Histogram(
    "kairos_ingestion_indexing_seconds",
    "Vector store indexing duration in seconds",
    buckets=(0.01, 0.05, 0.1, 0.5, 1.0, 5.0),
)

ingestion_total_seconds = Histogram(
    "kairos_ingestion_total_seconds",
    "Total ingestion pipeline duration in seconds",
    buckets=(0.1, 0.5, 1.0, 5.0, 10.0, 30.0, 60.0),
)

ingestion_chunk_count = Histogram(
    "kairos_ingestion_chunk_count",
    "Number of chunks produced per document",
    buckets=(1, 5, 10, 25, 50, 100, 250, 500),
)

ingestion_text_length = Histogram(
    "kairos_ingestion_text_length_chars",
    "Character count of parsed document text",
    buckets=(100, 1000, 5000, 10000, 50000, 100000, 500000),
)

bm25_query_duration_seconds = Histogram(
    "kairos_bm25_query_duration_seconds",
    "BM25 query duration in seconds",
    buckets=(0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25),
)

bm25_index_size = Gauge(
    "kairos_bm25_index_size",
    "Number of documents in BM25 index",
    labelnames=["namespace"],
)

retrieval_cache_hits_total = Counter(
    "kairos_retrieval_cache_hits_total",
    "Retrieval cache hits",
)

retrieval_cache_misses_total = Counter(
    "kairos_retrieval_cache_misses_total",
    "Retrieval cache misses",
)

retrieval_cache_size = Gauge(
    "kairos_retrieval_cache_size",
    "Current retrieval cache size",
)

active_connections = Gauge(
    "kairos_active_connections",
    "Number of active gRPC connections",
)

request_size_bytes = Histogram(
    "kairos_request_size_bytes",
    "Request payload size in bytes",
    buckets=(1024, 10240, 102400, 1048576, 10485760),
)

response_size_bytes = Histogram(
    "kairos_response_size_bytes",
    "Response payload size in bytes",
    buckets=(1024, 10240, 102400, 1048576, 10485760),
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
                    active_connections.inc()
                    try:
                        with request_duration_seconds.labels(method=method).time():
                            response = original(request, context)
                            requests_total.labels(method=method, status="ok").inc()
                            return response
                    except Exception:
                        requests_total.labels(method=method, status="error").inc()
                        raise
                    finally:
                        active_connections.dec()

                return new_behavior
            return original

        return continuation(handler_call_details).unary_unary(
            wrapper(
                continuation(handler_call_details).unary_unary,
                False,
                False,
            )
        )
