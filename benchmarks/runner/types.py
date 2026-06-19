"""Domain types for benchmark results.

A :class:`QueryResult` captures everything that happened during a single
query execution.  Multiple query results are bundled into a
:class:`RunnerResult` for aggregate analysis.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

from benchmarks.dataset.loader import QueryEntry
from benchmarks.metrics import FailureRecord, LatencyRecord, recall_at_k, precision_at_k
from intelligence.planner import PlannerDecision


@dataclass(frozen=True)
class QueryResult:
    """Outcome of executing one benchmark query.

    Attributes:
        entry:             The query entry from the dataset.
        planner_decision:  Config, confidence, and query type chosen
                           by the retrieval planner.
        retrieved_chunks:  Chunks returned by the retriever.
        latency:           Wall-clock breakdown for each pipeline phase.
        failures:          Failure events observed during this query.
        recall:            Retrieval Recall@k (``None`` when *expected_chunks*
                           is not available on the entry).
        precision:         Retrieval Precision@k (``None`` when
                           *expected_chunks* is not available on the entry).
    """

    entry: QueryEntry
    planner_decision: PlannerDecision
    retrieved_chunks: Tuple[str, ...]
    latency: LatencyRecord
    failures: FailureRecord
    recall: Optional[float] = None
    precision: Optional[float] = None


@dataclass(frozen=True)
class RunnerResult:
    """Aggregate results across a full benchmark run.

    Attributes:
        results:     Per-query results in execution order.
    """

    results: Tuple[QueryResult, ...]

    # ------------------------------------------------------------------
    # Computed properties
    # ------------------------------------------------------------------

    @property
    def total_queries(self) -> int:
        """Total number of queries executed."""
        return len(self.results)

    def aggregated_failures(self) -> FailureRecord:
        """Sum of failures across all queries."""
        from benchmarks.metrics import merge_records

        return merge_records([r.failures for r in self.results])

    def aggregated_latency(self) -> LatencyRecord:
        """Sum of all phase latencies across queries."""
        return LatencyRecord(
            classify=sum(r.latency.classify for r in self.results),
            planning=sum(r.latency.planning for r in self.results),
            retrieval=sum(r.latency.retrieval for r in self.results),
            generation=sum(r.latency.generation for r in self.results),
            total=sum(r.latency.total for r in self.results),
        )

    def average_latency(self) -> LatencyRecord:
        """Mean latency per query for each phase."""
        n = self.total_queries
        if n == 0:
            return LatencyRecord()
        return LatencyRecord(
            classify=self.aggregated_latency().classify / n,
            planning=self.aggregated_latency().planning / n,
            retrieval=self.aggregated_latency().retrieval / n,
            generation=self.aggregated_latency().generation / n,
            total=self.aggregated_latency().total / n,
        )

    def average_recall(self) -> Optional[float]:
        """Mean recall across queries that have ground truth.

        Returns ``None`` when no query has *expected_chunks*.
        """
        scores = [r.recall for r in self.results if r.recall is not None]
        if not scores:
            return None
        return sum(scores) / len(scores)

    def average_precision(self) -> Optional[float]:
        """Mean precision across queries that have ground truth.

        Returns ``None`` when no query has *expected_chunks*.
        """
        scores = [r.precision for r in self.results if r.precision is not None]
        if not scores:
            return None
        return sum(scores) / len(scores)

    def per_type_recall(self) -> Dict[str, Optional[float]]:
        """Mean recall grouped by query type."""
        return self._per_type_metric("recall")

    def per_type_precision(self) -> Dict[str, Optional[float]]:
        """Mean precision grouped by query type."""
        return self._per_type_metric("precision")

    def per_type_latency(self) -> Dict[str, LatencyRecord]:
        """Sum of latencies grouped by query type."""
        from collections import defaultdict

        groups: Dict[str, List[LatencyRecord]] = defaultdict(list)
        for r in self.results:
            groups[r.entry.query_type].append(r.latency)

        result: Dict[str, LatencyRecord] = {}
        for qt, records in groups.items():
            result[qt] = LatencyRecord(
                classify=sum(x.classify for x in records),
                planning=sum(x.planning for x in records),
                retrieval=sum(x.retrieval for x in records),
                generation=sum(x.generation for x in records),
                total=sum(x.total for x in records),
            )
        return result

    def per_type_failures(self) -> Dict[str, FailureRecord]:
        """Aggregated failures grouped by query type."""
        from collections import defaultdict
        from benchmarks.metrics import merge_records

        groups: Dict[str, List[FailureRecord]] = defaultdict(list)
        for r in self.results:
            groups[r.entry.query_type].append(r.failures)

        return {qt: merge_records(recs) for qt, recs in groups.items()}

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _per_type_metric(self, attr: str) -> Dict[str, Optional[float]]:
        scores: Dict[str, List[float]] = {}
        for r in self.results:
            val = getattr(r, attr)
            if val is not None:
                scores.setdefault(r.entry.query_type, []).append(val)

        if not scores:
            return {}

        return {
            qt: sum(vals) / len(vals) for qt, vals in scores.items()
        }
