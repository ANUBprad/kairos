"""Retrieval planner — pure planning without I/O.

The planner is a **decision layer only**.  It wires the classifier, budget
allocator, and strategy selector to produce a :class:`PlannerDecision` for
a query, but **never calls retrievers**.

The caller is responsible for acting on the decision: looking up the
correct retriever for ``decision.config["retrieval_type"]``, executing
it, and then evaluating the outcome with :class:`FallbackManager`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Optional

from .budget_allocator import allocate_budget
from .fallback_manager import FallbackDecision, FallbackManager
from .planner_config import QueryType, RetrievalBudget

# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PlannerDecision:
    """Pure planning output — no chunks, no I/O side effects.

    Attributes:
        config:               Final retrieval config dict (``retrieval_type``,
                              ``top_k``, ``rerank``, ``decompose``).
        confidence:           Classifier confidence for the query.
        calibrated_confidence:Calibrated confidence (same as *confidence* when
                              calibration disabled).
        query_type:           The classified query type string.
        fallback_decision:    Optional fallback evaluation result.  Populated
                              when using :meth:`plan_with_evaluation`.
        calibration_method:   Calibration strategy name or ``None``.
    """

    config: dict
    confidence: float
    query_type: str
    fallback_decision: Optional[FallbackDecision] = None
    calibrated_confidence: Optional[float] = None
    calibration_method: Optional[str] = None


# ---------------------------------------------------------------------------
# Type alias
# ---------------------------------------------------------------------------

_StrategySelector = Callable[..., dict]


# ---------------------------------------------------------------------------
# RetrievalPlanner
# ---------------------------------------------------------------------------


class RetrievalPlanner:
    """Produces retrieval decisions from classifier + budget + strategy.

    Usage::

        planner = RetrievalPlanner(classifier=my_classifier)
        decision = planner.plan("What is the capital of France?")

        # The caller uses the decision to execute retrieval:
        # retriever = retrievers_by_type[decision.config["retrieval_type"]]
        # chunks = retriever.retrieve_top_k(ns, decision.config["top_k"], query)
        # fb = FallbackManager.evaluate(decision.config, len(chunks))
    """

    def __init__(
        self,
        classifier: object,
        strategy_selector: Optional[_StrategySelector] = None,
        calibrator: Optional[object] = None,
        optimizer: Optional[object] = None,
        feedback_adjuster: Optional[object] = None,
    ) -> None:
        """Initialise the planner with its dependencies.

        Args:
            classifier: An object that exposes
                ``classify_with_confidence(query) -> ResponseSchema``,
                where ``ResponseSchema`` has ``query_type`` (str),
                ``domain`` (str | None), and ``confidence_score`` (float).
            strategy_selector: Optional callable with the same signature
                as :func:`~intelligence.classifier.strategy_selector.get_config`.
                Defaults to the real implementation (imported lazily to
                avoid circular dependencies).
            calibrator: Optional :class:`ConfidenceCalibrator` instance.
                When provided and *use_calibrated_confidence* is ``True``
                in :meth:`plan`, the raw classifier confidence is passed
                through the calibrator before budget allocation.
            optimizer: Optional :class:`BudgetOptimizer` instance.
                When provided and *use_learned_budget* is ``True``
                in :meth:`plan`, the learned budget table replaces
                the static budget allocation.
            feedback_adjuster: Optional :class:`FeedbackAdjuster` instance.
                When provided and *use_feedback_learning* is ``True``
                in :meth:`plan`, historical feedback is used to adjust
                budget decisions when a config has historically poor
                acceptance.
        """
        self._classifier = classifier
        self._calibrator = calibrator
        self._optimizer = optimizer
        self._feedback_adjuster = feedback_adjuster

        if strategy_selector is not None:
            self._get_config = strategy_selector
        else:
            from ..classifier.strategy_selector import get_config  # noqa: PLC0415

            self._get_config = get_config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def plan(
        self,
        query: str,
        use_calibrated_confidence: bool = True,
        use_learned_budget: bool = True,
        use_feedback_learning: bool = False,
    ) -> PlannerDecision:
        """Classify the query and produce a retrieval config.

        This method performs **no I/O** — it only runs the classifier
        and applies the budget + strategy logic.

        Args:
            query: The user's query string.
            use_calibrated_confidence: If ``True`` and a calibrator is
                available, apply calibration before budget allocation.
            use_learned_budget: If ``True`` and an optimizer is
                available, use the learned budget table instead of the
                static hand-crafted budget table.
            use_feedback_learning: If ``True`` and a feedback adjuster
                is available, adjust budget decisions based on
                historical feedback patterns.

        Returns:
            A :class:`PlannerDecision` with config and confidence.

        Examples:
            >>> decision = planner.plan("What is the capital of France?")
            >>> decision.confidence
            0.95
            >>> decision.config["top_k"]
            3
            >>> decision.config["retrieval_type"]
            'RETRIEVAL_TYPE_UNSPECIFIED'
        """
        result = self._classifier.classify_with_confidence(query)
        raw_confidence = result.confidence_score
        query_type_str = result.query_type

        calibrated_confidence: Optional[float] = None
        calibration_method: Optional[str] = None

        if (
            use_calibrated_confidence
            and self._calibrator is not None
            and self._calibrator.fitted
        ):
            cal_result = self._calibrator.calibrate(raw_confidence)
            calibrated_confidence = cal_result.calibrated_confidence
            calibration_method = cal_result.method
            budget_confidence = calibrated_confidence
        else:
            budget_confidence = raw_confidence

        if (
            use_learned_budget
            and self._optimizer is not None
            and self._optimizer.fitted
        ):
            rec = self._optimizer.recommend_budget(query_type_str, budget_confidence)
            budget = RetrievalBudget(
                top_k=rec.recommended_top_k,
                rerank=rec.recommended_rerank,
                decompose=rec.recommended_decompose,
            )
        else:
            budget = allocate_budget(QueryType(query_type_str), budget_confidence)

        # --- Feedback Adjustment Layer ---
        if (
            use_feedback_learning
            and self._feedback_adjuster is not None
            and self._feedback_adjuster.fitted
        ):
            adj_top_k, adj_rerank, adj_decompose = (
                self._feedback_adjuster.adjust_config(
                    query_type_str,
                    budget.top_k,
                    budget.rerank,
                    budget.decompose,
                )
            )
            if (
                adj_top_k != budget.top_k
                or adj_rerank != budget.rerank
                or adj_decompose != budget.decompose
            ):
                budget = RetrievalBudget(
                    top_k=adj_top_k,
                    rerank=adj_rerank,
                    decompose=adj_decompose,
                )

        config = self._get_config(result, budget_confidence, budget)

        return PlannerDecision(
            config=config,
            confidence=raw_confidence,
            calibrated_confidence=calibrated_confidence or raw_confidence,
            query_type=query_type_str,
            calibration_method=calibration_method,
        )

    def plan_with_evaluation(
        self,
        query: str,
        chunk_count: int,
        use_calibrated_confidence: bool = True,
        use_learned_budget: bool = True,
        use_feedback_learning: bool = False,
    ) -> PlannerDecision:
        """Plan and evaluate retrieval quality in one call.

        This is a convenience wrapper that chains :meth:`plan` with
        :meth:`FallbackManager.evaluate`.  It still performs **no I/O** —
        the caller must provide the *chunk_count* obtained from an
        earlier retrieval attempt.

        Args:
            query:       The user's query string.
            chunk_count: Number of chunks returned by the initial
                         retrieval attempt.
            use_calibrated_confidence: Passed through to :meth:`plan`.
            use_learned_budget: Passed through to :meth:`plan`.
            use_feedback_learning: Passed through to :meth:`plan`.

        Returns:
            A :class:`PlannerDecision` with ``fallback_decision``
            populated.
        """
        decision = self.plan(
            query,
            use_calibrated_confidence=use_calibrated_confidence,
            use_learned_budget=use_learned_budget,
            use_feedback_learning=use_feedback_learning,
        )
        budget_confidence = (
            decision.calibrated_confidence
            if use_calibrated_confidence
            else decision.confidence
        )
        fb = FallbackManager.evaluate(
            config=decision.config,
            chunk_count=chunk_count,
            confidence=budget_confidence,
        )
        return PlannerDecision(
            config=decision.config,
            confidence=decision.confidence,
            calibrated_confidence=decision.calibrated_confidence,
            query_type=decision.query_type,
            fallback_decision=fb,
            calibration_method=decision.calibration_method,
        )
