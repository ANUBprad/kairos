"""Benchmark runner — orchestrates query execution through the full pipeline.

The :class:`BenchmarkRunner` ties together the dataset, classifier, planner,
retriever, and metrics to produce a :class:`RunnerResult` with per-query
and aggregate measurements.

Pipeline per query::

    1. Classify  ──► confidence_score, query_type
    2. Plan      ──► config (retrieval_type, top_k, rerank, decompose)
    3. Retrieve  ──► list of chunk IDs
    4. Evaluate  ──► recall, precision, fallback check, failures
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from benchmarks.dataset.loader import QueryEntry
from benchmarks.metrics import (
    FailureRecord,
    LatencyRecord,
    LatencyTracker,
    precision_at_k,
    recall_at_k,
)
from intelligence.planner import FallbackManager, PlannerDecision, RetrievalPlanner

from .types import QueryResult, RunnerResult


# ---------------------------------------------------------------------------
# Internal — caching classifier wrapper
# ---------------------------------------------------------------------------


class _CachedClassifier:
    """Wraps a classifier so that each query is classified at most once.

    The runner calls :meth:`classify_with_confidence` first (measuring
    classify latency), and the planner's internal call returns the cached
    result — keeping planning latency separate from classify latency.
    """

    def __init__(self, inner: object) -> None:
        self._inner = inner
        self._cache: Dict[str, object] = {}

    def classify_with_confidence(self, query: str) -> object:
        if query not in self._cache:
            self._cache[query] = self._inner.classify_with_confidence(query)  # type: ignore[union-attr]
        return self._cache[query]

    @property
    def inner(self) -> object:
        return self._inner


# ---------------------------------------------------------------------------
# BenchmarkRunner
# ---------------------------------------------------------------------------


class BenchmarkRunner:
    """Execute benchmark queries and collect metrics.

    Parameters
    ----------
    classifier:
        Object with a ``classify_with_confidence(query)`` method returning
        a schema with ``query_type``, ``domain``, and ``confidence_score``.
    retriever:
        Object conforming to the :class:`Retriever` protocol.
    planner:
        Optional pre-configured :class:`RetrievalPlanner`.  Defaults to a
        planner that wraps *classifier* (through a cache layer).

    Examples
    --------
    >>> from unittest.mock import MagicMock
    >>> from benchmarks.runner import BenchmarkRunner, MockRetriever
    >>> from benchmarks.dataset import load_dataset
    >>>
    >>> clf = MagicMock()
    >>> schema = MagicMock(query_type="simple", domain=None, confidence_score=0.95)
    >>> clf.classify_with_confidence.return_value = schema
    >>>
    >>> retriever = MockRetriever({"SIMPLE-001": ["chunk_a"]})
    >>> runner = BenchmarkRunner(classifier=clf, retriever=retriever)
    >>> entries = load_dataset(validate=False)
    >>> result = runner.run_all(entries[:2])
    >>> result.total_queries
    2
    """

    # Use object to avoid an import-time dependency on the classifier's
    # actual return type.
    def __init__(
        self,
        classifier: object,
        retriever: Retriever,
        planner: Optional[RetrievalPlanner] = None,
    ) -> None:
        self._retriever = retriever
        self._cached_clf = _CachedClassifier(classifier)
        self._planner = planner or RetrievalPlanner(
            classifier=self._cached_clf
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run_query(self, entry: QueryEntry) -> QueryResult:
        """Execute a single benchmark query end-to-end.

        Parameters
        ----------
        entry:
            The query entry from the dataset.

        Returns
        -------
        QueryResult
            Full execution record with metrics.
        """
        tracker = LatencyTracker()
        failures: Dict[str, int] = {
            "empty_retrieval": 0,
            "timeout": 0,
            "planner_fallback": 0,
            "generation_failure": 0,
        }

        # ---- 1. Classify (measured separately from planning) ----
        with tracker.measure("classify"):
            schema = self._cached_clf.classify_with_confidence(entry.text)

        # ---- 2. Plan (planner's internal classify call hits cache) ----
        with tracker.measure("planning"):
            decision = self._planner.plan(entry.text)

        # ---- 3. Retrieve ----
        chunks: List[str] = []
        with tracker.measure("retrieval"):
            try:
                chunks = self._retriever.retrieve(
                    entry.text,
                    decision.config,
                    query_id=entry.id,
                )
            except Exception:
                failures["timeout"] = 1
                chunks = []

        if not chunks:
            failures["empty_retrieval"] = 1

        # ---- 4. Evaluate fallback ----
        fb = FallbackManager.evaluate(
            config=decision.config,
            chunk_count=len(chunks),
            confidence=decision.confidence,
        )
        if fb.should_fallback:
            failures["planner_fallback"] = 1

        # ---- 5. Compute recall / precision (if ground truth available) ----
        recall: Optional[float] = None
        precision: Optional[float] = None
        if entry.expected_chunks:
            relevant = set(entry.expected_chunks)
            if chunks:
                recall = recall_at_k(relevant, chunks)
                precision = precision_at_k(relevant, chunks)
            else:
                recall = 0.0
                precision = 0.0

        latency = tracker.record()

        return QueryResult(
            entry=entry,
            planner_decision=decision,
            retrieved_chunks=tuple(chunks),
            latency=latency,
            failures=FailureRecord(**failures, total_queries=1),
            recall=recall,
            precision=precision,
        )

    def run_all(
        self,
        entries: List[QueryEntry],
    ) -> RunnerResult:
        """Execute a list of queries and return aggregate results.

        Parameters
        ----------
        entries:
            Benchmark queries to execute.

        Returns
        -------
        RunnerResult
            Aggregate metrics across all queries.
        """
        results: List[QueryResult] = []
        for entry in entries:
            result = self.run_query(entry)
            results.append(result)
        return RunnerResult(results=tuple(results))
