from __future__ import annotations

from typing import Any, Optional, Sequence

from benchmarks.dataset.loader import QueryEntry, load_dataset
from benchmarks.runner import BenchmarkRunner, RunnerResult

from intelligence.ablation.config import AblationConfig


class AblationRunner:
    """Orchestrates a benchmark run with a specific ablation configuration.

    The runner builds the right planner pipeline based on the
    :class:`AblationConfig` flags, executes all queries through a
    :class:`BenchmarkRunner`, and returns a :class:`RunnerResult`.

    Usage::

        runner = AblationRunner(config=ABLATION_CONFIGS["Full Treatment"],
                                classifier=my_clf, retriever=my_ret)
        result = runner.run(entries)
    """

    def __init__(
        self,
        config: AblationConfig,
        classifier: object,
        retriever: object,
        calibrator: Optional[object] = None,
        optimizer: Optional[object] = None,
        feedback_adjuster: Optional[object] = None,
        tracker: Optional[object] = None,
    ):
        self._config = config
        self._classifier = classifier
        self._retriever = retriever
        self._calibrator = calibrator
        self._optimizer = optimizer
        self._feedback_adjuster = feedback_adjuster
        self._tracker = tracker

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def config(self) -> AblationConfig:
        return self._config

    def run(
        self,
        entries: Sequence[QueryEntry],
    ) -> RunnerResult:
        """Execute all entries through the configured ablation pipeline."""
        planner = self._build_planner()
        runner = BenchmarkRunner(
            planner=planner,
            classifier=self._classifier,
            retriever=self._retriever,
        )

        if self._tracker is not None:
            label = self._config.label
            return self._tracked_run(runner, list(entries), label)

        return runner.run_all(list(entries))

    def _tracked_run(
        self,
        runner: object,
        entries: list[QueryEntry],
        label: str,
    ) -> RunnerResult:
        from intelligence.experiments import ExperimentParameters  # noqa: PLC0415

        cfg = self._config
        params = ExperimentParameters(
            planner_enabled=cfg.planner_enabled,
            calibration_enabled=cfg.calibration_enabled,
            optimization_enabled=cfg.optimization_enabled,
            feedback_enabled=cfg.feedback_enabled,
            dataset_name="benchmark",
            query_types=",".join(sorted({e.query_type for e in entries})),
        )
        with self._tracker.start_run(
            name=f"ablation-{label}",
            description=f"Ablation run with config: {label}",
            phase="ablation",
            parameters=params,
            tags={"config_label": label},
        ):
            result = runner.run_all(list(entries))  # type: ignore[arg-type]
            self._tracker.log_metrics_from_result(result)
            return result

    # ------------------------------------------------------------------
    # Internal — planner factory
    # ------------------------------------------------------------------

    def _build_planner(self) -> object:
        """Build the appropriate planner based on the ablation config.

        Returns:
            A planner object with a ``plan(query) -> PlannerDecision``
            interface.
        """
        cfg = self._config

        if not cfg.planner_enabled:
            return _StaticPlanner()

        from intelligence.planner.retrieval_planner import RetrievalPlanner  # noqa: PLC0415

        calibrator = self._calibrator if cfg.calibration_enabled else None
        optimizer = self._optimizer if cfg.optimization_enabled else None
        feedback_adjuster = self._feedback_adjuster if cfg.feedback_enabled else None

        planner = RetrievalPlanner(
            classifier=self._classifier,
            calibrator=calibrator,
            optimizer=optimizer,
            feedback_adjuster=feedback_adjuster,
        )

        # Store the effective flags so callers can inspect what was used
        planner._ablation_config = cfg  # type: ignore[attr-defined]
        return planner

    def run_on_dataset(
        self,
        dataset_path: Optional[str] = None,
        query_types: Optional[Sequence[str]] = None,
        validate: bool = True,
    ) -> RunnerResult:
        """Convenience: load dataset and run in one call."""
        entries = load_dataset(path=dataset_path, validate=validate)
        if query_types is not None:
            type_set = set(query_types)
            entries = [e for e in entries if e.query_type in type_set]
        return self.run(entries)


# ---------------------------------------------------------------------------
# Static fallback planner (baseline)
# ---------------------------------------------------------------------------


class _StaticPlanner:
    """Minimal planner that always returns a fixed config.

    This is the fallback when *planner_enabled* is ``False``.
    """

    def plan(self, query: str, **kwargs: Any) -> object:
        from intelligence.planner.retrieval_planner import PlannerDecision  # noqa: PLC0415

        return PlannerDecision(
            config={
                "retrieval_type": "RETRIEVAL_TYPE_UNSPECIFIED",
                "top_k": 3,
                "rerank": False,
                "decompose": False,
            },
            confidence=0.5,
            query_type="simple",
        )

    def plan_with_evaluation(
        self, query: str, chunk_count: int, **kwargs: Any
    ) -> object:
        decision = self.plan(query)
        from intelligence.planner.fallback_manager import FallbackManager  # noqa: PLC0415

        fb = FallbackManager.evaluate(decision.config, chunk_count, confidence=0.5)
        return type(decision)(
            config=decision.config,
            confidence=decision.confidence,
            query_type=decision.query_type,
            fallback_decision=fb,
        )
