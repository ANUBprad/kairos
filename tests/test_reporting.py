"""Tests for the research reporting framework (Phase 6E)."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from intelligence.ablation.comparison import AblationComparison
from intelligence.benchmarks.benchmark_result import BenchmarkResult, aggregate_results
from intelligence.experiments.models import (
    ExperimentMetrics,
    ExperimentRun,
    ExperimentStatus,
)
from intelligence.experiments.registry import ExperimentRegistry
from intelligence.experiments.persistence import ExperimentStore
from intelligence.reporting import (
    generate_full_report,
    generate_markdown_benchmark_report,
    generate_markdown_ablation_report,
    generate_markdown_statistical_report,
    generate_markdown_leaderboard_report,
    generate_html_report,
    rank_experiments,
    compute_composite_score,
    plot_metric_trend,
    plot_experiment_comparison,
    plot_benchmark_comparison,
    plot_ablation_impact,
    generate_experiment_manifest,
    generate_benchmark_manifest,
    generate_environment_snapshot,
)
from intelligence.statistics.reporting import ValidationResult
from intelligence.statistics.significance import SignificanceResult
from intelligence.statistics.confidence_intervals import ConfidenceInterval
from intelligence.statistics.effect_size import EffectSize


# ======================================================================
# Fixtures
# ======================================================================


@pytest.fixture
def sample_metrics() -> ExperimentMetrics:
    return ExperimentMetrics(
        recall=0.85,
        precision=0.72,
        latency_ms=145.0,
        success_rate=0.98,
        fallback_rate=0.05,
    )


@pytest.fixture
def sample_run(sample_metrics: ExperimentMetrics) -> ExperimentRun:
    return ExperimentRun(
        run_id="run-001",
        name="test-run",
        description="Test experiment",
        phase="ablation",
        status=ExperimentStatus.COMPLETED,
        metrics=sample_metrics,
        tags={"dataset": "test"},
        timestamp="2026-06-01T12:00:00",
    )


@pytest.fixture
def another_run() -> ExperimentRun:
    return ExperimentRun(
        run_id="run-002",
        name="baseline-run",
        phase="baseline",
        status=ExperimentStatus.COMPLETED,
        metrics=ExperimentMetrics(
            recall=0.80,
            precision=0.68,
            latency_ms=120.0,
            success_rate=0.97,
            fallback_rate=0.08,
        ),
        timestamp="2026-05-31T12:00:00",
    )


@pytest.fixture
def benchmark_result() -> BenchmarkResult:
    return BenchmarkResult(
        dataset_name="eu_ai_act",
        query_count=100,
        per_query_recall=[0.8, 0.9, 0.75] * 33 + [0.85],
        per_query_precision=[0.7, 0.8, 0.65] * 33 + [0.75],
        per_query_latency_ms=[100.0, 120.0, 90.0] * 33 + [110.0],
        metrics={
            "timeout_count": 2,
            "fallback_count": 5,
            "empty_retrieval_count": 1,
        },
    )


@pytest.fixture
def ablation_comparison() -> AblationComparison:
    return AblationComparison(
        baseline_label="no_rerank",
        treatment_label="with_rerank",
        total_queries=100,
        recall_delta=0.05,
        precision_delta=0.03,
        latency_delta_ms=15.0,
        success_rate_delta=0.01,
        fallback_rate_delta=-0.02,
    )


@pytest.fixture
def validation_result() -> ValidationResult:
    return ValidationResult(
        baseline_label="baseline",
        treatment_label="treatment",
        metric_name="recall",
        significance={
            "Paired t-test": SignificanceResult(
                statistic=-3.45,
                p_value=0.001,
                significant=True,
                alpha=0.05,
                method="paired-t",
                n=100,
            ),
            "Wilcoxon": SignificanceResult(
                statistic=120.0,
                p_value=0.003,
                significant=True,
                alpha=0.05,
                method="wilcoxon",
                n=100,
            ),
        },
        confidence_intervals={
            "baseline": ConfidenceInterval(
                lower_bound=0.71,
                upper_bound=0.79,
                confidence=0.95,
                method="t-distribution",
                n=100,
                mean=0.75,
                std_err=0.02,
            ),
            "treatment": ConfidenceInterval(
                lower_bound=0.76,
                upper_bound=0.84,
                confidence=0.95,
                method="t-distribution",
                n=100,
                mean=0.80,
                std_err=0.02,
            ),
        },
        effect_sizes={
            "Cohen's d": EffectSize(
                value=0.65,
                magnitude="medium",
                direction="treatment > baseline",
                method="cohens_d",
                n_baseline=100,
                n_treatment=100,
            ),
            "Cliff's delta": EffectSize(
                value=0.35,
                magnitude="medium",
                direction="treatment > baseline",
                method="cliffs_delta",
                n_baseline=100,
                n_treatment=100,
            ),
        },
        bootstrap=None,
        n_observations=100,
        is_significant=True,
        summary="Treatment significantly improves recall (p=0.001, d=0.65).",
    )


@pytest.fixture
def tmp_store(tmp_path: Path) -> ExperimentStore:
    return ExperimentStore(base_dir=str(tmp_path))


@pytest.fixture
def tmp_registry(tmp_store: ExperimentStore) -> ExperimentRegistry:
    return ExperimentRegistry(store=tmp_store)


@pytest.fixture
def populated_registry(
    tmp_registry: ExperimentRegistry,
    sample_run: ExperimentRun,
    another_run: ExperimentRun,
) -> ExperimentRegistry:
    tmp_registry.register_run(sample_run)
    tmp_registry.register_run(another_run)
    return tmp_registry


# ======================================================================
# Markdown Report Tests
# ======================================================================


class TestMarkdownBenchmarkReport:
    def test_empty_results(self):
        md = generate_markdown_benchmark_report([])
        assert "No benchmark results" in md

    def test_aggregate_table_present(self, benchmark_result: BenchmarkResult):
        md = generate_markdown_benchmark_report([benchmark_result])
        assert "Aggregate Summary" in md
        assert "Dataset" in md

    def test_per_dataset_section(self, benchmark_result: BenchmarkResult):
        md = generate_markdown_benchmark_report([benchmark_result])
        assert benchmark_result.dataset_name in md
        assert "Recall" in md
        assert "Precision" in md

    def test_custom_title(self, benchmark_result: BenchmarkResult):
        md = generate_markdown_benchmark_report(
            [benchmark_result], title="Custom Title"
        )
        assert "Custom Title" in md

    def test_multiple_results(self, benchmark_result: BenchmarkResult):
        b2 = BenchmarkResult(dataset_name="other_dataset", query_count=50)
        md = generate_markdown_benchmark_report([benchmark_result, b2])
        assert "other_dataset" in md
        assert benchmark_result.dataset_name in md

    def test_formats_percentages(self, benchmark_result: BenchmarkResult):
        md = generate_markdown_benchmark_report([benchmark_result])
        assert "%" in md

    def test_formats_latency(self, benchmark_result: BenchmarkResult):
        md = generate_markdown_benchmark_report([benchmark_result])
        assert "ms" in md


class TestMarkdownAblationReport:
    def test_empty_comparisons(self):
        md = generate_markdown_ablation_report([])
        assert "No ablation comparisons" in md

    def test_comparison_table(self, ablation_comparison: AblationComparison):
        md = generate_markdown_ablation_report([ablation_comparison])
        assert ablation_comparison.treatment_label in md
        assert ablation_comparison.baseline_label in md
        assert "Recall" in md
        assert "Better" in md

    def test_negative_delta_direction(self):
        comp = AblationComparison(
            baseline_label="base",
            treatment_label="treat",
            recall_delta=-0.05,
        )
        md = generate_markdown_ablation_report([comp])
        assert "Worse" in md

    def test_validation_included(
        self,
        ablation_comparison: AblationComparison,
        validation_result: ValidationResult,
    ):
        comp = AblationComparison(
            baseline_label=ablation_comparison.baseline_label,
            treatment_label=ablation_comparison.treatment_label,
            validation=validation_result,
        )
        md = generate_markdown_ablation_report([comp])
        assert "Statistical Validation" in md

    def test_custom_title(self, ablation_comparison: AblationComparison):
        md = generate_markdown_ablation_report(
            [ablation_comparison], title="Custom Ablation"
        )
        assert "Custom Ablation" in md

    def test_latency_delta_shown(self, ablation_comparison: AblationComparison):
        md = generate_markdown_ablation_report([ablation_comparison])
        assert "Latency" in md


class TestMarkdownStatisticalReport:
    def test_validation_fields(self, validation_result: ValidationResult):
        md = generate_markdown_statistical_report(validation_result)
        assert validation_result.metric_name in md
        assert "p-value" in md or "p_value" in md
        assert "Significance Tests" in md
        assert "Confidence Intervals" in md
        assert "Effect Sizes" in md

    def test_bootstrap_section(self, validation_result: ValidationResult):
        from intelligence.statistics.bootstrap import BootstrapResult

        validation_result.bootstrap = BootstrapResult(
            metric_name="recall",
            point_estimate=0.05,
            bias=0.001,
            std_error=0.015,
            ci_lower=0.02,
            ci_upper=0.08,
            resampled_values=[0.04, 0.06, 0.05],
            n_resamples=9999,
        )
        md = generate_markdown_statistical_report(validation_result)
        assert "Bootstrap" in md

    def test_custom_title(self, validation_result: ValidationResult):
        md = generate_markdown_statistical_report(validation_result, title="Stats")
        assert "Stats" in md


class TestMarkdownLeaderboardReport:
    def test_empty_rankings(self):
        md = generate_markdown_leaderboard_report([])
        assert "Leaderboard" in md

    def test_rankings_displayed(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        rankings = rank_experiments([sample_run, another_run])
        md = generate_markdown_leaderboard_report(rankings)
        assert "Rank" in md
        assert sample_run.name in md or sample_run.run_id in md

    def test_custom_title(self, sample_run: ExperimentRun):
        rankings = rank_experiments([sample_run])
        md = generate_markdown_leaderboard_report(rankings, title="My Board")
        assert "My Board" in md


# ======================================================================
# HTML Report Tests
# ======================================================================


class TestHtmlReport:
    def test_generates_html(self):
        html = generate_html_report("Test Title", "Some content")
        assert "<!DOCTYPE html>" in html
        assert "<title>Test Title</title>" in html
        assert "Some content" in html

    def test_styles_embedded(self):
        html = generate_html_report("Title", "content")
        assert "<style>" in html

    def test_footer_present(self):
        html = generate_html_report("Title", "content")
        assert "Kairos" in html

    def test_html_escapes_title(self):
        html = generate_html_report("<script>alert('xss')</script>", "content")
        assert "&lt;script&gt;" in html

    def test_tables_converted(self):
        md = "| H1 | H2 |\n| --- | --- |\n| A | B |"
        html = generate_html_report("Test", md)
        assert "<table>" in html
        assert "<th>H1</th>" in html or "<th>H1" in html
        assert "<td>A</td>" in html or "<td>A" in html


# ======================================================================
# Leaderboard Tests
# ======================================================================


class TestRankExperiments:
    def test_orders_by_recall_desc(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        rankings = rank_experiments([another_run, sample_run], metric="recall")
        assert rankings[0][1].run_id == "run-001"

    def test_orders_by_latency_asc(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        rankings = rank_experiments(
            [sample_run, another_run], metric="latency_ms", ascending=True
        )
        assert rankings[0][1].run_id == "run-002"

    def test_empty_runs(self):
        rankings = rank_experiments([])
        assert rankings == []

    def test_handles_none_metrics(self):
        run = ExperimentRun(
            run_id="bad",
            name="bad",
            phase="test",
            status=ExperimentStatus.COMPLETED,
            metrics=None,
        )
        rankings = rank_experiments([run])
        assert len(rankings) == 1

    def test_composite_metric(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        rankings = rank_experiments([another_run, sample_run], metric="composite")
        assert len(rankings) == 2
        for rank, run, score in rankings:
            assert score is not None

    def test_all_ranks_sequential(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        rankings = rank_experiments([another_run, sample_run])
        ranks = [r[0] for r in rankings]
        assert ranks == [1, 2]

    def test_custom_metric_name(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        rankings = rank_experiments([another_run, sample_run], metric="latency_ms")
        assert len(rankings) == 2


class TestComputeCompositeScore:
    def test_basic_composite(self, sample_metrics: ExperimentMetrics):
        score = compute_composite_score(sample_metrics)
        assert 0.0 <= score <= 1.0

    def test_higher_recall_gives_better_score(self):
        m1 = ExperimentMetrics(recall=0.9, precision=0.5, latency_ms=100)
        m2 = ExperimentMetrics(recall=0.5, precision=0.9, latency_ms=100)
        assert compute_composite_score(m1) > compute_composite_score(m2)

    def test_latency_penalty(self):
        m1 = ExperimentMetrics(recall=0.8, precision=0.7, latency_ms=10)
        m2 = ExperimentMetrics(recall=0.8, precision=0.7, latency_ms=10000)
        assert compute_composite_score(m1) > compute_composite_score(m2)

    def test_custom_weights(self, sample_metrics: ExperimentMetrics):
        score = compute_composite_score(sample_metrics, primary_weight=0.5)
        assert isinstance(score, float)

    def test_none_metrics_default_to_zero(self):
        m = ExperimentMetrics(latency_ms=100)
        score = compute_composite_score(m)
        assert isinstance(score, float)

    def test_penalty_weight(self, sample_metrics: ExperimentMetrics):
        score = compute_composite_score(sample_metrics, penalty_weight=0.5)
        assert isinstance(score, float)


class TestLeaderboardToDict:
    def test_returns_dict(self, sample_run: ExperimentRun, another_run: ExperimentRun):
        from intelligence.reporting.leaderboard import leaderboard_to_dict

        rankings = rank_experiments([sample_run, another_run])
        d = leaderboard_to_dict(rankings)
        assert "leaderboard" in d
        assert "count" in d
        assert d["count"] == 2

    def test_entries_have_expected_keys(self, sample_run: ExperimentRun):
        from intelligence.reporting.leaderboard import leaderboard_to_dict

        rankings = rank_experiments([sample_run])
        d = leaderboard_to_dict(rankings)
        entry = d["leaderboard"][0]
        for key in ("rank", "run_id", "name", "phase", "recall", "score"):
            assert key in entry


# ======================================================================
# Visualization Tests
# ======================================================================


class TestPlotMetricTrend:
    def test_returns_bytes(self, sample_run: ExperimentRun, another_run: ExperimentRun):
        data = plot_metric_trend([sample_run, another_run])
        assert isinstance(data, bytes)
        assert len(data) > 100

    def test_empty_runs(self):
        data = plot_metric_trend([])
        assert isinstance(data, bytes)

    def test_single_run(self, sample_run: ExperimentRun):
        data = plot_metric_trend([sample_run])
        assert isinstance(data, bytes)

    def test_png_format(self, sample_run: ExperimentRun):
        data = plot_metric_trend([sample_run])
        assert data[:4] == b"\x89PNG"

    def test_custom_metric(self, sample_run: ExperimentRun):
        data = plot_metric_trend([sample_run], metric="precision")
        assert len(data) > 100

    def test_custom_figsize(self, sample_run: ExperimentRun):
        data = plot_metric_trend([sample_run], figsize=(12, 6))
        assert len(data) > 100


class TestPlotExperimentComparison:
    def test_returns_bytes(self, sample_run: ExperimentRun, another_run: ExperimentRun):
        data = plot_experiment_comparison([sample_run, another_run])
        assert isinstance(data, bytes)
        assert len(data) > 100

    def test_empty_runs(self):
        data = plot_experiment_comparison([])
        assert isinstance(data, bytes)

    def test_single_run(self, sample_run: ExperimentRun):
        data = plot_experiment_comparison([sample_run])
        assert isinstance(data, bytes)

    def test_custom_metrics(self, sample_run: ExperimentRun):
        data = plot_experiment_comparison(
            [sample_run], metrics=["recall", "precision", "latency_ms"]
        )
        assert len(data) > 100

    def test_png_format(self, sample_run: ExperimentRun, another_run: ExperimentRun):
        data = plot_experiment_comparison([sample_run, another_run])
        assert data[:4] == b"\x89PNG"


class TestPlotBenchmarkComparison:
    def test_returns_bytes(self, benchmark_result: BenchmarkResult):
        data = plot_benchmark_comparison([benchmark_result])
        assert isinstance(data, bytes)
        assert len(data) > 100

    def test_empty_results(self):
        data = plot_benchmark_comparison([])
        assert isinstance(data, bytes)

    def test_multiple_results(self, benchmark_result: BenchmarkResult):
        b2 = BenchmarkResult(dataset_name="other", query_count=50)
        data = plot_benchmark_comparison([benchmark_result, b2])
        assert len(data) > 100

    def test_png_format(self, benchmark_result: BenchmarkResult):
        data = plot_benchmark_comparison([benchmark_result])
        assert data[:4] == b"\x89PNG"

    def test_custom_metric(self, benchmark_result: BenchmarkResult):
        data = plot_benchmark_comparison([benchmark_result], metric="average_precision")
        assert len(data) > 100

    def test_custom_title(self, benchmark_result: BenchmarkResult):
        data = plot_benchmark_comparison([benchmark_result], title="Custom")
        assert len(data) > 100


class TestPlotAblationImpact:
    def test_returns_bytes(self, ablation_comparison: AblationComparison):
        data = plot_ablation_impact([ablation_comparison])
        assert isinstance(data, bytes)
        assert len(data) > 100

    def test_empty_comparisons(self):
        data = plot_ablation_impact([])
        assert isinstance(data, bytes)

    def test_negative_delta(self):
        comp = AblationComparison(
            baseline_label="base",
            treatment_label="treat",
            recall_delta=-0.1,
            precision_delta=0.0,
        )
        data = plot_ablation_impact([comp])
        assert len(data) > 100

    def test_multiple_comparisons(self, ablation_comparison: AblationComparison):
        c2 = AblationComparison(
            baseline_label="base",
            treatment_label="treat2",
            recall_delta=0.02,
            precision_delta=0.01,
        )
        data = plot_ablation_impact([ablation_comparison, c2])
        assert len(data) > 100

    def test_png_format(self, ablation_comparison: AblationComparison):
        data = plot_ablation_impact([ablation_comparison])
        assert data[:4] == b"\x89PNG"


# ======================================================================
# Reproducibility Tests
# ======================================================================


class TestExperimentManifest:
    def test_generates_file(
        self, populated_registry: ExperimentRegistry, tmp_path: Path
    ):
        path = generate_experiment_manifest(
            populated_registry, output_dir=str(tmp_path)
        )
        assert path is not None
        assert Path(path).exists()

    def test_json_content(self, populated_registry: ExperimentRegistry, tmp_path: Path):
        path = generate_experiment_manifest(
            populated_registry, output_dir=str(tmp_path)
        )
        with open(path, "r") as f:
            data = json.load(f)
        assert data["type"] == "experiment_manifest"
        assert data["experiment_count"] == 2
        assert len(data["experiments"]) == 2

    def test_empty_registry(self, tmp_registry: ExperimentRegistry, tmp_path: Path):
        path = generate_experiment_manifest(tmp_registry, output_dir=str(tmp_path))
        assert path is None

    def test_custom_filename(
        self, populated_registry: ExperimentRegistry, tmp_path: Path
    ):
        path = generate_experiment_manifest(
            populated_registry, output_dir=str(tmp_path), filename="custom.json"
        )
        assert "custom.json" in path

    def test_entries_have_required_fields(
        self, populated_registry: ExperimentRegistry, tmp_path: Path
    ):
        path = generate_experiment_manifest(
            populated_registry, output_dir=str(tmp_path)
        )
        with open(path, "r") as f:
            data = json.load(f)
        for entry in data["experiments"]:
            assert "run_id" in entry
            assert "name" in entry
            assert "phase" in entry
            assert "timestamp" in entry


class TestBenchmarkManifest:
    def test_generates_file(self, benchmark_result: BenchmarkResult, tmp_path: Path):
        path = generate_benchmark_manifest([benchmark_result], output_dir=str(tmp_path))
        assert path is not None
        assert Path(path).exists()

    def test_json_content(self, benchmark_result: BenchmarkResult, tmp_path: Path):
        path = generate_benchmark_manifest([benchmark_result], output_dir=str(tmp_path))
        with open(path, "r") as f:
            data = json.load(f)
        assert data["type"] == "benchmark_manifest"
        assert data["dataset_count"] == 1

    def test_empty_results(self, tmp_path: Path):
        path = generate_benchmark_manifest([], output_dir=str(tmp_path))
        assert path is None

    def test_multiple_datasets(self, benchmark_result: BenchmarkResult, tmp_path: Path):
        path = generate_benchmark_manifest(
            [benchmark_result, benchmark_result], output_dir=str(tmp_path)
        )
        with open(path, "r") as f:
            data = json.load(f)
        assert data["dataset_count"] == 2

    def test_includes_validation_summary(
        self,
        benchmark_result: BenchmarkResult,
        validation_result: ValidationResult,
        tmp_path: Path,
    ):
        benchmark_result.validation = validation_result
        path = generate_benchmark_manifest([benchmark_result], output_dir=str(tmp_path))
        with open(path, "r") as f:
            data = json.load(f)
        assert data["datasets"][0]["validation_summary"] == validation_result.summary


class TestEnvironmentSnapshot:
    def test_generates_file(self, tmp_path: Path):
        path = generate_environment_snapshot(output_dir=str(tmp_path))
        assert path is not None
        assert Path(path).exists()

    def test_json_content(self, tmp_path: Path):
        path = generate_environment_snapshot(output_dir=str(tmp_path))
        with open(path, "r") as f:
            data = json.load(f)
        assert data["type"] == "environment_snapshot"
        assert "python" in data
        assert "platform" in data
        assert "platform" in data

    def test_includes_extra_info(self, tmp_path: Path):
        path = generate_environment_snapshot(
            output_dir=str(tmp_path), extra_info={"foo": "bar"}
        )
        with open(path, "r") as f:
            data = json.load(f)
        assert data["extra"]["foo"] == "bar"

    def test_python_version(self, tmp_path: Path):
        path = generate_environment_snapshot(output_dir=str(tmp_path))
        with open(path, "r") as f:
            data = json.load(f)
        assert len(data["python"]["version"]) > 0

    def test_platform_present(self, tmp_path: Path):
        path = generate_environment_snapshot(output_dir=str(tmp_path))
        with open(path, "r") as f:
            data = json.load(f)
        assert len(data["platform"]["system"]) > 0

    def test_custom_filename(self, tmp_path: Path):
        path = generate_environment_snapshot(
            output_dir=str(tmp_path), filename="env.json"
        )
        assert "env.json" in path


# ======================================================================
# Report Generator Tests
# ======================================================================


class TestGenerateFullReport:
    def test_markdown_output(self, tmp_path: Path):
        result = generate_full_report(output_dir=str(tmp_path))
        assert "md" in result
        assert Path(result["md"]).exists()

    def test_html_output(self, tmp_path: Path):
        result = generate_full_report(output_dir=str(tmp_path))
        assert "html" in result
        assert Path(result["html"]).exists()

    def test_json_output(self, tmp_path: Path):
        result = generate_full_report(output_dir=str(tmp_path))
        assert "json" in result
        assert Path(result["json"]).exists()

    def test_single_format(self, tmp_path: Path):
        result = generate_full_report(output_dir=str(tmp_path), formats=["md"])
        assert "md" in result
        assert "html" not in result
        assert "json" not in result

    def test_with_benchmarks(self, benchmark_result: BenchmarkResult, tmp_path: Path):
        result = generate_full_report(
            output_dir=str(tmp_path),
            benchmark_results=[benchmark_result],
        )
        assert "md" in result

    def test_with_ablation(
        self, ablation_comparison: AblationComparison, tmp_path: Path
    ):
        result = generate_full_report(
            output_dir=str(tmp_path),
            ablation_comparisons=[ablation_comparison],
        )
        assert "md" in result

    def test_with_registry(
        self, populated_registry: ExperimentRegistry, tmp_path: Path
    ):
        result = generate_full_report(
            output_dir=str(tmp_path),
            experiment_registry=populated_registry,
        )
        assert "experiment_manifest" in result
        assert "environment_snapshot" in result

    def test_with_validation(
        self,
        benchmark_result: BenchmarkResult,
        validation_result: ValidationResult,
        tmp_path: Path,
    ):
        benchmark_result.validation = validation_result
        result = generate_full_report(
            output_dir=str(tmp_path),
            benchmark_results=[benchmark_result],
        )
        assert "md" in result

    def test_with_ablation_validation(
        self,
        ablation_comparison: AblationComparison,
        validation_result: ValidationResult,
        tmp_path: Path,
    ):
        comp = AblationComparison(
            baseline_label=ablation_comparison.baseline_label,
            treatment_label=ablation_comparison.treatment_label,
            total_queries=ablation_comparison.total_queries,
            recall_delta=ablation_comparison.recall_delta,
            precision_delta=ablation_comparison.precision_delta,
            latency_delta_ms=ablation_comparison.latency_delta_ms,
            success_rate_delta=ablation_comparison.success_rate_delta,
            fallback_rate_delta=ablation_comparison.fallback_rate_delta,
            validation=validation_result,
        )
        result = generate_full_report(
            output_dir=str(tmp_path),
            ablation_comparisons=[comp],
        )
        assert "md" in result

    def test_custom_title(self, tmp_path: Path):
        result = generate_full_report(output_dir=str(tmp_path), title="Custom Report")
        report = Path(result["md"]).read_text()
        assert "Custom Report" in report

    def test_creates_output_dir(self, tmp_path: Path):
        subdir = tmp_path / "custom_reports"
        generate_full_report(output_dir=str(subdir))
        assert subdir.exists()

    def test_benchmark_manifest_generated(
        self, benchmark_result: BenchmarkResult, tmp_path: Path
    ):
        result = generate_full_report(
            output_dir=str(tmp_path),
            benchmark_results=[benchmark_result],
        )
        assert "benchmark_manifest" in result

    def test_json_summary(self, tmp_path: Path, benchmark_result: BenchmarkResult):
        result = generate_full_report(
            output_dir=str(tmp_path),
            benchmark_results=[benchmark_result],
        )
        path = Path(result["json"])
        data = json.loads(path.read_text(encoding="utf-8"))
        assert data["title"] == "Kairos Research Report"
        assert len(data["sections"]) > 0

    def test_markdown_content_includes_title(self, tmp_path: Path):
        result = generate_full_report(output_dir=str(tmp_path), title="Test Report")
        content = Path(result["md"]).read_text(encoding="utf-8")
        assert "# Test Report" in content

    def test_html_self_contained(self, tmp_path: Path):
        result = generate_full_report(output_dir=str(tmp_path))
        html = Path(result["html"]).read_text(encoding="utf-8")
        assert "<!DOCTYPE html>" in html
        assert "<style>" in html


# ======================================================================
# Edge Cases and Error Handling
# ======================================================================


class TestEdgeCases:
    def test_benchmark_with_empty_per_query(self):
        br = BenchmarkResult(dataset_name="empty", query_count=0)
        assert br.average_recall is None
        assert br.average_precision is None
        assert br.average_latency_ms == 0.0
        assert br.success_rate == 0.0
        assert br.fallback_rate == 0.0

    def test_benchmark_report_empty_per_query(self):
        br = BenchmarkResult(dataset_name="empty", query_count=0)
        md = generate_markdown_benchmark_report([br])
        assert "empty" in md

    def test_ablation_all_none_deltas(self):
        comp = AblationComparison(baseline_label="a", treatment_label="b")
        md = generate_markdown_ablation_report([comp])
        assert "N/A" in md

    def test_leaderboard_none_score(self):
        run = ExperimentRun(
            run_id="none",
            name="no-metrics",
            phase="test",
            status=ExperimentStatus.COMPLETED,
        )
        rankings = rank_experiments([run])
        assert len(rankings) == 1

    def test_environment_snapshot_default_filename(self, tmp_path: Path):
        path = generate_environment_snapshot(output_dir=str(tmp_path))
        assert "environment_snapshot.json" in path

    def test_full_report_no_output(self):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            result = generate_full_report(output_dir=d)
            assert "md" in result
            assert "html" in result

    def test_html_inline_formatting(self):
        md = "**bold** text and *italic*"
        html = generate_html_report("Test", md)
        assert "<strong>" in html
        assert "<em>" in html

    def test_html_code_formatting(self):
        md = "Use `code` inline"
        html = generate_html_report("Test", md)
        assert "<code>" in html
        assert "</code>" in html

    def test_html_headings(self):
        md = "# L1\n## L2\n### L3"
        html = generate_html_report("Test", md)
        assert "<h1>" in html
        assert "<h2>" in html
        assert "<h3>" in html

    def test_html_horizontal_rule(self):
        html = generate_html_report("Test", "---")
        assert "<hr>" in html

    def test_ablation_comparison_validation_none(
        self, ablation_comparison: AblationComparison
    ):
        assert ablation_comparison.validation is None

    def test_ablation_comparison_recall_delta(
        self, ablation_comparison: AblationComparison
    ):
        assert ablation_comparison.recall_delta == 0.05

    def test_compute_composite_zeros(self):
        m = ExperimentMetrics()
        score = compute_composite_score(m)
        assert isinstance(score, float)
        # all zeros: should be 0 - penalty
        assert score <= 0

    def test_ranking_custom_ascending_latency(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        rankings = rank_experiments(
            [sample_run, another_run], metric="latency_ms", ascending=True
        )
        assert rankings[0][1].run_id == "run-002"

    def test_visualization_custom_titles(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        data = plot_metric_trend([sample_run, another_run], title="Custom Trend")
        assert len(data) > 100
        data2 = plot_experiment_comparison(
            [sample_run, another_run], title="Custom Comparison"
        )
        assert len(data2) > 100

    def test_benchmark_manifest_custom_filename(
        self, benchmark_result: BenchmarkResult, tmp_path: Path
    ):
        path = generate_benchmark_manifest(
            [benchmark_result], output_dir=str(tmp_path), filename="my_bench.json"
        )
        assert "my_bench.json" in path

    def test_reproducibility_git_commit_not_required(self, tmp_path: Path):
        path = generate_environment_snapshot(output_dir=str(tmp_path))
        with open(path, "r") as f:
            data = json.load(f)
        # git_commit may be None if not in a git repo, that's OK
        assert "git_commit" in data

    def test_reproducibility_packages(self, tmp_path: Path):
        path = generate_environment_snapshot(output_dir=str(tmp_path))
        with open(path, "r") as f:
            data = json.load(f)
        assert isinstance(data.get("packages", {}), dict)

    def test_ablation_impact_no_deltas(self):
        comp = AblationComparison(
            baseline_label="a",
            treatment_label="b",
            recall_delta=None,
            precision_delta=None,
        )
        data = plot_ablation_impact([comp])
        assert len(data) > 100

    def test_benchmark_comparison_aggregate(self, benchmark_result: BenchmarkResult):
        agg = aggregate_results([benchmark_result, benchmark_result])
        assert agg["dataset_count"] == 2
        assert agg["total_queries"] == 200

    def test_benchmark_aggregate_empty(self):
        agg = aggregate_results([])
        assert agg["dataset_count"] == 0

    def test_markdown_section_with_validation_and_bootstrap(
        self, validation_result: ValidationResult
    ):
        from intelligence.statistics.bootstrap import BootstrapResult

        validation_result.bootstrap = BootstrapResult(
            metric_name="recall",
            point_estimate=0.05,
            bias=0.001,
            std_error=0.015,
            ci_lower=0.02,
            ci_upper=0.08,
            resampled_values=[0.04, 0.06, 0.05],
            n_resamples=9999,
        )
        md = generate_markdown_statistical_report(validation_result)
        assert "Point Estimate" in md

    def test_leaderboard_composite_ordering(
        self, sample_run: ExperimentRun, another_run: ExperimentRun
    ):
        rankings = rank_experiments(
            [another_run, sample_run], metric="composite", secondary_weight=0.3
        )
        assert rankings[0][1].run_id == "run-001"

    def test_html_includes_title_in_body(self):
        html = generate_html_report("Research Report", "content")
        assert "<h1>Research Report</h1>" in html

    def test_manifest_output_dir_created(self, populated_registry: ExperimentRegistry):
        import tempfile

        with tempfile.TemporaryDirectory() as d:
            sub = Path(d) / "deep" / "nested"
            path = generate_experiment_manifest(populated_registry, output_dir=str(sub))
            assert path is not None
            assert Path(path).exists()

    def test_markdown_ablation_with_validation_summary(
        self,
        ablation_comparison: AblationComparison,
        validation_result: ValidationResult,
    ):
        comp = AblationComparison(
            baseline_label=ablation_comparison.baseline_label,
            treatment_label=ablation_comparison.treatment_label,
            validation=validation_result,
        )
        md = generate_markdown_ablation_report([comp])
        assert validation_result.summary in md


class TestAggregateResults:
    def test_single_result(self, benchmark_result: BenchmarkResult):
        agg = aggregate_results([benchmark_result])
        assert agg["dataset_count"] == 1

    def test_multiple_results(self, benchmark_result: BenchmarkResult):
        b2 = BenchmarkResult(
            dataset_name="d2",
            query_count=50,
            per_query_recall=[0.9],
            per_query_precision=[0.8],
            per_query_latency_ms=[100],
        )
        agg = aggregate_results([benchmark_result, b2])
        assert agg["dataset_count"] == 2
        assert agg["total_queries"] == 150

    def test_averages(self, benchmark_result: BenchmarkResult):
        agg = aggregate_results([benchmark_result])
        assert agg["average_recall"] is not None
        assert agg["average_precision"] is not None

    def test_all_keys_present(self, benchmark_result: BenchmarkResult):
        agg = aggregate_results([benchmark_result])
        expected_keys = [
            "dataset_count",
            "total_queries",
            "average_recall",
            "average_precision",
            "average_latency_ms",
            "average_success_rate",
            "average_fallback_rate",
        ]
        for k in expected_keys:
            assert k in agg, f"Missing key: {k}"
