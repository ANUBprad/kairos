"""Kairos evaluation metrics.

Modules
-------
recall       : Retrieval Recall@k
precision    : Retrieval Precision@k
latency      : Wall-clock latency tracking per pipeline phase
failure_rate : Failure event counting and rate computation
"""

from benchmarks.metrics.recall import recall_at_k
from benchmarks.metrics.precision import precision_at_k
from benchmarks.metrics.latency import LatencyRecord, LatencyTracker
from benchmarks.metrics.failure_rate import (
    FailureRecord,
    compute_failure_rates,
    merge_records,
)

__all__ = [
    "recall_at_k",
    "precision_at_k",
    "LatencyRecord",
    "LatencyTracker",
    "FailureRecord",
    "compute_failure_rates",
    "merge_records",
]
