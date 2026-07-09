"""Unit tests for benchmarks.runner."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from benchmarks.dataset import QueryEntry
from benchmarks.metrics import FailureRecord, LatencyRecord
from benchmarks.runner import (
    BenchmarkRunner,
    MockRetriever,
    QueryResult,
    RunnerResult,
)
from intelligence.planner import PlannerDecision


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def mock_classifier() -> MagicMock:
    clf = MagicMock()
    schema = MagicMock(
        query_type="simple",
        domain=None,
        confidence_score=0.95,
    )
    clf.classify_with_confidence.return_value = schema
    return clf


@pytest.fixture
def simple_entry() -> QueryEntry:
    return QueryEntry(
        id="SIMPLE-001",
        text="definition of AI system under Article 3(1)?",
        query_type="simple",
        domain="definitions",
        corpus_ref="EU_AI_Act.pdf",
        expected_articles=["Article 3(1)"],
        confidence_category="high",
        expected_chunks=["chunk_art3_1"],
    )


@pytest.fixture
def simple_entry_no_ground_truth() -> QueryEntry:
    return QueryEntry(
        id="SIMPLE-002",
        text="definition of AI system under Article 3(1)?",
        query_type="simple",
        domain="definitions",
        corpus_ref="EU_AI_Act.pdf",
        expected_articles=["Article 3(1)"],
        confidence_category="high",
    )


@pytest.fixture
def chunk_map() -> dict[str, list[str]]:
    return {
        "SIMPLE-001": ["chunk_art3_1", "chunk_art3_2"],
        "COMPLEX-001": ["chunk_art16", "chunk_art26"],
        "EMPTY-001": [],
    }


@pytest.fixture
def runner(
    mock_classifier: MagicMock,
    chunk_map: dict[str, list[str]],
) -> BenchmarkRunner:
    retriever = MockRetriever(chunk_map=chunk_map)
    return BenchmarkRunner(classifier=mock_classifier, retriever=retriever)


# ======================================================================
# QueryResult
# ======================================================================


class TestQueryResult:
    def test_frozen(self) -> None:
        entry = QueryEntry(id="X", text="?", query_type="simple")
        decision = PlannerDecision(config={}, confidence=0.5, query_type="simple")
        result = QueryResult(
            entry=entry,
            planner_decision=decision,
            retrieved_chunks=(),
            latency=LatencyRecord(),
            failures=FailureRecord(),
        )
        with pytest.raises(AttributeError):
            result.retrieved_chunks = ("x",)  # type: ignore[misc]

    def test_recall_precision_none_by_default(self) -> None:
        entry = QueryEntry(id="X", text="?", query_type="simple")
        decision = PlannerDecision(config={}, confidence=0.5, query_type="simple")
        result = QueryResult(
            entry=entry,
            planner_decision=decision,
            retrieved_chunks=(),
            latency=LatencyRecord(),
            failures=FailureRecord(),
        )
        assert result.recall is None
        assert result.precision is None


# ======================================================================
# RunnerResult
# ======================================================================


class TestRunnerResult:
    def make_result(
        self,
        query_type: str = "simple",
        recall: float | None = 1.0,
        precision: float | None = 1.0,
        latency: LatencyRecord | None = None,
        failures: FailureRecord | None = None,
    ) -> QueryResult:
        entry = QueryEntry(id="X", text="?", query_type=query_type)
        decision = PlannerDecision(config={}, confidence=0.5, query_type=query_type)
        return QueryResult(
            entry=entry,
            planner_decision=decision,
            retrieved_chunks=("a",),
            latency=latency or LatencyRecord(classify=0.1, total=0.3),
            failures=failures or FailureRecord(),
            recall=recall,
            precision=precision,
        )

    def test_total_queries(self) -> None:
        result = RunnerResult(results=(self.make_result(), self.make_result()))
        assert result.total_queries == 2

    def test_total_queries_empty(self) -> None:
        result = RunnerResult(results=())
        assert result.total_queries == 0

    def test_aggregated_failures(self) -> None:
        r1 = self.make_result(
            failures=FailureRecord(empty_retrieval=1, total_queries=1)
        )
        r2 = self.make_result(failures=FailureRecord(timeout=1, total_queries=1))
        agg = RunnerResult(results=(r1, r2)).aggregated_failures()
        assert agg.empty_retrieval == 1
        assert agg.timeout == 1
        assert agg.planner_fallback == 0
        assert agg.total_queries == 2

    def test_aggregated_latency(self) -> None:
        r1 = self.make_result(latency=LatencyRecord(classify=0.1, total=0.3))
        r2 = self.make_result(latency=LatencyRecord(retrieval=0.2, total=0.5))
        agg = RunnerResult(results=(r1, r2)).aggregated_latency()
        assert agg.classify == pytest.approx(0.1)
        assert agg.retrieval == pytest.approx(0.2)
        assert agg.total == pytest.approx(0.8)

    def test_average_latency(self) -> None:
        r1 = self.make_result(latency=LatencyRecord(classify=0.1, total=0.3))
        r2 = self.make_result(latency=LatencyRecord(classify=0.3, total=0.5))
        avg = RunnerResult(results=(r1, r2)).average_latency()
        assert avg.classify == pytest.approx(0.2)
        assert avg.total == pytest.approx(0.4)

    def test_average_latency_empty(self) -> None:
        avg = RunnerResult(results=()).average_latency()
        assert avg.classify == 0.0
        assert avg.total == 0.0

    def test_average_recall(self) -> None:
        r1 = self.make_result(recall=1.0)
        r2 = self.make_result(recall=0.5)
        avg = RunnerResult(results=(r1, r2)).average_recall()
        assert avg == pytest.approx(0.75)

    def test_average_recall_none_when_no_ground_truth(self) -> None:
        r = self.make_result(recall=None)
        assert RunnerResult(results=(r,)).average_recall() is None

    def test_average_precision(self) -> None:
        r1 = self.make_result(precision=1.0)
        r2 = self.make_result(precision=0.0)
        avg = RunnerResult(results=(r1, r2)).average_precision()
        assert avg == pytest.approx(0.5)

    def test_per_type_recall(self) -> None:
        r1 = self.make_result(query_type="simple", recall=1.0)
        r2 = self.make_result(query_type="simple", recall=0.5)
        r3 = self.make_result(query_type="complex", recall=0.8)
        by_type = RunnerResult(results=(r1, r2, r3)).per_type_recall()
        assert by_type["simple"] == pytest.approx(0.75)
        assert by_type["complex"] == pytest.approx(0.8)

    def test_per_type_latency(self) -> None:
        r1 = self.make_result(
            query_type="simple",
            latency=LatencyRecord(classify=0.1, total=0.3),
        )
        r2 = self.make_result(
            query_type="complex",
            latency=LatencyRecord(classify=0.2, total=0.5),
        )
        by_type = RunnerResult(results=(r1, r2)).per_type_latency()
        assert by_type["simple"].classify == pytest.approx(0.1)
        assert by_type["complex"].classify == pytest.approx(0.2)

    def test_per_type_failures(self) -> None:
        r1 = self.make_result(
            query_type="simple",
            failures=FailureRecord(empty_retrieval=1, total_queries=1),
        )
        r2 = self.make_result(
            query_type="complex",
            failures=FailureRecord(timeout=1, total_queries=1),
        )
        by_type = RunnerResult(results=(r1, r2)).per_type_failures()
        assert by_type["simple"].empty_retrieval == 1
        assert by_type["complex"].timeout == 1


# ======================================================================
# BenchmarkRunner — run_query
# ======================================================================


class TestRunQuery:
    """BenchmarkRunner.run_query() single-query execution."""

    def test_returns_query_result(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert isinstance(result, QueryResult)

    def test_planner_decision_present(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert isinstance(result.planner_decision, PlannerDecision)
        assert "top_k" in result.planner_decision.config

    def test_retrieved_chunks(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert len(result.retrieved_chunks) > 0
        assert result.retrieved_chunks[0] == "chunk_art3_1"

    def test_retrieved_chunks_are_tuple(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert isinstance(result.retrieved_chunks, tuple)

    def test_latency_recorded(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert result.latency.classify > 0
        assert result.latency.planning > 0
        assert result.latency.retrieval > 0
        assert result.latency.total > 0

    def test_latency_classify_less_than_total(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert result.latency.total >= result.latency.classify

    def test_failures_default_zero(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert result.failures.empty_retrieval == 0
        assert result.failures.timeout == 0
        assert result.failures.planner_fallback == 0
        assert result.failures.generation_failure == 0
        assert result.failures.total_queries == 1

    def test_recall_computed_with_ground_truth(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert result.recall is not None
        assert (
            result.recall == 1.0
        )  # expected_chunks=["chunk_art3_1"], retrieved=["chunk_art3_1", ...]

    def test_precision_computed_with_ground_truth(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_query(simple_entry)
        assert result.precision is not None
        # 1 relevant out of 2 retrieved
        assert result.precision == pytest.approx(0.5)

    def test_recall_none_without_ground_truth(
        self,
        runner: BenchmarkRunner,
        simple_entry_no_ground_truth: QueryEntry,
    ) -> None:
        result = runner.run_query(simple_entry_no_ground_truth)
        assert result.recall is None
        assert result.precision is None


# ======================================================================
# BenchmarkRunner — failure scenarios
# ======================================================================


class TestRunQueryFailures:
    def test_empty_retrieval_detected(self, mock_classifier: MagicMock) -> None:
        entry = QueryEntry(id="EMPTY-001", text="empty query", query_type="simple")
        retriever = MockRetriever(empty_ids={"EMPTY-001"})
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=retriever)
        result = runner.run_query(entry)
        assert result.failures.empty_retrieval == 1
        assert len(result.retrieved_chunks) == 0

    def test_retriever_exception_counts_as_timeout(
        self, mock_classifier: MagicMock, simple_entry: QueryEntry
    ) -> None:
        def failing_retrieve(query: str, config: dict) -> list[str]:
            raise RuntimeError("retriever down")

        runner = BenchmarkRunner(
            classifier=mock_classifier,
            retriever=failing_retrieve,
        )
        result = runner.run_query(simple_entry)
        assert result.failures.timeout == 1
        assert len(result.retrieved_chunks) == 0

    def test_planner_fallback_detected(self, mock_classifier: MagicMock) -> None:
        """High top_k + 0 chunks → fallback triggered."""
        entry = QueryEntry(id="EMPTY-002", text="empty query", query_type="simple")
        retriever = MockRetriever(empty_ids={"EMPTY-002"})
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=retriever)
        result = runner.run_query(entry)
        assert result.failures.planner_fallback == 1

    def test_multiple_failures_can_coexist(self, mock_classifier: MagicMock) -> None:
        """Both empty_retrieval and planner_fallback can be 1."""
        entry = QueryEntry(id="EMPTY-003", text="fail query", query_type="simple")
        retriever = MockRetriever(empty_ids={"EMPTY-003"})
        runner = BenchmarkRunner(classifier=mock_classifier, retriever=retriever)
        result = runner.run_query(entry)
        assert result.failures.empty_retrieval == 1
        assert result.failures.planner_fallback == 1


# ======================================================================
# BenchmarkRunner — run_all
# ======================================================================


class TestRunAll:
    def test_returns_runner_result(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        result = runner.run_all([simple_entry])
        assert isinstance(result, RunnerResult)

    def test_executes_all_queries(
        self, runner: BenchmarkRunner, simple_entry: QueryEntry
    ) -> None:
        entry2 = QueryEntry(
            id="COMPLEX-001",
            text="complex query",
            query_type="complex",
            expected_chunks=["chunk_art16"],
        )
        result = runner.run_all([simple_entry, entry2])
        assert result.total_queries == 2

    def test_empty_entries(self, runner: BenchmarkRunner) -> None:
        result = runner.run_all([])
        assert result.total_queries == 0
        assert len(result.results) == 0

    def test_order_preserved(self, runner: BenchmarkRunner) -> None:
        e1 = QueryEntry(id="A", text="q1", query_type="simple")
        e2 = QueryEntry(id="B", text="q2", query_type="simple")
        result = runner.run_all([e1, e2])
        assert result.results[0].entry.id == "A"
        assert result.results[1].entry.id == "B"

    def test_aggregated_metrics(self, runner: BenchmarkRunner) -> None:
        e1 = QueryEntry(
            id="SIMPLE-001",
            text="q1",
            query_type="simple",
            expected_chunks=["chunk_art3_1"],
        )
        e2 = QueryEntry(
            id="SIMPLE-001",
            text="q2",
            query_type="simple",
            expected_chunks=["chunk_art3_1"],
        )
        result = runner.run_all([e1, e2])
        assert result.total_queries == 2
        agg = result.aggregated_failures()
        assert agg.total_queries == 2


# ======================================================================
# MockRetriever
# ======================================================================


class TestMockRetriever:
    def test_returns_configured_chunks(self) -> None:
        retriever = MockRetriever(chunk_map={"Q1": ["a", "b"]})
        chunks = retriever.retrieve("query", {}, "Q1")
        assert chunks == ["a", "b"]

    def test_returns_empty_for_configured_ids(self) -> None:
        retriever = MockRetriever(empty_ids={"Q1"})
        chunks = retriever.retrieve("query", {}, "Q1")
        assert chunks == []

    def test_default_chunk_for_unknown_id(self) -> None:
        retriever = MockRetriever()
        chunks = retriever.retrieve("unknown", {}, None)
        assert len(chunks) == 1
        assert "chunk_1" in chunks[0]

    def test_empty_map_returns_default(self) -> None:
        retriever = MockRetriever()
        chunks = retriever.retrieve("test", {}, "MISSING")
        assert chunks == ["MISSING_chunk_1"]

    def test_custom_retriever_class(self) -> None:
        """Any object matching the Retriever protocol is accepted."""

        class CustomRetriever:
            def retrieve(
                self,
                query: str,
                config: dict,
                query_id: str | None = None,
            ) -> list[str]:
                return ["custom_chunk"]

        entry = QueryEntry(id="X", text="test", query_type="simple")
        clf = MagicMock()
        schema = MagicMock(query_type="simple", domain=None, confidence_score=0.9)
        clf.classify_with_confidence.return_value = schema
        runner = BenchmarkRunner(classifier=clf, retriever=CustomRetriever())
        result = runner.run_query(entry)
        assert result.retrieved_chunks == ("custom_chunk",)


# ======================================================================
# _CachedClassifier
# ======================================================================


class TestCachedClassifier:
    def test_caches_classify_result(self) -> None:
        inner = MagicMock()
        schema = MagicMock(query_type="simple", domain=None, confidence_score=0.9)
        inner.classify_with_confidence.return_value = schema

        from benchmarks.runner.runner import _CachedClassifier

        cached = _CachedClassifier(inner)

        # First call goes to inner
        r1 = cached.classify_with_confidence("query")
        assert inner.classify_with_confidence.call_count == 1

        # Second call hits cache
        r2 = cached.classify_with_confidence("query")
        assert inner.classify_with_confidence.call_count == 1
        assert r1 is r2

    def test_different_queries_not_cached(self) -> None:
        inner = MagicMock()
        inner.classify_with_confidence.side_effect = lambda q: MagicMock(
            query_type="simple",
            domain=None,
            confidence_score=0.9,
        )

        from benchmarks.runner.runner import _CachedClassifier

        cached = _CachedClassifier(inner)

        cached.classify_with_confidence("q1")
        cached.classify_with_confidence("q2")
        assert inner.classify_with_confidence.call_count == 2

    def test_inner_exposed(self) -> None:
        inner = MagicMock()
        from benchmarks.runner.runner import _CachedClassifier

        cached = _CachedClassifier(inner)
        assert cached.inner is inner
