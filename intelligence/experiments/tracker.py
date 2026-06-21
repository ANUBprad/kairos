from __future__ import annotations

from contextlib import contextmanager
from datetime import datetime
from typing import Any, Dict, Iterator, List, Optional

from intelligence.experiments.models import (
    ExperimentMetrics,
    ExperimentParameters,
    ExperimentRun,
    ExperimentStatus,
)
from intelligence.experiments.registry import ExperimentRegistry


class ExperimentTracker:
    """Context manager for recording experiment runs.

    Usage::

        tracker = ExperimentTracker(registry=registry)

        with tracker.start_run(
            name="ablation-baseline",
            phase="ablation",
            parameters=ExperimentParameters(planner_enabled=False),
        ) as run:
            result = runner.run(entries)
            tracker.log_metrics_from_result(result)
            # run is automatically finalized on exit
    """

    def __init__(
        self,
        registry: Optional[ExperimentRegistry] = None,
    ):
        self._registry = registry or ExperimentRegistry()
        self._current_run: Optional[ExperimentRun] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def registry(self) -> ExperimentRegistry:
        return self._registry

    @property
    def current_run(self) -> Optional[ExperimentRun]:
        return self._current_run

    @contextmanager
    def start_run(
        self,
        name: str = "",
        description: str = "",
        phase: str = "",
        parameters: Optional[ExperimentParameters] = None,
        tags: Optional[Dict[str, str]] = None,
    ) -> Iterator[ExperimentRun]:
        """Start a new experiment run as a context manager.

        The run is registered on entry and finalised (COMPLETED or FAILED)
        on exit.
        """
        run = ExperimentRun(
            name=name,
            description=description,
            phase=phase,
            status=ExperimentStatus.RUNNING,
            parameters=parameters or ExperimentParameters(),
            tags=tags or {},
        )
        self._registry.register_run(run)
        self._current_run = run

        try:
            yield run
            run.status = ExperimentStatus.COMPLETED
        except BaseException:
            run.status = ExperimentStatus.FAILED
            raise
        finally:
            self._registry.register_run(run)
            self._current_run = None

    def log_metric(self, key: str, value: float) -> None:
        """Log a single metric to the current run.

        Raises ``RuntimeError`` if no run is active.
        """
        self._require_active_run()
        _set_metric(self._current_run.metrics, key, value)  # type: ignore[union-attr]

    def log_metrics(self, metrics: Dict[str, Optional[float]]) -> None:
        """Log multiple metrics at once."""
        for key, value in metrics.items():
            if value is not None:
                self.log_metric(key, value)

    def log_parameter(self, key: str, value: str) -> None:
        """Log a single parameter to the active run. Raises if extra key
        conflicts with a known parameter field."""
        self._require_active_run()
        self._current_run.parameters.extra[key] = value  # type: ignore[union-attr]

    def log_parameters_from_dict(self, params: Dict[str, object]) -> None:
        """Log parameters from a dictionary, mapping known keys to the
        structured parameter fields and unknown keys to *extra*."""
        self._require_active_run()
        run = self._current_run
        for k, v in params.items():
            _set_parameter(run.parameters, k, v)  # type: ignore[union-attr]

    def log_artifact(self, path: str) -> None:
        """Record an artifact file path."""
        self._require_active_run()
        if path not in self._current_run.artifact_paths:  # type: ignore[union-attr]
            self._current_run.artifact_paths.append(path)  # type: ignore[union-attr]

    def log_metrics_from_result(self, result: Any) -> None:
        """Convenience: extract metrics from a ``RunnerResult``."""
        if hasattr(result, "average_recall"):
            rec = result.average_recall()
            if rec is not None:
                self.log_metric("avg_recall", rec)
        if hasattr(result, "average_precision"):
            prec = result.average_precision()
            if prec is not None:
                self.log_metric("avg_precision", prec)
        if hasattr(result, "average_latency"):
            lat = result.average_latency()
            self.log_metric("latency_ms", lat.total * 1000.0)
        if hasattr(result, "total_queries"):
            total = result.total_queries
            self.log_metric("total_queries", float(total))
            if total > 0 and hasattr(result, "aggregated_failures"):
                fails = result.aggregated_failures()
                success_rate = 1.0 - (
                    (fails.timeout + fails.empty_retrieval) / total
                )
                self.log_metric("success_rate", success_rate)
                self.log_metric("fallback_rate", fails.planner_fallback / total)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _require_active_run(self) -> None:
        if self._current_run is None:
            raise RuntimeError(
                "No active experiment run. Use tracker.start_run(...)"
            )


def _set_metric(metrics: ExperimentMetrics, key: str, value: float) -> None:
    mapping: Dict[str, str] = {
        "precision": "precision",
        "recall": "recall",
        "latency_ms": "latency_ms",
        "success_rate": "success_rate",
        "fallback_rate": "fallback_rate",
        "avg_recall": "avg_recall",
        "avg_precision": "avg_precision",
        "ece": "ece",
        "mce": "mce",
        "brier_score": "brier_score",
        "score_lift": "score_lift",
        "learned_avg_score": "learned_avg_score",
        "static_avg_score": "static_avg_score",
        "training_samples": "training_samples",
    }
    attr = mapping.get(key)
    if attr is not None:
        object.__setattr__(metrics, attr, value)
    else:
        metrics.extra[key] = value


def _set_parameter(params: ExperimentParameters, key: str, value: object) -> None:
    mapping: Dict[str, str] = {
        "planner_enabled": "planner_enabled",
        "calibration_enabled": "calibration_enabled",
        "feedback_enabled": "feedback_enabled",
        "optimization_enabled": "optimization_enabled",
        "dataset_name": "dataset_name",
        "dataset_version": "dataset_version",
        "query_types": "query_types",
        "classifier_name": "classifier_name",
        "retriever_name": "retriever_name",
        "failure_threshold": "failure_threshold",
        "recovery_timeout": "recovery_timeout",
        "calibrator_type": "calibrator_type",
        "optimizer_min_samples": "optimizer_min_samples",
        "provider_timeout_seconds": "provider_timeout_seconds",
    }
    attr = mapping.get(key)
    if attr is not None:
        if isinstance(value, bool):
            object.__setattr__(params, attr, value)
        elif isinstance(value, (int, float)):
            typed = type(getattr(params, attr))
            object.__setattr__(params, attr, typed(value))
        else:
            object.__setattr__(params, attr, str(value))
    else:
        params.extra[key] = str(value)
