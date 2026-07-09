"""Tests for the experiment tracking platform (Phase 6B)."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock

import pytest

from intelligence.experiments import (
    ExperimentRun,
    ExperimentMetrics,
    ExperimentParameters,
    ExperimentStatus,
    ExperimentRegistry,
    ExperimentTracker,
    ExperimentStore,
    compare_runs,
    RunComparison,
)


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def tmp_store(tmp_path: Path) -> ExperimentStore:
    return ExperimentStore(base_dir=str(tmp_path))


@pytest.fixture
def tmp_registry(tmp_store: ExperimentStore) -> ExperimentRegistry:
    return ExperimentRegistry(store=tmp_store)


@pytest.fixture
def sample_run() -> ExperimentRun:
    return ExperimentRun(
        name="test-run",
        description="A test experiment run",
        phase="ablation",
        status=ExperimentStatus.COMPLETED,
        tags={"dataset": "eu_ai_act"},
        metrics=ExperimentMetrics(
            recall=0.85,
            precision=0.72,
            latency_ms=198.2,
            success_rate=0.88,
        ),
        parameters=ExperimentParameters(
            planner_enabled=True,
            calibration_enabled=False,
            dataset_name="eu_ai_act",
        ),
    )


@pytest.fixture
def sample_result() -> object:
    """Mock a RunnerResult with known metrics."""
    result = MagicMock()
    result.average_recall.return_value = 0.85
    result.average_precision.return_value = 0.72

    lat = MagicMock()
    lat.total = 0.1982
    result.average_latency.return_value = lat

    result.total_queries = 30

    fails = MagicMock()
    fails.timeout = 1
    fails.empty_retrieval = 2
    fails.planner_fallback = 3
    result.aggregated_failures.return_value = fails
    return result


# ======================================================================
# ExperimentStatus
# ======================================================================


class TestExperimentStatus:
    def test_values(self) -> None:
        assert ExperimentStatus.RUNNING.value == "RUNNING"
        assert ExperimentStatus.COMPLETED.value == "COMPLETED"
        assert ExperimentStatus.FAILED.value == "FAILED"
        assert ExperimentStatus.ABORTED.value == "ABORTED"

    def test_all_members(self) -> None:
        assert len(ExperimentStatus) == 4


# ======================================================================
# ExperimentMetrics
# ======================================================================


class TestExperimentMetrics:
    def test_defaults_all_none(self) -> None:
        m = ExperimentMetrics()
        assert m.precision is None
        assert m.recall is None
        assert m.latency_ms is None

    def test_to_dict_omits_none(self) -> None:
        m = ExperimentMetrics(recall=0.8)
        d = m.to_dict()
        assert d["recall"] == 0.8
        assert "precision" not in d
        assert "latency_ms" not in d

    def test_to_dict_includes_extra(self) -> None:
        m = ExperimentMetrics(extra={"custom_metric": 42.0})
        d = m.to_dict()
        assert d["custom_metric"] == 42.0

    def test_roundtrip(self) -> None:
        m = ExperimentMetrics(
            recall=0.8,
            precision=0.7,
            latency_ms=150.0,
            success_rate=0.9,
            fallback_rate=0.05,
            extra={"bleu": 0.34},
        )
        d = m.to_dict()
        m2 = ExperimentMetrics.from_dict(d)
        assert m2.recall == 0.8
        assert m2.precision == 0.7
        assert m2.extra["bleu"] == 0.34

    def test_from_dict_unknown_becomes_extra(self) -> None:
        d = {"recall": 0.9, "novel_metric": 0.5}
        m = ExperimentMetrics.from_dict(d)
        assert m.recall == 0.9
        assert m.extra["novel_metric"] == 0.5

    def test_frozen(self) -> None:
        m = ExperimentMetrics(recall=0.5)
        with pytest.raises(AttributeError):
            m.recall = 0.6  # type: ignore[misc]


# ======================================================================
# ExperimentParameters
# ======================================================================


class TestExperimentParameters:
    def test_defaults(self) -> None:
        p = ExperimentParameters()
        assert not p.planner_enabled
        assert p.dataset_name == ""

    def test_to_dict(self) -> None:
        p = ExperimentParameters(
            planner_enabled=True,
            dataset_name="test",
        )
        d = p.to_dict()
        assert d["planner_enabled"] is True
        assert d["dataset_name"] == "test"

    def test_to_dict_includes_extra(self) -> None:
        p = ExperimentParameters(extra={"custom_param": "value"})
        d = p.to_dict()
        assert d["custom_param"] == "value"

    def test_roundtrip(self) -> None:
        p = ExperimentParameters(
            planner_enabled=True,
            calibration_enabled=False,
            dataset_name="eu_ai_act",
            extra={"embeddings": "text-embedding-3"},
        )
        d = p.to_dict()
        p2 = ExperimentParameters.from_dict(d)
        assert p2.planner_enabled is True
        assert p2.dataset_name == "eu_ai_act"
        assert p2.extra["embeddings"] == "text-embedding-3"

    def test_frozen(self) -> None:
        p = ExperimentParameters()
        with pytest.raises(AttributeError):
            p.planner_enabled = True  # type: ignore[misc]


# ======================================================================
# ExperimentRun
# ======================================================================


class TestExperimentRun:
    def test_auto_id_and_timestamp(self) -> None:
        run = ExperimentRun(name="auto")
        assert len(run.run_id) == 12
        assert run.timestamp != ""

    def test_default_status_running(self) -> None:
        run = ExperimentRun()
        assert run.status == ExperimentStatus.RUNNING

    def test_to_dict_roundtrip(self) -> None:
        run = ExperimentRun(
            run_id="abc123",
            name="test",
            phase="ablation",
            status=ExperimentStatus.COMPLETED,
            metrics=ExperimentMetrics(recall=0.9),
            parameters=ExperimentParameters(planner_enabled=True),
            tags={"env": "ci"},
            artifact_paths=["models/test.json"],
        )
        d = run.to_dict()
        run2 = ExperimentRun.from_dict(d)
        assert run2.run_id == "abc123"
        assert run2.name == "test"
        assert run2.status == ExperimentStatus.COMPLETED
        assert run2.metrics.recall == 0.9
        assert run2.parameters.planner_enabled is True
        assert run2.tags["env"] == "ci"
        assert run2.artifact_paths == ["models/test.json"]

    def test_from_dict_defaults(self) -> None:
        d = {"run_id": "x1"}
        run = ExperimentRun.from_dict(d)
        assert run.run_id == "x1"
        assert run.status == ExperimentStatus.RUNNING

    def test_auto_id_only_if_empty(self) -> None:
        run = ExperimentRun(run_id="custom-id")
        assert run.run_id == "custom-id"


# ======================================================================
# ExperimentStore (persistence)
# ======================================================================


class TestExperimentStore:
    def test_save_and_load(self, tmp_store: ExperimentStore) -> None:
        run = ExperimentRun(name="stored")
        run_id = tmp_store.save_run(run)
        loaded = tmp_store.load_run(run_id)
        assert loaded is not None
        assert loaded.run_id == run_id
        assert loaded.name == "stored"

    def test_load_nonexistent(self, tmp_store: ExperimentStore) -> None:
        assert tmp_store.load_run("nonexistent") is None

    def test_delete_existing(self, tmp_store: ExperimentStore) -> None:
        run = ExperimentRun(name="to-delete")
        run_id = tmp_store.save_run(run)
        assert tmp_store.delete_run(run_id) is True
        assert tmp_store.load_run(run_id) is None

    def test_delete_nonexistent(self, tmp_store: ExperimentStore) -> None:
        assert tmp_store.delete_run("nonexistent") is False

    def test_list_run_ids(self, tmp_store: ExperimentStore) -> None:
        r1 = ExperimentRun(name="a")
        r2 = ExperimentRun(name="b")
        tmp_store.save_run(r1)
        tmp_store.save_run(r2)
        ids = tmp_store.list_run_ids()
        assert len(ids) == 2
        assert r1.run_id in ids
        assert r2.run_id in ids

    def test_registry_metadata(self, tmp_store: ExperimentStore) -> None:
        tmp_store.save_registry_metadata({"version": 1})
        meta = tmp_store.load_registry_metadata()
        assert meta["version"] == 1

    def test_registry_metadata_default(self, tmp_store: ExperimentStore) -> None:
        assert tmp_store.load_registry_metadata() == {}

    def test_clear(self, tmp_store: ExperimentStore) -> None:
        tmp_store.save_run(ExperimentRun(name="a"))
        tmp_store.clear()
        assert tmp_store.list_run_ids() == []

    def test_directory_created(self, tmp_path: Path) -> None:
        d = tmp_path / "nested" / "experiments"
        ExperimentStore(base_dir=str(d))
        assert d.is_dir()

    def test_isolation(self, tmp_path: Path) -> None:
        """Each store instance uses its own directory."""
        d1 = tmp_path / "s1"
        d2 = tmp_path / "s2"
        s1 = ExperimentStore(base_dir=str(d1))
        s2 = ExperimentStore(base_dir=str(d2))
        rid = s1.save_run(ExperimentRun(name="isolated"))
        assert s2.load_run(rid) is None


# ======================================================================
# ExperimentRegistry
# ======================================================================


class TestExperimentRegistry:
    def test_register_and_get(self, tmp_registry: ExperimentRegistry) -> None:
        run = ExperimentRun(name="registered")
        rid = tmp_registry.register_run(run)
        loaded = tmp_registry.get_run(rid)
        assert loaded is not None
        assert loaded.name == "registered"

    def test_list_runs_empty(self, tmp_registry: ExperimentRegistry) -> None:
        assert tmp_registry.list_runs() == []

    def test_list_runs_sorts_by_timestamp(
        self, tmp_registry: ExperimentRegistry
    ) -> None:
        r1 = ExperimentRun(name="first", timestamp="2020-01-01T00:00:00")
        r2 = ExperimentRun(name="second", timestamp="2020-01-02T00:00:00")
        tmp_registry.register_run(r1)
        tmp_registry.register_run(r2)
        runs = tmp_registry.list_runs()
        assert runs[0].name == "second"
        assert runs[1].name == "first"

    def test_delete_run(self, tmp_registry: ExperimentRegistry) -> None:
        rid = tmp_registry.register_run(ExperimentRun(name="del"))
        assert tmp_registry.delete_run(rid) is True
        assert tmp_registry.get_run(rid) is None

    def test_delete_nonexistent(self, tmp_registry: ExperimentRegistry) -> None:
        assert tmp_registry.delete_run("nope") is False

    def test_best_run(self, tmp_registry: ExperimentRegistry) -> None:
        r1 = ExperimentRun(
            name="low",
            status=ExperimentStatus.COMPLETED,
            metrics=ExperimentMetrics(recall=0.5),
        )
        r2 = ExperimentRun(
            name="high",
            status=ExperimentStatus.COMPLETED,
            metrics=ExperimentMetrics(recall=0.9),
        )
        tmp_registry.register_run(r1)
        tmp_registry.register_run(r2)
        best = tmp_registry.best_run(metric="recall")
        assert best is not None
        assert best.name == "high"

    def test_best_run_skips_non_completed(
        self, tmp_registry: ExperimentRegistry
    ) -> None:
        running = ExperimentRun(
            name="running",
            status=ExperimentStatus.RUNNING,
            metrics=ExperimentMetrics(recall=0.99),
        )
        completed = ExperimentRun(
            name="completed",
            status=ExperimentStatus.COMPLETED,
            metrics=ExperimentMetrics(recall=0.5),
        )
        tmp_registry.register_run(running)
        tmp_registry.register_run(completed)
        best = tmp_registry.best_run(metric="recall")
        assert best is not None
        assert best.name == "completed"

    def test_best_run_by_phase(self, tmp_registry: ExperimentRegistry) -> None:
        r1 = ExperimentRun(
            name="a",
            phase="ablation",
            status=ExperimentStatus.COMPLETED,
            metrics=ExperimentMetrics(recall=0.8),
        )
        r2 = ExperimentRun(
            name="b",
            phase="calibration",
            status=ExperimentStatus.COMPLETED,
            metrics=ExperimentMetrics(recall=0.9),
        )
        tmp_registry.register_run(r1)
        tmp_registry.register_run(r2)
        best = tmp_registry.best_run(metric="recall", phase="ablation")
        assert best is not None
        assert best.name == "a"

    def test_latest_run(self, tmp_registry: ExperimentRegistry) -> None:
        r1 = ExperimentRun(
            name="old",
            timestamp="2020-01-01T00:00:00",
            status=ExperimentStatus.COMPLETED,
        )
        r2 = ExperimentRun(
            name="new",
            timestamp="2020-01-02T00:00:00",
            status=ExperimentStatus.COMPLETED,
        )
        tmp_registry.register_run(r1)
        tmp_registry.register_run(r2)
        latest = tmp_registry.latest_run()
        assert latest is not None
        assert latest.name == "new"

    def test_latest_run_by_phase(self, tmp_registry: ExperimentRegistry) -> None:
        r1 = ExperimentRun(
            name="cal",
            phase="calibration",
            timestamp="2020-01-01T00:00:00",
            status=ExperimentStatus.COMPLETED,
        )
        r2 = ExperimentRun(
            name="abl",
            phase="ablation",
            timestamp="2020-01-02T00:00:00",
            status=ExperimentStatus.COMPLETED,
        )
        tmp_registry.register_run(r1)
        tmp_registry.register_run(r2)
        latest = tmp_registry.latest_run(phase="ablation")
        assert latest is not None
        assert latest.name == "abl"

    def test_runs_by_tag(self, tmp_registry: ExperimentRegistry) -> None:
        r1 = ExperimentRun(name="a", tags={"env": "test"})
        r2 = ExperimentRun(name="b", tags={"env": "prod"})
        tmp_registry.register_run(r1)
        tmp_registry.register_run(r2)
        results = tmp_registry.runs_by_tag("env", "test")
        assert len(results) == 1
        assert results[0].name == "a"

    def test_runs_by_phase(self, tmp_registry: ExperimentRegistry) -> None:
        r1 = ExperimentRun(name="a", phase="ablation")
        r2 = ExperimentRun(name="b", phase="calibration")
        tmp_registry.register_run(r1)
        tmp_registry.register_run(r2)
        results = tmp_registry.runs_by_phase("ablation")
        assert len(results) == 1
        assert results[0].name == "a"

    def test_best_run_empty(self, tmp_registry: ExperimentRegistry) -> None:
        assert tmp_registry.best_run(metric="recall") is None

    def test_latest_run_empty(self, tmp_registry: ExperimentRegistry) -> None:
        assert tmp_registry.latest_run() is None

    def test_best_run_nonexistent_metric(
        self, tmp_registry: ExperimentRegistry
    ) -> None:
        run = ExperimentRun(
            name="test",
            status=ExperimentStatus.COMPLETED,
            metrics=ExperimentMetrics(),
        )
        tmp_registry.register_run(run)
        assert tmp_registry.best_run(metric="nonexistent") is None


# ======================================================================
# ExperimentTracker
# ======================================================================


class TestExperimentTracker:
    def test_start_run_context(self, tmp_registry: ExperimentRegistry) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        with tracker.start_run(name="ctx-test") as run:
            assert run.status == ExperimentStatus.RUNNING
            assert tracker.current_run is run

        loaded = tmp_registry.get_run(run.run_id)
        assert loaded is not None
        assert loaded.status == ExperimentStatus.COMPLETED

    def test_no_active_run_raises(self) -> None:
        tracker = ExperimentTracker()
        with pytest.raises(RuntimeError, match="No active experiment run"):
            tracker.log_metric("recall", 0.5)

    def test_log_metric(self, tmp_registry: ExperimentRegistry) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        rid = ""
        with tracker.start_run(name="metrics") as run:
            rid = run.run_id
            tracker.log_metric("recall", 0.85)
            tracker.log_metric("latency_ms", 200.0)

        loaded = tmp_registry.get_run(rid)
        assert loaded is not None
        assert loaded.metrics.recall == 0.85
        assert loaded.metrics.latency_ms == 200.0

    def test_log_metrics_batch(self, tmp_registry: ExperimentRegistry) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        rid = ""
        with tracker.start_run(name="batch") as run:
            rid = run.run_id
            tracker.log_metrics(
                {
                    "recall": 0.8,
                    "precision": 0.7,
                    "nonexistent": None,
                }
            )

        loaded = tmp_registry.get_run(rid)
        assert loaded is not None
        assert loaded.metrics.recall == 0.8
        assert loaded.metrics.precision == 0.7

    def test_log_parameter(self, tmp_registry: ExperimentRegistry) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        rid = ""
        with tracker.start_run(name="params") as run:
            rid = run.run_id
            tracker.log_parameter("custom_key", "custom_value")

        loaded = tmp_registry.get_run(rid)
        assert loaded is not None
        assert loaded.parameters.extra["custom_key"] == "custom_value"

    def test_log_parameters_from_dict(self, tmp_registry: ExperimentRegistry) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        rid = ""
        with tracker.start_run(name="params-dict") as run:
            rid = run.run_id
            tracker.log_parameters_from_dict(
                {
                    "planner_enabled": True,
                    "dataset_name": "my_dataset",
                    "custom_param": "abc",
                }
            )

        loaded = tmp_registry.get_run(rid)
        assert loaded is not None
        assert loaded.parameters.planner_enabled is True
        assert loaded.parameters.dataset_name == "my_dataset"
        assert loaded.parameters.extra["custom_param"] == "abc"

    def test_log_artifact(self, tmp_registry: ExperimentRegistry) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        rid = ""
        with tracker.start_run(name="artifacts") as run:
            rid = run.run_id
            tracker.log_artifact("models/calibrator.json")

        loaded = tmp_registry.get_run(rid)
        assert loaded is not None
        assert "models/calibrator.json" in loaded.artifact_paths

    def test_context_failed_on_exception(
        self, tmp_registry: ExperimentRegistry
    ) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        with pytest.raises(ValueError):
            with tracker.start_run(name="fail"):
                raise ValueError("boom")

        # The run should still be persisted with FAILED status
        runs = tmp_registry.list_runs()
        assert len(runs) == 1
        assert runs[0].status == ExperimentStatus.FAILED

    def test_log_metrics_from_result(
        self, tmp_registry: ExperimentRegistry, sample_result
    ) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        rid = ""
        with tracker.start_run(name="result") as run:
            rid = run.run_id
            tracker.log_metrics_from_result(sample_result)

        loaded = tmp_registry.get_run(rid)
        assert loaded is not None
        assert loaded.metrics.avg_recall == 0.85
        assert loaded.metrics.avg_precision == 0.72
        assert loaded.metrics.latency_ms == pytest.approx(198.2, rel=1e-3)
        assert loaded.metrics.success_rate == pytest.approx(0.9, rel=1e-3)
        assert loaded.metrics.fallback_rate == pytest.approx(0.1, rel=1e-3)

    def test_log_metric_unknown_key_goes_to_extra(
        self, tmp_registry: ExperimentRegistry
    ) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        rid = ""
        with tracker.start_run(name="extra") as run:
            rid = run.run_id
            tracker.log_metric("custom_score", 0.95)

        loaded = tmp_registry.get_run(rid)
        assert loaded is not None
        assert loaded.metrics.extra["custom_score"] == 0.95

    def test_context_yields_run(self, tmp_registry: ExperimentRegistry) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        with tracker.start_run(name="yielded") as run:
            assert isinstance(run, ExperimentRun)
            assert run.name == "yielded"

    def test_current_run_property(self, tmp_registry: ExperimentRegistry) -> None:
        tracker = ExperimentTracker(registry=tmp_registry)
        assert tracker.current_run is None
        with tracker.start_run(name="prop"):
            assert tracker.current_run is not None
            assert tracker.current_run.name == "prop"
        assert tracker.current_run is None


# ======================================================================
# Experiment Comparison
# ======================================================================


class TestCompareRuns:
    def test_basic_deltas(self) -> None:
        baseline = ExperimentRun(
            metrics=ExperimentMetrics(recall=0.5, precision=0.4, latency_ms=200.0),
        )
        treatment = ExperimentRun(
            metrics=ExperimentMetrics(recall=0.8, precision=0.7, latency_ms=150.0),
        )
        comp = compare_runs(baseline, treatment)
        assert comp.recall_delta == pytest.approx(0.3)
        assert comp.precision_delta == pytest.approx(0.3)
        assert comp.latency_delta_ms == pytest.approx(-50.0)

    def test_negative_delta(self) -> None:
        base = ExperimentRun(metrics=ExperimentMetrics(success_rate=0.9))
        treat = ExperimentRun(metrics=ExperimentMetrics(success_rate=0.7))
        comp = compare_runs(base, treat)
        assert comp.success_rate_delta == pytest.approx(-0.2)

    def test_none_values(self) -> None:
        base = ExperimentRun(metrics=ExperimentMetrics())
        treat = ExperimentRun(metrics=ExperimentMetrics())
        comp = compare_runs(base, treat)
        assert comp.recall_delta is None
        assert comp.precision_delta is None

    def test_all_deltas(self) -> None:
        base = ExperimentRun(
            metrics=ExperimentMetrics(
                recall=0.5,
                precision=0.4,
                latency_ms=200.0,
                success_rate=0.8,
                fallback_rate=0.1,
                ece=0.2,
                mce=0.3,
                brier_score=0.15,
                score_lift=0.05,
            )
        )
        treat = ExperimentRun(
            metrics=ExperimentMetrics(
                recall=0.7,
                precision=0.6,
                latency_ms=150.0,
                success_rate=0.9,
                fallback_rate=0.05,
                ece=0.1,
                mce=0.2,
                brier_score=0.08,
                score_lift=0.12,
            )
        )
        comp = compare_runs(base, treat)
        assert comp.recall_delta == pytest.approx(0.2)
        assert comp.precision_delta == pytest.approx(0.2)
        assert comp.latency_delta_ms == pytest.approx(-50.0)
        assert comp.success_rate_delta == pytest.approx(0.1)
        assert comp.fallback_rate_delta == pytest.approx(-0.05)
        assert comp.ece_delta == pytest.approx(-0.1)
        assert comp.mce_delta == pytest.approx(-0.1)
        assert comp.brier_score_delta == pytest.approx(-0.07)
        assert comp.score_lift_delta == pytest.approx(0.07)

    def test_run_ids_in_comparison(self) -> None:
        base = ExperimentRun(run_id="base01", name="Base")
        treat = ExperimentRun(run_id="treat01", name="Treatment")
        comp = compare_runs(base, treat)
        assert comp.baseline_run_id == "base01"
        assert comp.treatment_run_id == "treat01"
        assert comp.baseline_name == "Base"
        assert comp.treatment_name == "Treatment"


class TestGenerateComparisonReport:
    def test_generates_markdown(self) -> None:
        comp = RunComparison(
            baseline_run_id="b1",
            treatment_run_id="t1",
            baseline_name="Base",
            treatment_name="Treat",
            recall_delta=0.3,
        )
        from intelligence.experiments.comparison import generate_comparison_report

        report = generate_comparison_report([comp])
        assert "Treat vs Base" in report
        assert "+0.3000" in report

    def test_empty_list(self) -> None:
        from intelligence.experiments.comparison import generate_comparison_report

        report = generate_comparison_report([], title="Empty")
        assert "# Empty" in report

    def test_none_formatted_as_na(self) -> None:
        comp = RunComparison(
            baseline_run_id="b1",
            treatment_run_id="t1",
        )
        from intelligence.experiments.comparison import generate_comparison_report

        report = generate_comparison_report([comp])
        assert "N/A" in report


class TestRanking:
    def test_ranking_order(self) -> None:
        from intelligence.experiments.comparison import compute_ranking

        r1 = ExperimentRun(name="worst", metrics=ExperimentMetrics(recall=0.3))
        r2 = ExperimentRun(name="best", metrics=ExperimentMetrics(recall=0.9))
        r3 = ExperimentRun(name="mid", metrics=ExperimentMetrics(recall=0.6))
        ranking = compute_ranking([r1, r2, r3], metric="recall")
        assert len(ranking) == 3
        assert ranking[0][0] == 1  # rank 1
        assert ranking[0][1].name == "best"
        assert ranking[1][1].name == "mid"
        assert ranking[2][1].name == "worst"

    def test_ranking_with_none(self) -> None:
        from intelligence.experiments.comparison import compute_ranking

        r1 = ExperimentRun(name="a", metrics=ExperimentMetrics(recall=0.5))
        r2 = ExperimentRun(name="b", metrics=ExperimentMetrics(recall=None))
        ranking = compute_ranking([r1, r2], metric="recall")
        assert len(ranking) == 2
        assert ranking[0][1].name == "a"  # has value, higher
        assert ranking[1][1].name == "b"  # None, lower

    def test_ranking_empty(self) -> None:
        from intelligence.experiments.comparison import compute_ranking

        assert compute_ranking([], metric="recall") == []


# ======================================================================
# Integration: AblationRunner with tracker
# ======================================================================


class TestAblationRunnerIntegration:
    def test_tracker_receives_metrics(self, tmp_registry: ExperimentRegistry) -> None:
        from intelligence.ablation import AblationRunner, AblationConfig

        config = AblationConfig(planner_enabled=False, label="Baseline")
        classifier = MagicMock()
        retriever = MagicMock()
        retriever.retrieve.return_value = ("a", "b")

        tracker = ExperimentTracker(registry=tmp_registry)
        runner = AblationRunner(config, classifier, retriever, tracker=tracker)

        from benchmarks.dataset.loader import QueryEntry

        entries = [
            QueryEntry(
                id="q1", text="test", query_type="simple", expected_chunks=["a"]
            ),
        ]
        runner.run(entries)

        runs = tmp_registry.list_runs()
        assert len(runs) >= 1
        loaded = runs[0]
        assert loaded.status == ExperimentStatus.COMPLETED
        assert loaded.phase == "ablation"
        assert loaded.parameters.planner_enabled is False

    def test_tracker_on_dataset(
        self,
        tmp_registry: ExperimentRegistry,
    ) -> None:
        from intelligence.ablation import AblationRunner, BASELINE

        classifier = MagicMock()
        retriever = MagicMock()
        retriever.retrieve.return_value = ("a", "b")

        tracker = ExperimentTracker(registry=tmp_registry)
        runner = AblationRunner(BASELINE, classifier, retriever, tracker=tracker)
        runner.run_on_dataset(query_types=["simple"])

        runs = tmp_registry.list_runs()
        assert len(runs) >= 1
        loaded = runs[0]
        assert loaded.status == ExperimentStatus.COMPLETED

    def test_no_tracker_no_error(self) -> None:
        from intelligence.ablation import AblationRunner, AblationConfig

        config = AblationConfig(planner_enabled=False)
        classifier = MagicMock()
        retriever = MagicMock()
        retriever.retrieve.return_value = ("a", "b")

        runner = AblationRunner(config, classifier, retriever, tracker=None)
        from benchmarks.dataset.loader import QueryEntry

        entries = [QueryEntry(id="q1", text="test", query_type="simple")]
        result = runner.run(entries)
        assert result.total_queries == 1


# ======================================================================
# Integration: Calibrator with tracker
# ======================================================================


class TestCalibratorIntegration:
    def test_tracker_receives_calibration_metrics(
        self,
        tmp_registry: ExperimentRegistry,
    ) -> None:
        import numpy as np
        from intelligence.calibration import ConfidenceCalibrator

        tracker = ExperimentTracker(registry=tmp_registry)
        calibrator = ConfidenceCalibrator(min_samples=5)

        confs = np.array([0.3, 0.4, 0.6, 0.7, 0.9])
        successes = np.array([0, 0, 1, 1, 1])

        with tracker.start_run(name="calibration-test") as run:
            calibrator.fit(confs, successes, tracker=tracker)

        loaded = tmp_registry.get_run(run.run_id)
        assert loaded is not None
        assert loaded.metrics.training_samples == 5
        assert loaded.metrics.ece is not None

    def test_no_tracker_no_error(self) -> None:
        import numpy as np
        from intelligence.calibration import ConfidenceCalibrator

        calibrator = ConfidenceCalibrator(min_samples=5)
        confs = np.array([0.3, 0.4, 0.6, 0.7, 0.9])
        successes = np.array([0, 0, 1, 1, 1])
        calibrator.fit(confs, successes)  # should not raise


# ======================================================================
# Integration: Retrainer with tracker
# ======================================================================


class TestRetrainerIntegration:
    def test_tracker_receives_retraining_metrics(
        self,
        tmp_registry: ExperimentRegistry,
        tmp_path: Path,
    ) -> None:
        from intelligence.retraining import BudgetRetrainer
        from intelligence.retraining.model_registry import ModelRegistry

        registry = ModelRegistry(registry_path=str(tmp_path / "registry.json"))
        retrainer = BudgetRetrainer(
            model_dir=str(tmp_path / "models"),
            registry=registry,
        )

        tracker = ExperimentTracker(registry=tmp_registry)
        records = [
            {
                "query_type": "simple",
                "confidence": 0.9,
                "retrieval_type": "HYBRID",
                "top_k": 5,
                "rerank": True,
                "decompose": False,
                "latency_ms": 100.0,
                "fallback_triggered": False,
                "accepted": True,
            },
            {
                "query_type": "simple",
                "confidence": 0.9,
                "retrieval_type": "HYBRID",
                "top_k": 5,
                "rerank": True,
                "decompose": False,
                "latency_ms": 120.0,
                "fallback_triggered": False,
                "accepted": True,
            },
        ]

        with tracker.start_run(name="retrain-test") as run:
            retrainer.train(records, version="v1", tracker=tracker)

        loaded = tmp_registry.get_run(run.run_id)
        assert loaded is not None
        assert loaded.metrics.training_samples == 2
        assert "models" in str(loaded.artifact_paths[0])

    def test_no_tracker_no_error(self, tmp_path: Path) -> None:
        from intelligence.retraining import BudgetRetrainer
        from intelligence.retraining.model_registry import ModelRegistry

        registry = ModelRegistry(registry_path=str(tmp_path / "registry.json"))
        retrainer = BudgetRetrainer(
            model_dir=str(tmp_path / "models"),
            registry=registry,
        )

        records = [
            {
                "query_type": "simple",
                "confidence": 0.9,
                "retrieval_type": "HYBRID",
                "top_k": 5,
                "rerank": True,
                "decompose": False,
                "latency_ms": 100.0,
                "fallback_triggered": False,
                "accepted": True,
            },
            {
                "query_type": "simple",
                "confidence": 0.9,
                "retrieval_type": "HYBRID",
                "top_k": 5,
                "rerank": True,
                "decompose": False,
                "latency_ms": 100.0,
                "fallback_triggered": False,
                "accepted": True,
            },
        ]
        result = retrainer.train(records, version="v1")
        assert result["version"] == "v1"
