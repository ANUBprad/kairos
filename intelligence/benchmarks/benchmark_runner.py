from __future__ import annotations

from typing import Dict, List, Optional

from benchmarks.dataset.loader import QueryEntry
from benchmarks.runner import BenchmarkRunner as CoreRunner
from benchmarks.runner import RunnerResult

from intelligence.benchmarks.benchmark_result import BenchmarkResult
from intelligence.benchmarks.dataset_registry import DatasetRegistry
from intelligence.experiments.tracker import ExperimentTracker
from intelligence.experiments.models import ExperimentParameters
from intelligence.statistics.reporting import generate_validation_report


class BenchmarkRunner:
    """High-level runner for multi-dataset benchmark evaluation.

    Wraps the core :class:`~benchmarks.runner.BenchmarkRunner` to support
    running against multiple datasets, aggregating results, and optionally
    tracking experiments and computing statistical validation.

    Example::

        runner = BenchmarkRunner(classifier=clf, retriever=retriever)
        results = runner.run_multiple_datasets(registry, names=["hotpotqa-dev"])
        summary = aggregate_results(results)
    """

    def __init__(
        self,
        classifier: object,
        retriever: object,
        planner: Optional[object] = None,
        tracker: Optional[ExperimentTracker] = None,
    ):
        self._classifier = classifier
        self._retriever = retriever
        self._planner = planner
        self._tracker = tracker

    def run_single_dataset(
        self,
        entries: List[QueryEntry],
        dataset_name: str = "unknown",
        run_name: str = "",
        include_validation: bool = True,
    ) -> BenchmarkResult:
        """Run the benchmark against a single dataset's entries.

        Args:
            entries:            Query entries to evaluate.
            dataset_name:       Name for the dataset (used in result).
            run_name:           Name for the experiment run (if tracking).
            include_validation: Whether to compute a ValidationResult.

        Returns:
            A :class:`BenchmarkResult` with computed metrics.

        Raises:
            ValueError: If *entries* is empty.
        """
        if not entries:
            raise ValueError("Cannot run benchmark on empty entries")

        core_runner = CoreRunner(
            classifier=self._classifier,
            retriever=self._retriever,
            planner=self._planner,
        )
        runner_result = core_runner.run_all(entries)

        result = self._result_from_runner(runner_result, dataset_name)
        if include_validation:
            result.validation = self._compute_validation(result, dataset_name)

        # -- Optional experiment tracking --
        if self._tracker is not None:
            self._track_run(runner_result, dataset_name, run_name)

        return result

    def run_multiple_datasets(
        self,
        registry: DatasetRegistry,
        dataset_names: Optional[List[str]] = None,
        include_validation: bool = True,
    ) -> List[BenchmarkResult]:
        """Run benchmark against multiple datasets from a registry.

        Args:
            registry:           Dataset registry with pre-registered entries.
            dataset_names:      Subset of datasets to run (``None`` = all).
            include_validation: Whether to compute validation results.

        Returns:
            List of :class:`BenchmarkResult` objects, one per dataset.
        """
        names = (
            dataset_names
            if dataset_names is not None
            else registry.dataset_names()
        )
        results: List[BenchmarkResult] = []
        for name in names:
            entries = registry.get_entries(name)
            if entries is None:
                continue
            res = self.run_single_dataset(
                entries=entries,
                dataset_name=name,
                run_name=name,
                include_validation=include_validation,
            )
            results.append(res)
        return results

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _result_from_runner(
        self,
        result: RunnerResult,
        dataset_name: str,
    ) -> BenchmarkResult:
        n = result.total_queries
        failures = result.aggregated_failures()
        avg_lat = result.average_latency()

        per_recall = [
            float(r.recall) for r in result.results if r.recall is not None
        ]
        per_precision = [
            float(r.precision) for r in result.results
            if r.precision is not None
        ]
        per_latency = [r.latency.total * 1000.0 for r in result.results]

        return BenchmarkResult(
            dataset_name=dataset_name,
            query_count=n,
            metrics={
                "total_queries": n,
                "average_recall": result.average_recall(),
                "average_precision": result.average_precision(),
                "average_latency_ms": avg_lat.total * 1000.0,
                "fallback_count": failures.planner_fallback,
                "timeout_count": failures.timeout,
                "empty_retrieval_count": failures.empty_retrieval,
            },
            per_query_recall=per_recall,
            per_query_precision=per_precision,
            per_query_latency_ms=per_latency,
        )

    def _compute_validation(
        self,
        result: BenchmarkResult,
        dataset_name: str,
    ) -> Optional["ValidationResult"]:
        if len(result.per_query_recall) < 2:
            return None
        dummy = [0.0] * len(result.per_query_recall)
        try:
            return generate_validation_report(
                baseline=dummy,
                treatment=result.per_query_recall,
                metric_name="recall",
                baseline_label="zero",
                treatment_label=dataset_name,
                include_bootstrap=False,
                include_permutation=False,
                random_seed=42,
            )
        except Exception:
            return None

    def _track_run(
        self,
        runner_result: RunnerResult,
        dataset_name: str,
        run_name: str,
    ) -> None:
        if self._tracker is None:
            return
        types = sorted(
            set(r.entry.query_type for r in runner_result.results)
        )
        exp_params = ExperimentParameters(
            dataset_name=dataset_name,
            query_types=",".join(types),
        )
        with self._tracker.start_run(
            name=run_name or f"benchmark-{dataset_name}",
            phase="benchmark",
            parameters=exp_params,
        ) as run:
            self._tracker.log_metrics_from_result(runner_result)
