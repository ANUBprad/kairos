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
from typing import Callable, Optional, Tuple

from .budget_allocator import allocate_budget
from .fallback_manager import FallbackDecision, FallbackManager
from .planner_config import QueryType

# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PlannerDecision:
    """Pure planning output — no chunks, no I/O side effects.

    Attributes:
        config:            Final retrieval config dict (``retrieval_type``,
                           ``top_k``, ``rerank``, ``decompose``).
        confidence:        Classifier confidence for the query.
        query_type:        The classified query type string.
        fallback_decision: Optional fallback evaluation result.  Populated
                           when using :meth:`plan_with_evaluation`.
    """

    config: dict
    confidence: float
    query_type: str
    fallback_decision: Optional[FallbackDecision] = None


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
    ) -> None:
        """Initialise the planner with its dependencies.

        Args:
            classifier: An object that exposes
                ``classify_with_confidence(query) → ResponseSchema``,
                where ``ResponseSchema`` has ``query_type`` (str),
                ``domain`` (str | None), and ``confidence_score`` (float).
            strategy_selector: Optional callable with the same signature
                as :func:`~intelligence.classifier.strategy_selector.get_config`.
                Defaults to the real implementation (imported lazily to
                avoid circular dependencies).
        """
        self._classifier = classifier

        if strategy_selector is not None:
            self._get_config = strategy_selector
        else:
            from ..classifier.strategy_selector import get_config  # noqa: PLC0415

            self._get_config = get_config

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def plan(self, query: str) -> PlannerDecision:
        """Classify the query and produce a retrieval config.

        This method performs **no I/O** — it only runs the classifier
        and applies the budget + strategy logic.

        Args:
            query: The user's query string.

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
        query_type_str = result.query_type
        confidence = result.confidence_score

        budget = allocate_budget(QueryType(query_type_str), confidence)
        config = self._get_config(result, confidence, budget)

        return PlannerDecision(
            config=config,
            confidence=confidence,
            query_type=query_type_str,
        )

    def plan_with_evaluation(
        self,
        query: str,
        chunk_count: int,
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

        Returns:
            A :class:`PlannerDecision` with ``fallback_decision``
            populated.

        Examples:
            >>> decision = planner.plan_with_evaluation(
            ...     "Who wrote Les Misérables?", 1)
            >>> decision.fallback_decision.should_fallback
            True
        """
        decision = self.plan(query)
        fb = FallbackManager.evaluate(
            config=decision.config,
            chunk_count=chunk_count,
            confidence=decision.confidence,
        )
        return PlannerDecision(
            config=decision.config,
            confidence=decision.confidence,
            query_type=decision.query_type,
            fallback_decision=fb,
        )
