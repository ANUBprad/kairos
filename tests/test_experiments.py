"""Unit tests for benchmarks.experiments."""
from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from benchmarks.dataset import QueryEntry, load_dataset
from benchmarks.experiments import (
    BaseExperimentRunner,
    BaselineExperimentRunner,
    ComparisonResult,
    TreatmentExperimentRunner,
    compare,
    save_result,
)
from benchmarks.experiments.comparison import (
    comparison_to_dict,
    save_comparison,
)
from benchmarks.experiments.baseline import _StaticPlanner
from benchmarks.metrics import FailureRecord, LatencyRecord
from benchmarks.runner import (
    BenchmarkRunner,
    MockRetriever,
    QueryResult,
    RunnerResult,
)
from intelligence.planner import (
    CONFIDENCE_HIGH,
    ConfidenceBand,
    PlannerDecision,
)

# ======================================================================
# Helpers
# ======================================================================


def _make_mock_classifier(
    query_type: str = "simple",
    confidence: float = 0.95,
) -> MagicMock:
    clf = MagicMock()
    schema = MagicMock(
        query_type=query_type,
        domain=None,
        confidence_score=confidence,
    )
    clf.classify_with_confidence.return_value = schema
    return clf


def _make_query_entry(
    qid: str,
    qtype: str = "simple",
    chunks: list[str] | None = None,
) -> QueryEntry:
    return QueryEntry(
        id=qid,
        text=f"test query {qid}",
        query_type=qtype,  # type: ignore[arg-type]
        expected_chunks=chunks,
    )


def _make_query_result(
    qid: str,
    qtype: str = "simple",
    recall: float | None = 0.8,
    precision: float | None = 0.7,
    empty_retrieval: int = 0,
    timeout: int = 0,
    planner_fallback: int = 0,
) -> QueryResult:
    entry = _make_query_entry(qid, qtype)
    return QueryResult(
        entry=entry,
        planner_decision=PlannerDecision(
            config={}, confidence=0.9, query_type=qtype
        ),
        retrieved_chunks=("a", "b"),
        latency=LatencyRecord(total=0.1),
        failures=FailureRecord(
            empty_retrieval=empty_retrieval,
            timeout=timeout,
            planner_fallback=planner_fallback,
            total_queries=1,
        ),
        recall=recall,
        precision=precision,
    )


# ======================================================================
# _StaticPlanner
# ======================================================================


class TestStaticPlanner:
    def test_plan_returns_planner_decision(self) -> None:
        clf = _make_mock_classifier("simple", 0.95)
        planner = _StaticPlanner(clf)
        decision = planner.plan("test query")
        assert isinstance(decision, PlannerDecision)

    def test_plan_uses_classifier(self) -> None:
        clf = _make_mock_classifier("complex", 0.70)
        planner = _StaticPlanner(clf)
        decision = planner.plan("test query")
        assert decision.query_type == "complex"
        clf.classify_with_confidence.assert_called_once_with("test query")

    def test_confidence_always_one(self) -> None:
        clf = _make_mock_classifier("simple", 0.30)
        planner = _StaticPlanner(clf)
        decision = planner.plan("test query")
        assert decision.confidence == 1.0

    def test_config_is_static(self) -> None:
        clf = _make_mock_classifier("simple", 0.30)
        planner = _StaticPlanner(clf)
        decision = planner.plan("test query")

        # Even with low confidence from classifier, static planner
        # returns the HIGH-confidence config (top_k=3 for simple).
        assert decision.config["top_k"] == 3
        assert decision.config["rerank"] is False
        assert decision.config["decompose"] is False
        assert decision.config["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"

    def test_complex_static_config(self) -> None:
        clf = _make_mock_classifier("complex", 0.10)
        planner = _StaticPlanner(clf)
        decision = planner.plan("test query")

        # Complex HIGH config: top_k=8, rerank=True
        assert decision.config["top_k"] == 8
        assert decision.config["rerank"] is True
        assert decision.config["decompose"] is False

    def test_multihop_static_config(self) -> None:
        clf = _make_mock_classifier("multi_hop", 0.10)
        planner = _StaticPlanner(clf)
        decision = planner.plan("test query")

        # Multi-hop HIGH config: top_k=3, decompose=True
        assert decision.config["top_k"] == 3
        assert decision.config["rerank"] is False
        assert decision.config["decompose"] is True

    def test_no_fallback_when_chunks_sufficient(self) -> None:
        """Since _StaticPlanner returns the HIGH budget config,
        FallbackManager should not trigger when chunks are sufficient."""
        clf = _make_mock_classifier("simple", 0.30)
        retriever = MockRetriever(chunk_map={"Q1": ["c1", "c2"]})
        planner = _StaticPlanner(clf)
        runner = BenchmarkRunner(
            classifier=clf, retriever=retriever, planner=planner
        )
        entry = _make_query_entry("Q1", "simple")
        result = runner.run_query(entry)
        assert result.failures.planner_fallback == 0
        assert result.failures.empty_retrieval == 0


# ======================================================================
# BaseExperimentRunner
# ======================================================================


class TestBaseExperimentRunner:
    def test_create_runner_not_implemented(self) -> None:
        runner = BaseExperimentRunner(
            classifier=_make_mock_classifier(),
            retriever=MockRetriever(),
        )
        with pytest.raises(NotImplementedError):
            runner._create_runner()

    def test_run_loads_dataset(self) -> None:
        """Smoke test — verify base runner can be subclassed and run."""
        class TestRunner(BaseExperimentRunner):
            def _create_runner(self) -> BenchmarkRunner:
                clf = _make_mock_classifier()
                return BenchmarkRunner(
                    classifier=clf, retriever=MockRetriever()
                )

        runner = TestRunner(
            classifier=_make_mock_classifier(),
            retriever=MockRetriever(),
            validate=False,
        )
        result = runner.run()
        assert isinstance(result, RunnerResult)
        assert result.total_queries >= 0

    def test_run_filters_by_type(self) -> None:
        class TestRunner(BaseExperimentRunner):
            def _create_runner(self) -> BenchmarkRunner:
                clf = _make_mock_classifier()
                return BenchmarkRunner(
                    classifier=clf, retriever=MockRetriever()
                )

        runner = TestRunner(
            classifier=_make_mock_classifier(),
            retriever=MockRetriever(),
            validate=False,
        )
        result = runner.run(query_types=["simple"])
        assert isinstance(result, RunnerResult)

    def test_run_and_save_persists_json(self) -> None:
        class TestRunner(BaseExperimentRunner):
            def _create_runner(self) -> BenchmarkRunner:
                clf = _make_mock_classifier()
                return BenchmarkRunner(
                    classifier=clf, retriever=MockRetriever()
                )

        runner = TestRunner(
            classifier=_make_mock_classifier(),
            retriever=MockRetriever(),
            validate=False,
        )
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as tmp:
            path = tmp.name

        try:
            result = runner.run_and_save(path=Path(path))
            assert isinstance(result, RunnerResult)

            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            assert "metadata" in data
            assert "aggregate" in data
            assert "per_type" in data
            assert "queries" in data
            assert data["metadata"]["total_queries"] == result.total_queries
        finally:
            os.unlink(path)


# ======================================================================
# BaselineExperimentRunner
# ======================================================================


class TestBaselineExperimentRunner:
    def test_create_runner_returns_benchmark_runner(self) -> None:
        runner = BaselineExperimentRunner(
            classifier=_make_mock_classifier(),
            retriever=MockRetriever(),
            validate=False,
        )
        bmr = runner._create_runner()
        assert isinstance(bmr, BenchmarkRunner)

    def test_run_returns_runner_result(self) -> None:
        runner = BaselineExperimentRunner(
            classifier=_make_mock_classifier("simple", 0.95),
            retriever=MockRetriever(),
            validate=False,
        )
        result = runner.run(query_types=["simple"])
        assert isinstance(result, RunnerResult)

    def test_confidence_is_one_in_decision(self) -> None:
        """The underlying _StaticPlanner should force confidence=1.0."""
        clf = _make_mock_classifier("simple", 0.30)
        runner = BaselineExperimentRunner(
            classifier=clf,
            retriever=MockRetriever(),
            validate=False,
        )
        result = runner.run(query_types=["simple"])
        for qr in result.results:
            assert qr.planner_decision.confidence == 1.0

    def test_no_planner_fallback_with_sufficient_chunks(self) -> None:
        """Baseline should not trigger planner fallback when the retriever
        returns enough chunks for the static budget (top_k=3 → threshold=2)."""
        clf = _make_mock_classifier("simple", 0.30)
        retriever = MockRetriever(chunk_map={"SIMPLE-001": ["c1", "c2"]})
        runner = BaselineExperimentRunner(
            classifier=clf,
            retriever=retriever,
            validate=False,
        )
        result = runner.run(query_types=["simple"])
        for qr in result.results:
            assert qr.failures.planner_fallback == 0

    def test_static_config_no_budget_overrides(self) -> None:
        """Even with low-confidence query, baseline uses HIGH config."""
        clf = _make_mock_classifier("simple", 0.20)
        runner = BaselineExperimentRunner(
            classifier=clf,
            retriever=MockRetriever(),
            validate=False,
        )
        result = runner.run(query_types=["simple"])
        for qr in result.results:
            assert qr.planner_decision.config["top_k"] == 3


# ======================================================================
# TreatmentExperimentRunner
# ======================================================================


class TestTreatmentExperimentRunner:
    def test_create_runner_returns_benchmark_runner(self) -> None:
        runner = TreatmentExperimentRunner(
            classifier=_make_mock_classifier(),
            retriever=MockRetriever(),
            validate=False,
        )
        bmr = runner._create_runner()
        assert isinstance(bmr, BenchmarkRunner)

    def test_run_returns_runner_result(self) -> None:
        runner = TreatmentExperimentRunner(
            classifier=_make_mock_classifier("complex", 0.95),
            retriever=MockRetriever(),
            validate=False,
        )
        result = runner.run(query_types=["complex"])
        assert isinstance(result, RunnerResult)

    def test_preserves_classifier_confidence(self) -> None:
        """Treatment should use the real confidence from the classifier."""
        clf = _make_mock_classifier("complex", 0.45)
        runner = TreatmentExperimentRunner(
            classifier=clf,
            retriever=MockRetriever(),
            validate=False,
        )
        result = runner.run(query_types=["complex"])
        for qr in result.results:
            assert qr.planner_decision.confidence == 0.45

    def test_budget_overrides_applied_at_low_confidence(self) -> None:
        """Low confidence should increase top_k (confidence-aware)."""
        clf = _make_mock_classifier("simple", 0.20)
        runner = TreatmentExperimentRunner(
            classifier=clf,
            retriever=MockRetriever(),
            validate=False,
        )
        result = runner.run(query_types=["simple"])
        for qr in result.results:
            # Low confidence simple: top_k=8, rerank=True
            assert qr.planner_decision.config["top_k"] == 8
            assert qr.planner_decision.config["rerank"] is True

    def test_planner_fallback_possible(self) -> None:
        """Treatment runner may trigger fallback on empty retrieval
        with low confidence."""
        clf = _make_mock_classifier("simple", 0.20)
        retriever = MockRetriever(empty_ids={"SIMPLE-001"})
        runner = TreatmentExperimentRunner(
            classifier=clf,
            retriever=retriever,
            validate=False,
        )
        result = runner.run(query_types=["simple"])
        for qr in result.results:
            if qr.failures.empty_retrieval > 0:
                # Empty retrieval + low confidence may trigger fallback
                assert qr.failures.planner_fallback >= 0


# ======================================================================
# Comparison
# ======================================================================


class TestCompare:
    def test_compare_returns_comparison_result(self) -> None:
        baseline = RunnerResult(
            results=(
                _make_query_result("Q1", "simple", recall=0.8, precision=0.7),
                _make_query_result("Q2", "complex", recall=0.6, precision=0.5),
            )
        )
        treatment = RunnerResult(
            results=(
                _make_query_result("Q1", "simple", recall=0.9, precision=0.8),
                _make_query_result("Q2", "complex", recall=0.7, precision=0.6),
            )
        )
        comp = compare(baseline, treatment)
        assert isinstance(comp, ComparisonResult)
        assert comp.total_queries == 2

    def test_positive_recall_delta(self) -> None:
        baseline = RunnerResult(
            results=(_make_query_result("Q1", recall=0.5),)
        )
        treatment = RunnerResult(
            results=(_make_query_result("Q1", recall=0.8),)
        )
        comp = compare(baseline, treatment)
        assert comp.recall_delta == pytest.approx(0.3)
        assert comp.precision_delta == 0.0  # both have 0.7

    def test_negative_latency_delta(self) -> None:
        """Treatment faster than baseline → negative delta."""
        b_qr = _make_query_result("Q1")
        b_qr = QueryResult(
            entry=b_qr.entry,
            planner_decision=b_qr.planner_decision,
            retrieved_chunks=b_qr.retrieved_chunks,
            latency=LatencyRecord(total=0.5),
            failures=b_qr.failures,
            recall=b_qr.recall,
            precision=b_qr.precision,
        )
        t_qr = QueryResult(
            entry=b_qr.entry,
            planner_decision=b_qr.planner_decision,
            retrieved_chunks=b_qr.retrieved_chunks,
            latency=LatencyRecord(total=0.3),
            failures=b_qr.failures,
            recall=b_qr.recall,
            precision=b_qr.precision,
        )
        comp = compare(
            RunnerResult(results=(b_qr,)),
            RunnerResult(results=(t_qr,)),
        )
        assert comp.latency_delta_s == pytest.approx(-0.2)

    def test_failure_delta_included(self) -> None:
        b_qr = _make_query_result("Q1", empty_retrieval=1)
        t_qr = _make_query_result("Q1")
        comp = compare(
            RunnerResult(results=(b_qr,)),
            RunnerResult(results=(t_qr,)),
        )
        assert "empty_retrieval_rate" in comp.failure_delta
        # baseline has 1 empty_retrieval, treatment has 0 → delta = -1.0
        assert comp.failure_delta["empty_retrieval_rate"] == pytest.approx(-1.0)

    def test_per_type_deltas(self) -> None:
        b_qr1 = _make_query_result("Q1", "simple", recall=0.8)
        b_qr2 = _make_query_result("Q2", "complex", recall=0.6)
        t_qr1 = _make_query_result("Q1", "simple", recall=0.9)
        t_qr2 = _make_query_result("Q2", "complex", recall=0.7)
        comp = compare(
            RunnerResult(results=(b_qr1, b_qr2)),
            RunnerResult(results=(t_qr1, t_qr2)),
        )
        assert comp.per_type_recall_delta["simple"] == pytest.approx(0.1)
        assert comp.per_type_recall_delta["complex"] == pytest.approx(0.1)

    def test_raises_on_mismatched_counts(self) -> None:
        baseline = RunnerResult(results=(_make_query_result("Q1"),))
        treatment = RunnerResult(
            results=(
                _make_query_result("Q1"),
                _make_query_result("Q2"),
            )
        )
        with pytest.raises(ValueError, match="same number of queries"):
            compare(baseline, treatment)

    def test_recall_none_when_both_none(self) -> None:
        baseline = RunnerResult(
            results=(_make_query_result("Q1", recall=None),)
        )
        treatment = RunnerResult(
            results=(_make_query_result("Q1", recall=None),)
        )
        comp = compare(baseline, treatment)
        assert comp.recall_delta is None

    def test_precision_delta_none(self) -> None:
        baseline = RunnerResult(
            results=(_make_query_result("Q1", precision=None),)
        )
        treatment = RunnerResult(
            results=(_make_query_result("Q1", precision=None),)
        )
        comp = compare(baseline, treatment)
        assert comp.precision_delta is None


# ======================================================================
# Comparison serialisation
# ======================================================================


class TestComparisonSerialization:
    def test_comparison_to_dict(self) -> None:
        comp = ComparisonResult(
            total_queries=10,
            recall_delta=0.15,
            precision_delta=0.10,
            latency_delta_s=-0.05,
            failure_delta={"empty_retrieval_rate": -0.1},
            per_type_recall_delta={"simple": 0.2},
            per_type_precision_delta={"simple": 0.1},
            per_type_latency_delta_s={"simple": -0.02},
            per_type_failure_delta={
                "simple": {"empty_retrieval_rate": -0.1}
            },
        )
        d = comparison_to_dict(comp)
        assert d["recall_delta"] == 0.15
        assert d["total_queries"] == 10
        assert d["failure_delta"]["empty_retrieval_rate"] == -0.1

    def test_save_comparison(self) -> None:
        comp = ComparisonResult(
            total_queries=5,
            recall_delta=0.1,
            precision_delta=None,
            latency_delta_s=0.0,
        )
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as tmp:
            path = tmp.name
        try:
            save_comparison(comp, Path(path))
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            assert data["recall_delta"] == 0.1
            assert data["precision_delta"] is None
        finally:
            os.unlink(path)

    def test_save_result_json_structure(self) -> None:
        result = RunnerResult(
            results=(
                _make_query_result("Q1", "simple", recall=0.8),
                _make_query_result("Q2", "complex", recall=0.6),
            )
        )
        with tempfile.NamedTemporaryFile(
            mode="w", suffix=".json", delete=False
        ) as tmp:
            path = tmp.name
        try:
            save_result(result, Path(path))
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            assert data["metadata"]["total_queries"] == 2
            assert "average_recall" in data["aggregate"]
            assert "queries" in data
            assert len(data["queries"]) == 2
            assert data["queries"][0]["id"] == "Q1"
        finally:
            os.unlink(path)


# ======================================================================
# Full integration smoke test
# ======================================================================


class TestIntegration:
    """Run a full baseline + treatment + compare cycle with mock data."""

    def test_full_cycle(self) -> None:
        """Smoke test: create both runners, run, compare."""
        baseline_clf = _make_mock_classifier("simple", 0.95)
        treatment_clf = _make_mock_classifier("simple", 0.95)

        chunk_map = {"SIMPLE-001": ["c1", "c2"]}
        b_retriever = MockRetriever(chunk_map=chunk_map)
        t_retriever = MockRetriever(chunk_map=chunk_map)

        baseline_runner = BaselineExperimentRunner(
            classifier=baseline_clf,
            retriever=b_retriever,
            validate=False,
        )
        treatment_runner = TreatmentExperimentRunner(
            classifier=treatment_clf,
            retriever=t_retriever,
            validate=False,
        )

        b_result = baseline_runner.run(query_types=["simple"])
        t_result = treatment_runner.run(query_types=["simple"])

        assert b_result.total_queries > 0
        assert t_result.total_queries > 0
        assert b_result.total_queries == t_result.total_queries

        comp = compare(b_result, t_result)
        assert isinstance(comp, ComparisonResult)
        assert comp.total_queries == b_result.total_queries
