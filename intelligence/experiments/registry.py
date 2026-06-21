from __future__ import annotations

from typing import Dict, List, Optional

from intelligence.experiments.models import ExperimentMetrics, ExperimentRun, ExperimentStatus
from intelligence.experiments.persistence import ExperimentStore


class ExperimentRegistry:
    """Index of all recorded experiment runs.

    The registry wraps an :class:`ExperimentStore` for persistence and
    provides query, ranking, and filtering over the collected runs.

    Usage::

        registry = ExperimentRegistry()
        registry.register_run(run)
        best = registry.best_run(metric="recall")
        latest = registry.latest_run()
    """

    def __init__(self, store: Optional[ExperimentStore] = None):
        self._store = store or ExperimentStore()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def store(self) -> ExperimentStore:
        return self._store

    def register_run(self, run: ExperimentRun) -> str:
        """Persist *run* and return its run_id."""
        run_id = self._store.save_run(run)
        metadata = self._store.load_registry_metadata()
        all_ids = set(metadata.get("run_ids", []))
        all_ids.add(run_id)
        metadata["run_ids"] = sorted(all_ids)
        metadata["latest_run_id"] = run_id
        self._store.save_registry_metadata(metadata)
        return run_id

    def get_run(self, run_id: str) -> Optional[ExperimentRun]:
        """Retrieve a run by *run_id*."""
        return self._store.load_run(run_id)

    def list_runs(self) -> List[ExperimentRun]:
        """Return all registered runs, sorted by timestamp descending."""
        runs: List[ExperimentRun] = []
        for rid in self._store.list_run_ids():
            run = self._store.load_run(rid)
            if run is not None:
                runs.append(run)
        runs.sort(key=lambda r: r.timestamp, reverse=True)
        return runs

    def delete_run(self, run_id: str) -> bool:
        """Delete a run. Returns True if the run existed."""
        existed = self._store.delete_run(run_id)
        if existed:
            metadata = self._store.load_registry_metadata()
            all_ids = set(metadata.get("run_ids", []))
            all_ids.discard(run_id)
            metadata["run_ids"] = sorted(all_ids)
            self._store.save_registry_metadata(metadata)
        return existed

    def best_run(
        self,
        metric: str = "recall",
        phase: Optional[str] = None,
    ) -> Optional[ExperimentRun]:
        """Return the run with the highest *metric* value.

        Only considers completed runs. Optionally filter by *phase*.
        """
        best: Optional[ExperimentRun] = None
        best_val: float = float("-inf")
        for run in self.list_runs():
            if run.status != ExperimentStatus.COMPLETED:
                continue
            if phase is not None and run.phase != phase:
                continue
            val = _get_metric_value(run.metrics, metric)
            if val is not None and val > best_val:
                best_val = val
                best = run
        return best

    def latest_run(self, phase: Optional[str] = None) -> Optional[ExperimentRun]:
        """Return the most recent completed run, optionally for a *phase*."""
        for run in self.list_runs():
            if run.status != ExperimentStatus.COMPLETED:
                continue
            if phase is not None and run.phase != phase:
                continue
            return run
        return None

    def runs_by_tag(self, key: str, value: str) -> List[ExperimentRun]:
        """Return all runs with a specific tag key/value pair."""
        return [r for r in self.list_runs() if r.tags.get(key) == value]

    def runs_by_phase(self, phase: str) -> List[ExperimentRun]:
        """Return all runs for a given phase."""
        return [r for r in self.list_runs() if r.phase == phase]


def _get_metric_value(metrics: ExperimentMetrics, metric: str) -> Optional[float]:
    return {
        "precision": metrics.precision,
        "recall": metrics.recall,
        "latency_ms": metrics.latency_ms,
        "success_rate": metrics.success_rate,
        "fallback_rate": metrics.fallback_rate,
        "ece": metrics.ece,
        "mce": metrics.mce,
        "brier_score": metrics.brier_score,
        "score_lift": metrics.score_lift,
        "learned_avg_score": metrics.learned_avg_score,
        "static_avg_score": metrics.static_avg_score,
        "training_samples": metrics.training_samples,
    }.get(metric)
