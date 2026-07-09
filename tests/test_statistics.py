from __future__ import annotations


import numpy as np
import pytest

from intelligence.statistics.bootstrap import BootstrapEvaluator, BootstrapResult
from intelligence.statistics.confidence_intervals import (
    ConfidenceInterval,
    bootstrap_confidence_interval,
    mean_confidence_interval,
)
from intelligence.statistics.effect_size import cliffs_delta, cohens_d
from intelligence.statistics.reporting import (
    ValidationResult,
    generate_validation_report,
)
from intelligence.statistics.significance import (
    paired_t_test,
    permutation_test,
    wilcoxon_signed_rank,
)


# ===========================================================================
#  Significance tests
# ===========================================================================


class TestSignificanceValidation:
    def test_validate_paired_unequal_lengths(self):
        with pytest.raises(ValueError, match="same number"):
            paired_t_test([1.0, 2.0], [1.0])

    def test_validate_paired_too_few(self):
        with pytest.raises(ValueError, match="at least 2"):
            paired_t_test([1.0], [2.0])


class TestPairedTTest:
    def test_identical_sequences(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9]
        result = paired_t_test(data, data)
        assert result.statistic == 0.0
        assert result.p_value == 1.0
        assert not result.significant
        assert result.method == "Paired t-test"
        assert result.n == 5

    def test_different_sequences_significant(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7]
        result = paired_t_test(baseline, treatment)
        assert result.significant
        assert result.p_value < 0.001
        assert result.n == 6

    def test_not_significant(self):
        rng = np.random.default_rng(42)
        baseline = rng.normal(0.5, 0.1, 20).tolist()
        treatment = rng.normal(0.52, 0.1, 20).tolist()
        result = paired_t_test(baseline, treatment, alpha=0.05)
        # With small effect and small n, may or may not be significant
        assert isinstance(result.significant, bool)
        assert 0 <= result.p_value <= 1

    def test_custom_alpha(self):
        baseline = [0.5, 0.51, 0.49, 0.5]
        treatment = [0.7, 0.71, 0.69, 0.7]
        result = paired_t_test(baseline, treatment, alpha=0.01)
        # Very strong effect should still be significant at 0.01
        assert result.significant
        assert result.alpha == 0.01

    def test_small_sample(self):
        baseline = [0.5, 0.55]
        treatment = [0.8, 0.85]
        result = paired_t_test(baseline, treatment)
        # Only 2 observations -- hard to detect significance but test should run
        assert result.n == 2


class TestWilcoxonSignedRank:
    def test_identical_sequences(self):
        data = [1.0, 2.0, 3.0, 4.0, 5.0]
        result = wilcoxon_signed_rank(data, data)
        assert result.statistic == 0.0
        assert result.p_value == 1.0
        assert not result.significant

    def test_different_sequences_significant(self):
        baseline = [1.0, 2.0, 1.5, 2.5, 1.8, 2.2]
        treatment = [3.0, 4.0, 3.5, 4.5, 3.8, 4.2]
        result = wilcoxon_signed_rank(baseline, treatment)
        assert result.significant
        assert result.method == "Wilcoxon signed-rank"

    def test_non_normal(self):
        # Deliberately non-normal data with clear shift
        baseline = [0.1, 0.2, 0.15, 0.25, 0.12, 0.22]
        treatment = [0.9, 0.8, 0.85, 0.95, 0.88, 0.92]
        result = wilcoxon_signed_rank(baseline, treatment)
        assert result.significant
        assert result.p_value < 0.05

    def test_alpha_threshold(self):
        baseline = [1.0, 1.1, 0.9, 1.05]
        treatment = [1.2, 1.3, 1.1, 1.25]
        result = wilcoxon_signed_rank(baseline, treatment, alpha=0.10)
        assert isinstance(result.significant, bool)
        assert result.alpha == 0.10


class TestPermutationTest:
    def test_identical_sequences(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
        result = permutation_test(data, data, n_resamples=999, random_seed=42)
        assert result.statistic == 0.0
        assert not result.significant
        assert result.method == "Permutation test"

    def test_different_sequences_significant(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        result = permutation_test(baseline, treatment, n_resamples=999, random_seed=42)
        assert result.significant
        assert result.p_value < 0.05

    def test_reproducible_seed(self):
        baseline = [0.5, 0.6, 0.7, 0.8, 0.9]
        treatment = [0.55, 0.65, 0.75, 0.85, 0.95]
        r1 = permutation_test(baseline, treatment, n_resamples=999, random_seed=42)
        r2 = permutation_test(baseline, treatment, n_resamples=999, random_seed=42)
        assert r1.p_value == r2.p_value

    def test_small_sample(self):
        baseline = [0.5, 0.55]
        treatment = [0.8, 0.85]
        result = permutation_test(baseline, treatment, n_resamples=199, random_seed=42)
        assert result.n == 2
        assert 0 <= result.p_value <= 1


# ===========================================================================
#  Confidence intervals
# ===========================================================================


class TestMeanConfidenceInterval:
    def test_basic_ci(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9]
        ci = mean_confidence_interval(data, confidence=0.95)
        assert isinstance(ci, ConfidenceInterval)
        assert ci.lower_bound < ci.mean < ci.upper_bound
        assert ci.confidence == 0.95
        assert ci.n == 5
        assert ci.std_err > 0

    def test_identical_values(self):
        data = [0.5, 0.5, 0.5, 0.5]
        ci = mean_confidence_interval(data)
        assert ci.lower_bound == ci.mean == ci.upper_bound == 0.5
        assert ci.std_err == 0.0

    def test_too_few_observations(self):
        with pytest.raises(ValueError, match="at least 2"):
            mean_confidence_interval([0.5])

    def test_confidence_99(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.55, 0.75]
        ci95 = mean_confidence_interval(data, confidence=0.95)
        ci99 = mean_confidence_interval(data, confidence=0.99)
        # 99% CI should be wider than 95% CI
        assert ci99.interval_width >= ci95.interval_width

    def test_ci_properties(self):
        data = [0.5, 0.6, 0.7]
        ci = mean_confidence_interval(data)
        assert ci.lower_bound <= ci.upper_bound
        assert "t-distribution" in ci.method
        assert ci.n == 3


class TestBootstrapConfidenceInterval:
    def test_basic_bootstrap_ci(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9, 0.55, 0.65, 0.75, 0.85, 0.95]
        ci = bootstrap_confidence_interval(data, n_resamples=999, random_seed=42)
        assert isinstance(ci, ConfidenceInterval)
        assert ci.lower_bound < ci.mean < ci.upper_bound
        assert ci.confidence == 0.95
        assert ci.n == 10

    def test_bootstrap_vs_t_approx(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9] * 4  # 20 obs, roughly normal
        t_ci = mean_confidence_interval(data)
        bs_ci = bootstrap_confidence_interval(data, n_resamples=1999, random_seed=42)
        # Both should be broadly similar (same order of magnitude)
        assert abs(t_ci.lower_bound - bs_ci.lower_bound) < 0.3
        assert abs(t_ci.upper_bound - bs_ci.upper_bound) < 0.3

    def test_reproducible_seed(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9]
        ci1 = bootstrap_confidence_interval(data, n_resamples=999, random_seed=42)
        ci2 = bootstrap_confidence_interval(data, n_resamples=999, random_seed=42)
        assert ci1.lower_bound == ci2.lower_bound
        assert ci1.upper_bound == ci2.upper_bound

    def test_too_few_observations(self):
        with pytest.raises(ValueError, match="at least 2"):
            bootstrap_confidence_interval([0.5])

    def test_bootstrap_method_label(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9]
        ci = bootstrap_confidence_interval(data, n_resamples=999, random_seed=42)
        assert "Bootstrap" in ci.method


# ===========================================================================
#  Effect size
# ===========================================================================


class TestCohensD:
    def test_identical_means(self):
        a = [0.5, 0.6, 0.7, 0.8, 0.9]
        es = cohens_d(a, a)
        assert es.value == 0.0
        assert es.magnitude == "negligible"
        assert es.direction == "neutral"

    def test_treatment_higher_large_effect(self):
        baseline = [0.5, 0.6, 0.7, 0.5, 0.6]
        treatment = [0.9, 1.0, 1.1, 0.95, 1.05]
        es = cohens_d(baseline, treatment)
        assert es.value > 0.8
        assert es.magnitude == "large"
        assert "treatment > baseline" in es.direction

    def test_treatment_lower(self):
        baseline = [0.9, 1.0, 1.1, 0.95, 1.05]
        treatment = [0.5, 0.6, 0.7, 0.5, 0.6]
        es = cohens_d(baseline, treatment)
        assert es.value < -0.8
        assert "treatment < baseline" in es.direction

    def test_small_effect(self):
        # Use data with realistic variance so effect size stays moderate
        rng = np.random.default_rng(42)
        baseline = rng.normal(0.5, 0.15, 50).tolist()
        treatment = rng.normal(0.6, 0.15, 50).tolist()
        es = cohens_d(baseline, treatment)
        assert 0.2 <= abs(es.value) < 1.2
        assert es.magnitude in ("small", "medium")

    def test_zero_variance(self):
        baseline = [0.5, 0.5, 0.5]
        treatment = [0.7, 0.7, 0.7]
        es = cohens_d(baseline, treatment)
        assert es.value == 0.0
        assert es.magnitude == "negligible"


class TestCliffsDelta:
    def test_identical_groups(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9]
        es = cliffs_delta(data, data)
        assert es.value == 0.0
        assert es.magnitude == "negligible"
        assert es.direction == "neutral"

    def test_treatment_always_higher(self):
        baseline = [0.5, 0.6, 0.7]
        treatment = [0.8, 0.9, 1.0]
        es = cliffs_delta(baseline, treatment)
        assert es.value > 0.474
        assert es.magnitude == "large"

    def test_treatment_always_lower(self):
        baseline = [0.8, 0.9, 1.0]
        treatment = [0.5, 0.6, 0.7]
        es = cliffs_delta(baseline, treatment)
        assert es.value < -0.474
        assert "treatment < baseline" in es.direction

    def test_some_overlap(self):
        baseline = [0.5, 0.6, 0.7, 0.8, 0.9]
        treatment = [0.55, 0.65, 0.75, 0.85, 0.95]
        es = cliffs_delta(baseline, treatment)
        assert es.magnitude in ("negligible", "small")
        assert abs(es.value) < 0.33

    def test_small_groups(self):
        baseline = [0.5]
        treatment = [0.9]
        es = cliffs_delta(baseline, treatment)
        assert abs(es.value) == 1.0 or es.value == 0.0


# ===========================================================================
#  Bootstrap evaluator
# ===========================================================================


class TestBootstrapEvaluator:
    def test_evaluate_mean(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9, 0.55, 0.65, 0.75, 0.85, 0.95]
        evaluator = BootstrapEvaluator(metric=np.mean, n_resamples=999, random_seed=42)
        result = evaluator.evaluate(data, metric_name="recall")
        assert isinstance(result, BootstrapResult)
        assert result.metric_name == "recall"
        assert 0.6 <= result.point_estimate <= 0.8
        assert result.ci_lower <= result.point_estimate <= result.ci_upper
        assert result.n_resamples == 999

    def test_bias_std_error(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9]
        evaluator = BootstrapEvaluator(metric=np.mean, n_resamples=999, random_seed=42)
        result = evaluator.evaluate(data)
        assert isinstance(result.bias, float)
        assert result.std_error >= 0

    def test_custom_metric(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9]

        def median(x):
            return float(np.median(x))

        evaluator = BootstrapEvaluator(metric=median, n_resamples=499, random_seed=42)
        result = evaluator.evaluate(data, metric_name="median")
        assert result.point_estimate == 0.7
        assert result.n_resamples == 499

    def test_reproducible_seed(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9, 0.55, 0.65, 0.75, 0.85, 0.95]
        e1 = BootstrapEvaluator(metric=np.mean, n_resamples=999, random_seed=42)
        e2 = BootstrapEvaluator(metric=np.mean, n_resamples=999, random_seed=42)
        r1 = e1.evaluate(data)
        r2 = e2.evaluate(data)
        assert r1.point_estimate == r2.point_estimate
        assert r1.ci_lower == r2.ci_lower
        assert r1.ci_upper == r2.ci_upper

    def test_resampled_values(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9]
        evaluator = BootstrapEvaluator(metric=np.mean, n_resamples=99, random_seed=42)
        result = evaluator.evaluate(data)
        assert len(result.resampled_values) == 99


# ===========================================================================
#  Validation report (integration)
# ===========================================================================


class TestValidationReport:
    def test_basic_report(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        vr = generate_validation_report(
            baseline,
            treatment,
            metric_name="recall",
            baseline_label="vanilla",
            treatment_label="augmented",
            random_seed=42,
        )
        assert isinstance(vr, ValidationResult)
        assert vr.baseline_label == "vanilla"
        assert vr.treatment_label == "augmented"
        assert vr.metric_name == "recall"
        assert vr.n_observations == 8
        assert vr.is_significant
        assert "recall" in vr.summary

    def test_not_significant(self):
        baseline = [0.5, 0.51, 0.49, 0.5, 0.52, 0.48, 0.5, 0.51]
        treatment = [0.51, 0.52, 0.5, 0.51, 0.53, 0.49, 0.51, 0.52]
        vr = generate_validation_report(
            baseline,
            treatment,
            random_seed=42,
            include_permutation=True,
        )
        # Very small effect, may or may not be significant
        assert isinstance(vr.is_significant, bool)

    def test_significance_keys(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        vr = generate_validation_report(baseline, treatment, random_seed=42)
        assert "Paired t-test" in vr.significance
        assert "Wilcoxon signed-rank" in vr.significance
        assert "Permutation test" in vr.significance

    def test_effect_size_keys(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        vr = generate_validation_report(baseline, treatment, random_seed=42)
        assert "Cohen's d" in vr.effect_sizes
        assert "Cliff's delta" in vr.effect_sizes

    def test_confidence_interval_keys(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        vr = generate_validation_report(baseline, treatment, random_seed=42)
        assert vr.baseline_label in vr.confidence_intervals
        assert vr.treatment_label in vr.confidence_intervals
        assert f"{vr.baseline_label} (bootstrap)" in vr.confidence_intervals
        assert f"{vr.treatment_label} (bootstrap)" in vr.confidence_intervals

    def test_bootstrap_in_report(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        vr = generate_validation_report(
            baseline,
            treatment,
            metric_name="recall",
            include_bootstrap=True,
            random_seed=42,
        )
        assert vr.bootstrap is not None
        assert vr.bootstrap.metric_name == "\u0394recall"

    def test_without_permutation(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        vr = generate_validation_report(
            baseline,
            treatment,
            include_permutation=False,
            random_seed=42,
        )
        assert "Permutation test" not in vr.significance

    def test_without_bootstrap(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        vr = generate_validation_report(
            baseline,
            treatment,
            include_bootstrap=False,
            random_seed=42,
        )
        assert vr.bootstrap is None
        assert f"{vr.baseline_label} (bootstrap)" not in vr.confidence_intervals
        assert f"{vr.treatment_label} (bootstrap)" not in vr.confidence_intervals

    def test_custom_alpha(self):
        baseline = [0.5, 0.52, 0.48, 0.51, 0.49, 0.5, 0.51, 0.49]
        treatment = [0.7, 0.72, 0.68, 0.71, 0.69, 0.7, 0.71, 0.69]
        vr = generate_validation_report(baseline, treatment, alpha=0.10, random_seed=42)
        assert all(s.alpha == 0.10 for s in vr.significance.values())

    def test_identical_data(self):
        data = [0.5, 0.6, 0.7, 0.8, 0.9, 0.55, 0.65, 0.75, 0.85, 0.95]
        vr = generate_validation_report(data, data, random_seed=42)
        assert not vr.is_significant
        assert vr.effect_sizes["Cohen's d"].value == 0.0


# ===========================================================================
#  Integration: AblationComparison with validation
# ===========================================================================


class TestAblationComparisonValidation:
    @pytest.fixture
    def sample_runner_result(self):
        from benchmarks.dataset import QueryEntry
        from benchmarks.metrics import FailureRecord, LatencyRecord
        from benchmarks.runner import QueryResult, RunnerResult
        from intelligence.planner import PlannerDecision

        results = []
        for i in range(10):
            entry = QueryEntry(
                id=f"q{i}",
                text=f"query {i}",
                query_type="SIMPLE",
            )
            decision = PlannerDecision(config={}, confidence=0.9, query_type="SIMPLE")
            results.append(
                QueryResult(
                    entry=entry,
                    planner_decision=decision,
                    retrieved_chunks=("a", "b"),
                    latency=LatencyRecord(total=0.1 + i * 0.005),
                    failures=FailureRecord(),
                    recall=0.5 + i * 0.04,
                    precision=0.5 + i * 0.03,
                )
            )

        return RunnerResult(results=tuple(results))

    def test_validation_included_by_default(self, sample_runner_result):
        from intelligence.ablation.comparison import compare_runs

        comp = compare_runs(sample_runner_result, sample_runner_result)
        assert comp.validation is not None
        assert not comp.validation.is_significant

    def test_validation_detectable_effect(self, sample_runner_result):
        from benchmarks.dataset import QueryEntry
        from benchmarks.runner import QueryResult, RunnerResult
        from intelligence.ablation.comparison import compare_runs
        from intelligence.planner import PlannerDecision

        treatment_results = []
        for qr in sample_runner_result.results:
            entry = QueryEntry(
                id=qr.entry.id,
                text=qr.entry.text,
                query_type=qr.entry.query_type,
            )
            decision = PlannerDecision(
                config={}, confidence=0.9, query_type=qr.entry.query_type
            )
            treatment_results.append(
                QueryResult(
                    entry=entry,
                    planner_decision=decision,
                    retrieved_chunks=qr.retrieved_chunks,
                    latency=qr.latency,
                    failures=qr.failures,
                    recall=(qr.recall or 0.0) + 0.2,
                    precision=(qr.precision or 0.0) + 0.1,
                )
            )

        treatment = RunnerResult(results=tuple(treatment_results))
        comp = compare_runs(
            sample_runner_result,
            treatment,
            baseline_label="vanilla",
            treatment_label="augmented",
        )
        assert comp.validation is not None
        assert comp.validation.is_significant

    def test_validation_skipped_when_disabled(self, sample_runner_result):
        from intelligence.ablation.comparison import compare_runs

        comp = compare_runs(
            sample_runner_result,
            sample_runner_result,
            include_validation=False,
        )
        assert comp.validation is None

    def test_validation_uses_precision_metric(self, sample_runner_result):
        from benchmarks.dataset import QueryEntry
        from benchmarks.runner import QueryResult, RunnerResult
        from intelligence.ablation.comparison import compare_runs
        from intelligence.planner import PlannerDecision

        treatment_results = []
        for qr in sample_runner_result.results:
            entry = QueryEntry(
                id=qr.entry.id,
                text=qr.entry.text,
                query_type=qr.entry.query_type,
            )
            decision = PlannerDecision(
                config={}, confidence=0.9, query_type=qr.entry.query_type
            )
            treatment_results.append(
                QueryResult(
                    entry=entry,
                    planner_decision=decision,
                    retrieved_chunks=qr.retrieved_chunks,
                    latency=qr.latency,
                    failures=qr.failures,
                    recall=qr.recall,
                    precision=(qr.precision or 0.0) + 0.2,
                )
            )

        treatment = RunnerResult(results=tuple(treatment_results))
        comp = compare_runs(
            sample_runner_result,
            treatment,
            metric_name="precision",
        )
        assert comp.validation is not None
        assert comp.validation.metric_name == "precision"

    def test_fallback_when_metric_missing(self, sample_runner_result):
        from benchmarks.runner import RunnerResult
        from intelligence.ablation.comparison import compare_runs

        tr = RunnerResult(results=sample_runner_result.results)
        comp = compare_runs(sample_runner_result, tr, metric_name="nonexistent")
        assert comp.validation is not None


# ===========================================================================
#  Integration: RunComparison with validation
# ===========================================================================


class TestRunComparisonValidation:
    @pytest.fixture
    def sample_runs(self):
        from intelligence.experiments.models import ExperimentMetrics, ExperimentRun

        baseline = ExperimentRun(
            run_id="bl-001",
            name="baseline",
            metrics=ExperimentMetrics(recall=0.75, precision=0.80, latency_ms=200.0),
        )
        treatment = ExperimentRun(
            run_id="tr-001",
            name="treatment",
            metrics=ExperimentMetrics(recall=0.85, precision=0.88, latency_ms=210.0),
        )
        return baseline, treatment

    def test_validation_attached(self, sample_runs):
        from intelligence.experiments.comparison import compare_runs
        from intelligence.statistics.reporting import generate_validation_report

        baseline, treatment = sample_runs
        vr = generate_validation_report([0.75] * 10, [0.85] * 10, random_seed=42)
        comp = compare_runs(baseline, treatment, validation=vr)
        assert comp.validation is not None
        assert comp.validation.metric_name == "metric"

    def test_validation_none_by_default(self, sample_runs):
        from intelligence.experiments.comparison import compare_runs

        baseline, treatment = sample_runs
        comp = compare_runs(baseline, treatment)
        assert comp.validation is None

    def test_report_includes_validation_section(self, sample_runs):
        """Verify generate_comparison_report includes validation when present."""
        from intelligence.experiments.comparison import (
            compare_runs,
            generate_comparison_report,
        )
        from intelligence.statistics.reporting import generate_validation_report

        baseline, treatment = sample_runs
        vr = generate_validation_report(
            [0.75, 0.76, 0.74, 0.75, 0.76],
            [0.85, 0.86, 0.84, 0.85, 0.86],
            random_seed=42,
        )
        comp = compare_runs(baseline, treatment, validation=vr)
        report = generate_comparison_report([comp])
        assert "Statistical Validation" in report
        assert "Paired t-test" in report


# ===========================================================================
#  Ablation report includes validation section
# ===========================================================================


class TestAblationReportValidation:
    def test_report_contains_validation_section(self):
        """Ablation report should include statistical validation sections."""
        from benchmarks.dataset import QueryEntry
        from benchmarks.metrics import FailureRecord, LatencyRecord
        from benchmarks.runner import QueryResult, RunnerResult
        from intelligence.ablation.comparison import (
            compare_runs,
            generate_ablation_report,
        )
        from intelligence.planner import PlannerDecision

        results_b = []
        results_t = []
        for i in range(8):
            entry = QueryEntry(id=f"q{i}", text=f"q{i}", query_type="SIMPLE")
            decision = PlannerDecision(config={}, confidence=0.9, query_type="SIMPLE")
            results_b.append(
                QueryResult(
                    entry=entry,
                    planner_decision=decision,
                    retrieved_chunks=("a",),
                    latency=LatencyRecord(total=0.1),
                    failures=FailureRecord(),
                    recall=0.5,
                    precision=0.5,
                )
            )
            results_t.append(
                QueryResult(
                    entry=entry,
                    planner_decision=decision,
                    retrieved_chunks=("a",),
                    latency=LatencyRecord(total=0.1),
                    failures=FailureRecord(),
                    recall=0.8,
                    precision=0.8,
                )
            )

        base_res = RunnerResult(results=tuple(results_b))
        treat_res = RunnerResult(results=tuple(results_t))

        comp = compare_runs(
            base_res, treat_res, baseline_label="Base", treatment_label="Treat"
        )
        report = generate_ablation_report([comp])
        assert "Statistical Validation" in report
        assert "Significance Tests" in report
        assert "Effect Sizes" in report
        assert "Cohens" in report or "Cohen" in report  # effect size table


# ===========================================================================
#  Edge cases
# ===========================================================================


class TestEdgeCases:
    def test_single_element_significance(self):
        with pytest.raises(ValueError, match="at least 2"):
            paired_t_test([1.0], [2.0])

    def test_empty_data(self):
        with pytest.raises(ValueError, match="at least 2"):
            mean_confidence_interval([])

    def test_large_effect_always_detectable(self):
        baseline = [0.5, 0.51, 0.49, 0.5, 0.52] * 4
        treatment = [5.0, 5.1, 4.9, 5.0, 5.2] * 4
        vr = generate_validation_report(baseline, treatment, random_seed=42)
        assert vr.is_significant
        assert vr.effect_sizes["Cohen's d"].magnitude == "large"

    def test_permutation_large_data(self):
        rng = np.random.default_rng(42)
        baseline = rng.normal(0.5, 0.1, 50).tolist()
        treatment = rng.normal(0.7, 0.1, 50).tolist()
        result = permutation_test(baseline, treatment, n_resamples=1999, random_seed=42)
        assert result.significant
        # p-value = (count_extreme + 1) / (n_resamples + 1), so minimum is 1/2000 = 0.0005
        assert result.p_value <= 0.005

    def test_bootstrap_with_small_data(self):
        data = [0.5, 0.6, 0.7]
        ci = bootstrap_confidence_interval(data, n_resamples=99, random_seed=42)
        assert ci.lower_bound <= ci.upper_bound
