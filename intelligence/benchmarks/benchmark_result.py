from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from intelligence.statistics.reporting import ValidationResult


@dataclass
class BenchmarkResult:
    """Results from running a benchmark against a single dataset.

    Attributes:
        dataset_name:      Name of the dataset that was evaluated.
        query_count:       Number of queries executed.
        metrics:           Aggregate metrics dict.
        per_query_recall:  Per-query recall values (for statistical validation).
        per_query_precision: Per-query precision values.
        per_query_latency_ms:  Per-query latency values.
        metadata:          Arbitrary metadata about this run.
    """

    dataset_name: str
    query_count: int = 0
    metrics: Dict[str, object] = field(default_factory=dict)
    per_query_recall: List[float] = field(default_factory=list)
    per_query_precision: List[float] = field(default_factory=list)
    per_query_latency_ms: List[float] = field(default_factory=list)
    metadata: Dict[str, str] = field(default_factory=dict)
    validation: Optional["ValidationResult"] = None

    @property
    def average_recall(self) -> Optional[float]:
        if not self.per_query_recall:
            return None
        return sum(self.per_query_recall) / len(self.per_query_recall)

    @property
    def average_precision(self) -> Optional[float]:
        if not self.per_query_precision:
            return None
        return sum(self.per_query_precision) / len(self.per_query_precision)

    @property
    def average_latency_ms(self) -> float:
        if not self.per_query_latency_ms:
            return 0.0
        return sum(self.per_query_latency_ms) / len(self.per_query_latency_ms)

    @property
    def success_rate(self) -> float:
        total = self.query_count
        if total == 0:
            return 0.0
        failures = float(self.metrics.get("timeout_count", 0))
        failures += float(self.metrics.get("empty_retrieval_count", 0))
        return 1.0 - (failures / total)

    @property
    def fallback_rate(self) -> float:
        total = self.query_count
        if total == 0:
            return 0.0
        return float(self.metrics.get("fallback_count", 0)) / total


def aggregate_results(
    results: List[BenchmarkResult],
) -> Dict[str, object]:
    """Aggregate multiple BenchmarkResult objects into a summary dict.

    Args:
        results:  List of results from different datasets.

    Returns:
        Dict with keys:
            - ``dataset_count``: Number of datasets.
            - ``total_queries``: Sum of all queries.
            - ``average_recall``: Mean recall across datasets.
            - ``average_precision``: Mean precision across datasets.
            - ``average_latency_ms``: Mean latency across datasets.
            - ``average_success_rate``: Mean success rate.
            - ``average_fallback_rate``: Mean fallback rate.
    """
    n = len(results)
    if n == 0:
        return {
            "dataset_count": 0,
            "total_queries": 0,
            "average_recall": None,
            "average_precision": None,
            "average_latency_ms": 0.0,
            "average_success_rate": 0.0,
            "average_fallback_rate": 0.0,
        }

    recalls = [r.average_recall for r in results if r.average_recall is not None]
    precisions = [
        r.average_precision for r in results if r.average_precision is not None
    ]

    return {
        "dataset_count": n,
        "total_queries": sum(r.query_count for r in results),
        "average_recall": sum(recalls) / len(recalls) if recalls else None,
        "average_precision": sum(precisions) / len(precisions) if precisions else None,
        "average_latency_ms": sum(r.average_latency_ms for r in results) / n,
        "average_success_rate": sum(r.success_rate for r in results) / n,
        "average_fallback_rate": sum(r.fallback_rate for r in results) / n,
    }
