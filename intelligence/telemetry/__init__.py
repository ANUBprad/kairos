"""Retrieval telemetry subsystem — record, store, and analyse retrieval behaviour."""

from intelligence.telemetry.collector import TelemetryCollector
from intelligence.telemetry.models import RetrievalTelemetry
from intelligence.telemetry.storage import TelemetryStorage
from intelligence.telemetry.analytics import (
    compute_strategy_distribution,
    compute_confidence_distribution,
    compute_fallback_rate,
    compute_average_latency,
    compute_success_rate,
)

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
