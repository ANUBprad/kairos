"""Retrieval telemetry subsystem — record, store, and analyse retrieval behaviour."""

from intelligence.telemetry.analytics import (
    compute_average_latency,
    compute_confidence_distribution,
    compute_fallback_rate,
    compute_strategy_distribution,
    compute_success_rate,
)
from intelligence.telemetry.collector import TelemetryCollector
from intelligence.telemetry.models import RetrievalTelemetry
from intelligence.telemetry.storage import TelemetryStorage

__all__ = [
    "RetrievalTelemetry",
    "TelemetryCollector",
    "TelemetryStorage",
    "compute_strategy_distribution",
    "compute_confidence_distribution",
    "compute_fallback_rate",
    "compute_average_latency",
    "compute_success_rate",
]
