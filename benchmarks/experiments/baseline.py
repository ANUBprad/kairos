"""Baseline experiment — traditional RAG without adaptive retrieval.

The :class:`BaselineExperimentRunner` represents a traditional retrieval
pipeline that **does not** apply confidence-aware budget overrides or
fallback escalation.  Its planner always returns the static HIGH-confidence
config for the classified query type.

Key differences from the treatment runner:

* :class:`BenchmarkRunner` is injected with :class:`_StaticPlanner` instead
  of :class:`RetrievalPlanner`.
* The static planner reports ``confidence=1.0`` so that
  :class:`FallbackManager` never triggers fallback.
* No budget overrides are applied — every query gets the default top_k,
  rerank, and decompose settings for its type.
"""

from __future__ import annotations

from typing import Dict, Optional

from benchmarks.experiments.base import BaseExperimentRunner
from benchmarks.runner import BenchmarkRunner
from intelligence.planner import PlannerDecision


class _StaticPlanner:
    """Planner that always returns the static HIGH-confidence config.

    On every :meth:`plan` call it:
    1. Asks the classifier for the query type.
    2. Builds a config using the static path of
       ``strategy_selector.get_config()`` (implicitly at ``confidence=1.0``).
    3. Sets ``confidence=1.0`` so :class:`FallbackManager` never escalates.

    Parameters
    ----------
    classifier:
        Object with ``classify_with_confidence(query)`` returning a schema
        with ``query_type``, ``domain``, and ``confidence_score``.
    """

    def __init__(self, classifier: object) -> None:
        self._classifier = classifier

    def plan(self, query: str) -> PlannerDecision:
        """Classify the query and return a static config.

        Parameters
        ----------
        query:
            The user's query string.

        Returns
        -------
        PlannerDecision
            A decision with ``confidence=1.0`` and a config built from the
            static strategy (no budget overrides).
        """
        from intelligence.classifier.strategy_selector import get_config

        result = self._classifier.classify_with_confidence(query)  # type: ignore[union-attr]
        query_type_str: str = result.query_type

        config: Dict[str, object] = get_config(result, confidence=1.0)

        return PlannerDecision(
            config=config,
            confidence=1.0,
            query_type=query_type_str,
        )


class BaselineExperimentRunner(BaseExperimentRunner):
    """Experiment runner that uses static strategy (no adaptive retrieval).

    Parameters
    ----------
    classifier:
        Object with ``classify_with_confidence(query)``.
    retriever:
        Object conforming to the :class:`Retriever` protocol.
    dataset_path:
        Optional path to ``queries.json``.
    validate:
        Whether to validate the dataset on load (default ``True``).
    """

    def _create_runner(self) -> BenchmarkRunner:
        planner = _StaticPlanner(self._classifier)
        return BenchmarkRunner(
            classifier=self._classifier,
            retriever=self._retriever,  # type: ignore[arg-type]
            planner=planner,
        )
