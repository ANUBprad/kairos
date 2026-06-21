"""Tests for the ablation framework (Phase 6A)."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from benchmarks.dataset.loader import QueryEntry
from benchmarks.metrics import FailureRecord, LatencyRecord
from benchmarks.runner import QueryResult, RunnerResult
from intelligence.ablation import (
    BASELINE,
    FULL_TREATMENT,
    PLANNER_CALIBRATION,
    PLANNER_ONLY,
    PLANNER_OPTIMIZATION,
    AblationComparison,
    AblationConfig,
    AblationRunner,
    compare_multiple,
    compare_runs,
    generate_ablation_matrix,
    generate_ablation_report,
)
from intelligence.planner import PlannerDecision


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def simple_config() -> AblationConfig:
    return AblationConfig(planner_enabled=True, label="Planner Only")


@pytest.fixture
def full_config() -> AblationConfig:
    return FULL_TREATMENT


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
def mock_retriever() -> MagicMock:
    ret = MagicMock()
    ret.retrieve.return_value = ("chunk_a", "chunk_b")
    return ret


@pytest.fixture
def sample_entries() -> list[QueryEntry]:
    return [
        QueryEntry(
            id="q001",
            text="What is an AI system?",
            query_type="simple",
            expected_chunks=["chunk_a"],
            domain=None,
        ),
        QueryEntry(
            id="q002",
            text="Explain high-risk classification",
            query_type="complex",
            expected_chunks=["chunk_b"],
            domain=None,
        ),
        QueryEntry(
            id="q003",
            text="Trace conformity assessment",
            query_type="multi_hop",
            expected_chunks=["chunk_c"],
            domain=None,
        ),
    ]


@pytest.fixture
def sample_runner_result() -> RunnerResult:
    results = []
    for i, qtype in enumerate(["simple", "complex", "multi_hop"]):
        qid = f"q00{i + 1}"
        results.append(QueryResult(
            entry=QueryEntry(id=qid, text=f"query {i}", query_type=qtype),
            planner_decision=PlannerDecision(
                config={"retrieval_type": "HYBRID", "top_k": 3, "rerank": False, "decompose": False},
                confidence=0.9, query_type=qtype,
            ),
            retrieved_chunks=("a", "b"),
            latency=LatencyRecord(total=0.1),
            failures=FailureRecord(total_queries=1),
            recall=0.8,
            precision=0.7,
        ))
    return RunnerResult(results=tuple(results))


# ======================================================================
# AblationConfig
# ======================================================================


class TestAblationConfig:
    def test_defaults_all_false(self) -> None:
        cfg = AblationConfig()
        assert not cfg.planner_enabled
        assert not cfg.calibration_enabled
        assert not cfg.optimization_enabled
        assert not cfg.feedback_enabled

    def test_auto_label_none(self) -> None:
        cfg = AblationConfig()
        assert cfg.label == "None"

    def test_auto_label_planner(self) -> None:
        cfg = AblationConfig(planner_enabled=True)
        assert cfg.label == "P"

    def test_auto_label_all(self) -> None:
        cfg = AblationConfig(
            planner_enabled=True, calibration_enabled=True,
            optimization_enabled=True, feedback_enabled=True,
        )
        assert cfg.label == "P+C+O+F"

    def test_custom_label(self) -> None:
        cfg = AblationConfig(label="My Custom Config")
        assert cfg.label == "My Custom Config"

    def test_enabled_components_empty(self) -> None:
        cfg = AblationConfig()
        assert cfg.enabled_components == []

    def test_enabled_components_all(self) -> None:
        cfg = FULL_TREATMENT
        assert cfg.enabled_components == ["planner", "calibration", "optimization", "feedback"]

    def test_enabled_components_partial(self) -> None:
        cfg = PLANNER_CALIBRATION
        assert cfg.enabled_components == ["planner", "calibration"]

    def test_to_dict(self) -> None:
        cfg = FULL_TREATMENT
        d = cfg.to_dict()
        assert d["planner_enabled"] is True
        assert d["calibration_enabled"] is True
        assert d["optimization_enabled"] is True
        assert d["feedback_enabled"] is True

    def test_frozen(self) -> None:
        cfg = AblationConfig()
        with pytest.raises(Exception):
            cfg.planner_enabled = True  # type: ignore[misc]

    def test_prebuilt_baseline(self) -> None:
        assert not BASELINE.planner_enabled
        assert BASELINE.label == "Baseline"

    def test_prebuilt_full_treatment(self) -> None:
        assert FULL_TREATMENT.planner_enabled
        assert FULL_TREATMENT.calibration_enabled
        assert FULL_TREATMENT.optimization_enabled
        assert FULL_TREATMENT.feedback_enabled


# ======================================================================
# AblationRunner
# ======================================================================


class TestAblationRunner:
    def test_creates_with_config(self, simple_config, mock_classifier, mock_retriever) -> None:
        runner = AblationRunner(simple_config, mock_classifier, mock_retriever)
        assert runner.config == simple_config

    def test_builds_static_planner(self, mock_classifier, mock_retriever, sample_entries) -> None:
        cfg = AblationConfig(planner_enabled=False)
        runner = AblationRunner(cfg, mock_classifier, mock_retriever)
        result = runner.run(sample_entries)
        assert result.total_queries == 3

    def test_builds_retrieval_planner(self, mock_classifier, mock_retriever, sample_entries) -> None:
        cfg = AblationConfig(planner_enabled=True)
        runner = AblationRunner(cfg, mock_classifier, mock_retriever)
        result = runner.run(sample_entries)
        assert result.total_queries == 3

    def test_planner_with_calibrator(self, mock_classifier, mock_retriever, sample_entries) -> None:
        calibrator = MagicMock()
        calibrator.fitted = True
        calibrator.calibrate.return_value = type("R", (), {
            "calibrated_confidence": 0.85, "method": "platt",
            "delta": -0.05,
        })()
        cfg = PLANNER_CALIBRATION
        runner = AblationRunner(cfg, mock_classifier, mock_retriever, calibrator=calibrator)
        result = runner.run(sample_entries)
        assert result.total_queries == 3

    def test_planner_with_optimizer(self, mock_classifier, mock_retriever, sample_entries) -> None:
        optimizer = MagicMock()
        optimizer.fitted = True
        optimizer.recommend_budget.return_value = type("R", (), {
            "recommended_top_k": 8, "recommended_rerank": True,
            "recommended_decompose": False,
            "expected_success": 0.9, "expected_latency": 100.0,
            "source": "optimizer",
        })()
        cfg = PLANNER_OPTIMIZATION
        runner = AblationRunner(cfg, mock_classifier, mock_retriever, optimizer=optimizer)
        result = runner.run(sample_entries)
        assert result.total_queries == 3

    def test_planner_with_feedback(self, mock_classifier, mock_retriever, sample_entries) -> None:
        adjuster = MagicMock()
        adjuster.fitted = True
        adjuster.adjust_config.return_value = (5, True, False)
        cfg = AblationConfig(planner_enabled=True, feedback_enabled=True, label="Feedback")
        runner = AblationRunner(cfg, mock_classifier, mock_retriever, feedback_adjuster=adjuster)
        result = runner.run(sample_entries)
        assert result.total_queries == 3

    def test_full_treatment(self, mock_classifier, mock_retriever, sample_entries) -> None:
        calibrator = MagicMock()
        calibrator.fitted = True
        calibrator.calibrate.return_value = type("R", (), {
            "calibrated_confidence": 0.85, "method": "platt", "delta": -0.05,
        })()
        optimizer = MagicMock()
        optimizer.fitted = True
        optimizer.recommend_budget.return_value = type("R", (), {
            "recommended_top_k": 8, "recommended_rerank": True,
            "recommended_decompose": False,
            "expected_success": 0.9, "expected_latency": 100.0, "source": "optimizer",
        })()
        adjuster = MagicMock()
        adjuster.fitted = True
        adjuster.adjust_config.return_value = (5, True, False)
        cfg = FULL_TREATMENT
        runner = AblationRunner(cfg, mock_classifier, mock_retriever,
                                calibrator=calibrator, optimizer=optimizer,
                                feedback_adjuster=adjuster)
        result = runner.run(sample_entries)
        assert result.total_queries == 3

    def test_empty_entries(self, mock_classifier, mock_retriever) -> None:
        runner = AblationRunner(BASELINE, mock_classifier, mock_retriever)
        result = runner.run([])
        assert result.total_queries == 0

    def test_returns_runner_result(self, mock_classifier, mock_retriever, sample_entries) -> None:
        runner = AblationRunner(PLANNER_ONLY, mock_classifier, mock_retriever)
        result = runner.run(sample_entries)
        assert isinstance(result, RunnerResult)

    def test_run_on_dataset(self, mock_classifier, mock_retriever) -> None:
        runner = AblationRunner(BASELINE, mock_classifier, mock_retriever)
        result = runner.run_on_dataset(query_types=["simple"])
        assert result.total_queries == 10
        assert isinstance(result, RunnerResult)

    def test_run_on_dataset_filtered(self, mock_classifier, mock_retriever) -> None:
        runner = AblationRunner(BASELINE, mock_classifier, mock_retriever)
        result = runner.run_on_dataset(query_types=["multi_hop"])
        assert result.total_queries == 10

    def test_run_on_dataset_all(self, mock_classifier, mock_retriever) -> None:
        runner = AblationRunner(BASELINE, mock_classifier, mock_retriever)
        result = runner.run_on_dataset()
        assert result.total_queries == 30


# ======================================================================
# AblationComparison & compare_runs
# ======================================================================


class TestCompareRuns:
    def test_identical_runs(self, sample_runner_result) -> None:
        comp = compare_runs(sample_runner_result, sample_runner_result)
        assert comp.recall_delta == 0.0
        assert comp.precision_delta == 0.0
        assert abs(comp.latency_delta_ms) < 1e-9
        assert comp.total_queries == 3

    def test_improved_recall(self) -> None:
        baseline = _make_result(recall=0.5, precision=0.5)
        treatment = _make_result(recall=0.8, precision=0.7)
        comp = compare_runs(baseline, treatment)
        assert comp.recall_delta == pytest.approx(0.3)
        assert comp.precision_delta == pytest.approx(0.2)

    def test_degraded_latency(self) -> None:
        baseline = _make_result(latency_s=0.1)
        treatment = _make_result(latency_s=0.3)
        comp = compare_runs(baseline, treatment)
        assert comp.latency_delta_ms == pytest.approx(200.0)

    def test_mismatched_queries(self) -> None:
        r1 = _make_result(n=3)
        r2 = _make_result(n=5)
        with pytest.raises(ValueError):
            compare_runs(r1, r2)

    def test_custom_labels(self, sample_runner_result) -> None:
        comp = compare_runs(sample_runner_result, sample_runner_result,
                            baseline_label="Base", treatment_label="Full")
        assert comp.baseline_label == "Base"
        assert comp.treatment_label == "Full"

    def test_metadata_present(self, sample_runner_result) -> None:
        comp = compare_runs(sample_runner_result, sample_runner_result)
        assert "generated_at" in comp.metadata

    def test_all_none_recall_precision(self) -> None:
        baseline = _make_result(recall=None, precision=None)
        treatment = _make_result(recall=None, precision=None)
        comp = compare_runs(baseline, treatment)
        assert comp.recall_delta is None
        assert comp.precision_delta is None


class TestCompareMultiple:
    def test_empty(self) -> None:
        assert compare_multiple({}) == []

    def test_single(self) -> None:
        r = _make_result()
        assert compare_multiple({"Base": r}) == []

    def test_two(self) -> None:
        base = _make_result(recall=0.5)
        treatment = _make_result(recall=0.8)
        comps = compare_multiple({"Base": base, "Full": treatment})
        assert len(comps) == 1
        assert comps[0].recall_delta == pytest.approx(0.3)

    def test_three(self) -> None:
        base = _make_result(recall=0.5)
        opt = _make_result(recall=0.7)
        full = _make_result(recall=0.9)
        comps = compare_multiple({"Base": base, "Opt": opt, "Full": full})
        assert len(comps) == 2
        assert comps[0].recall_delta == pytest.approx(0.2)
        assert comps[1].recall_delta == pytest.approx(0.4)

    def test_first_is_baseline(self) -> None:
        base = _make_result(recall=0.3)
        a = _make_result(recall=0.6)
        b = _make_result(recall=0.9)
        comps = compare_multiple({"Base": base, "A": a, "B": b})
        assert comps[0].baseline_label == "Base"
        assert comps[0].treatment_label == "A"


class TestReportGeneration:
    def test_generate_report(self) -> None:
        base = _make_result(recall=0.5, precision=0.4)
        treat = _make_result(recall=0.8, precision=0.7)
        comp = compare_runs(base, treat, "Base", "Full")
        report = generate_ablation_report([comp])
        assert "Ablation Study Report" in report
        assert "Full vs Base" in report
        assert "Recall" in report
        assert "+0.30%" in report

    def test_report_empty(self) -> None:
        report = generate_ablation_report([], title="Empty")
        assert "Empty" in report

    def test_matrix(self) -> None:
        base = _make_result(recall=0.5)
        opt = _make_result(recall=0.7)
        full = _make_result(recall=0.9)
        comps = compare_multiple({"Base": base, "Opt": opt, "Full": full})
        matrix = generate_ablation_matrix(comps)
        assert "Ablation Matrix" in matrix
        assert "Opt" in matrix
        assert "Full" in matrix
        assert "+0.20%" in matrix

    def test_matrix_empty(self) -> None:
        assert generate_ablation_matrix([]) == ""

    def test_report_with_per_type(self) -> None:
        base = _make_result(recall=0.5, qtypes=["simple", "complex"])
        treat = _make_result(recall=0.7, qtypes=["simple", "complex"])
        comp = compare_runs(base, treat)
        report = generate_ablation_report([comp])
        assert "Per-Type Recall" in report
        assert "simple" in report


# ======================================================================
# Helper: build RunnerResult with controlled metrics
# ======================================================================


def _make_result(
    n: int = 3,
    recall: float | None = 0.8,
    precision: float | None = 0.7,
    latency_s: float = 0.1,
    qtypes: list[str] | None = None,
) -> RunnerResult:
    pool = qtypes or ["simple", "complex", "multi_hop"]
    results = []
    for i in range(n):
        qt = pool[i % len(pool)]
        qid = f"q{i:03d}"
        results.append(QueryResult(
            entry=QueryEntry(
                id=qid, text=f"query {i}", query_type=qt,
                expected_chunks=["chunk_a"],
            ),
            planner_decision=PlannerDecision(
                config={}, confidence=0.9, query_type=qt,
            ),
            retrieved_chunks=("a", "b"),
            latency=LatencyRecord(total=latency_s),
            failures=FailureRecord(total_queries=1),
            recall=recall,
            precision=precision,
        ))
    return RunnerResult(results=tuple(results))
