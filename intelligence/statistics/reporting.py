from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Sequence

import numpy as np

from intelligence.statistics.bootstrap import BootstrapResult
from intelligence.statistics.significance import (
    SignificanceResult,
    paired_t_test,
    wilcoxon_signed_rank,
    permutation_test,
)
from intelligence.statistics.confidence_intervals import (
    ConfidenceInterval,
    mean_confidence_interval,
    bootstrap_confidence_interval,
)
from intelligence.statistics.effect_size import EffectSize, cohens_d, cliffs_delta


@dataclass
class ValidationResult:
    """Aggregated statistical validation result comparing two configurations.

    Attributes:
        baseline_label:     Human-readable name for the baseline.
        treatment_label:    Human-readable name for the treatment.
        metric_name:        Name of the metric being compared (e.g. "recall").
        significance:       Results from significance tests.
        confidence_intervals: Confidence intervals for each group.
        effect_sizes:       Effect size estimates.
        bootstrap:          Optional bootstrap evaluation result.
        n_observations:     Number of paired observations.
        is_significant:     ``True`` if **any** significance test is significant.
        summary:            Short text summary.
    """

    baseline_label: str
    treatment_label: str
    metric_name: str
    significance: Dict[str, SignificanceResult]
    confidence_intervals: Dict[str, ConfidenceInterval]
    effect_sizes: Dict[str, EffectSize]
    bootstrap: Optional["BootstrapResult"]
    n_observations: int
    is_significant: bool
    summary: str


def generate_validation_report(
    baseline: Sequence[float],
    treatment: Sequence[float],
    metric_name: str = "metric",
    baseline_label: str = "baseline",
    treatment_label: str = "treatment",
    alpha: float = 0.05,
    include_permutation: bool = True,
    include_bootstrap: bool = True,
    bootstrap_resamples: int = 9999,
    random_seed: Optional[int] = None,
) -> ValidationResult:
    """Produce a comprehensive :class:`ValidationResult` comparing two groups.

    Runs all available significance tests, confidence intervals, and
    effect size measures.

    Args:
        baseline:            Baseline per-query scores.
        treatment:           Treatment per-query scores.
        metric_name:         Label for the metric.
        baseline_label:      Label for the baseline group.
        treatment_label:     Label for the treatment group.
        alpha:               Significance threshold.
        include_permutation: Whether to include the (slower) permutation test.
        include_bootstrap:   Whether to compute bootstrap CI / bootstrap evaluator.
        bootstrap_resamples: Number of bootstrap resamples.
        random_seed:         Seed for reproducibility.

    Returns:
        A :class:`ValidationResult`.
    """

    results: ValidationResult = ValidationResult(
        baseline_label=baseline_label,
        treatment_label=treatment_label,
        metric_name=metric_name,
        significance={},
        confidence_intervals={},
        effect_sizes={},
        bootstrap=None,
        n_observations=len(baseline),
        is_significant=False,
        summary="",
    )

    # -- Confidence intervals -------------------------------------------------
    results.confidence_intervals[baseline_label] = mean_confidence_interval(
        list(baseline), confidence=0.95
    )
    results.confidence_intervals[treatment_label] = mean_confidence_interval(
        list(treatment), confidence=0.95
    )
    if include_bootstrap:
        results.confidence_intervals[f"{baseline_label} (bootstrap)"] = (
            bootstrap_confidence_interval(
                list(baseline),
                confidence=0.95,
                n_resamples=bootstrap_resamples,
                random_seed=random_seed,
            )
        )
        results.confidence_intervals[f"{treatment_label} (bootstrap)"] = (
            bootstrap_confidence_interval(
                list(treatment),
                confidence=0.95,
                n_resamples=bootstrap_resamples,
                random_seed=random_seed,
            )
        )

    # -- Significance tests ---------------------------------------------------
    results.significance["Paired t-test"] = paired_t_test(
        list(baseline),
        list(treatment),
        alpha=alpha,
    )
    results.significance["Wilcoxon signed-rank"] = wilcoxon_signed_rank(
        list(baseline),
        list(treatment),
        alpha=alpha,
    )
    if include_permutation:
        results.significance["Permutation test"] = permutation_test(
            list(baseline),
            list(treatment),
            alpha=alpha,
            n_resamples=bootstrap_resamples,
            random_seed=random_seed,
        )

    # -- Effect sizes ---------------------------------------------------------
    results.effect_sizes["Cohen's d"] = cohens_d(
        list(baseline),
        list(treatment),
    )
    results.effect_sizes["Cliff's delta"] = cliffs_delta(
        list(baseline),
        list(treatment),
    )

    # -- Bootstrap evaluator --------------------------------------------------
    if include_bootstrap:

        def delta_mean(arr: np.ndarray) -> float:
            return float(np.mean(arr))

        from intelligence.statistics.bootstrap import BootstrapEvaluator as BE

        be = BE(
            metric=delta_mean, n_resamples=bootstrap_resamples, random_seed=random_seed
        )
        results.bootstrap = be.evaluate(
            [float(t) - float(b) for t, b in zip(treatment, baseline)],
            metric_name=f"Δ{metric_name}",
        )

    # -- Aggregate ------------------------------------------------------------
    any_sig = any(r.significant for r in results.significance.values())
    results.is_significant = any_sig

    # Build summary
    d = results.effect_sizes["Cohen's d"]
    sig_tag = "significant" if any_sig else "not significant"
    p_vals = ", ".join(f"{k}: {v.p_value:.4f}" for k, v in results.significance.items())
    results.summary = (
        f"{metric_name}: {treatment_label} vs {baseline_label} — "
        f"{sig_tag} ({p_vals}), "
        f"{d.method}={d.value:.4f} ({d.magnitude}), "
        f"{d.direction}"
    )

    return results
