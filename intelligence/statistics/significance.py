from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence, Tuple

import numpy as np
from scipy import stats as scipy_stats


@dataclass(frozen=True)
class SignificanceResult:
    """Result of a statistical significance test.

    Attributes:
        statistic:    Test statistic value.
        p_value:      Probability of observing the result under the null.
        significant:  ``True`` when *p_value* < *alpha*.
        alpha:        Significance threshold used.
        method:       Name of the test performed.
        n:            Number of paired observations.
    """

    statistic: float
    p_value: float
    significant: bool
    alpha: float
    method: str
    n: int


def paired_t_test(
    baseline: Sequence[float],
    treatment: Sequence[float],
    alpha: float = 0.05,
) -> SignificanceResult:
    """Paired two-sided t-test.

    Tests whether the mean difference between *treatment* and *baseline*
    is significantly different from zero.

    Args:
        baseline:   Per-query scores for the baseline configuration.
        treatment:  Per-query scores for the treatment configuration.
        alpha:      Significance threshold (default 0.05).

    Returns:
        A :class:`SignificanceResult`.

    Raises:
        ValueError: If the sequences have different lengths or fewer than
                    2 observations.
    """
    _validate_paired(baseline, treatment)
    a = np.asarray(baseline, dtype=float)
    b = np.asarray(treatment, dtype=float)
    diffs = b - a
    if np.all(diffs == 0):
        return SignificanceResult(
            statistic=0.0,
            p_value=1.0,
            significant=False,
            alpha=alpha,
            method="Paired t-test",
            n=len(a),
        )
    statistic, p_value = scipy_stats.ttest_rel(b, a)
    return SignificanceResult(
        statistic=float(statistic),
        p_value=float(p_value),
        significant=float(p_value) < alpha,
        alpha=alpha,
        method="Paired t-test",
        n=len(a),
    )


def wilcoxon_signed_rank(
    baseline: Sequence[float],
    treatment: Sequence[float],
    alpha: float = 0.05,
) -> SignificanceResult:
    """Wilcoxon signed-rank test (non-parametric paired test).

    Tests whether the median difference between *treatment* and *baseline*
    is significantly different from zero.  Does **not** assume normally
    distributed differences.

    Args:
        baseline:   Per-query scores for the baseline configuration.
        treatment:  Per-query scores for the treatment configuration.
        alpha:      Significance threshold (default 0.05).

    Returns:
        A :class:`SignificanceResult`.
    """
    _validate_paired(baseline, treatment)
    a = np.asarray(baseline, dtype=float)
    b = np.asarray(treatment, dtype=float)
    diffs = b - a
    if np.all(diffs == 0):
        return SignificanceResult(
            statistic=0.0,
            p_value=1.0,
            significant=False,
            alpha=alpha,
            method="Wilcoxon signed-rank",
            n=len(a),
        )
    statistic, p_value = scipy_stats.wilcoxon(b, a, method="auto")
    return SignificanceResult(
        statistic=float(statistic),
        p_value=float(p_value),
        significant=float(p_value) < alpha,
        alpha=alpha,
        method="Wilcoxon signed-rank",
        n=len(a),
    )


def permutation_test(
    baseline: Sequence[float],
    treatment: Sequence[float],
    alpha: float = 0.05,
    n_resamples: int = 9999,
    random_seed: Optional[int] = None,
) -> SignificanceResult:
    """Paired permutation test (non-parametric).

    Shuffles the sign of each paired difference under the null hypothesis
    that the median difference is zero.  The p-value is the proportion of
    resampled test statistics that are at least as extreme as the observed
    one.

    Args:
        baseline:     Per-query scores for the baseline configuration.
        treatment:    Per-query scores for the treatment configuration.
        alpha:        Significance threshold (default 0.05).
        n_resamples:  Number of random permutations (default 9999).
        random_seed:  Seed for reproducible resampling.

    Returns:
        A :class:`SignificanceResult`.
    """
    _validate_paired(baseline, treatment)
    diffs = np.asarray(treatment, dtype=float) - np.asarray(baseline, dtype=float)
    observed = float(np.mean(diffs))

    rng = np.random.default_rng(random_seed)
    count_extreme = 0
    for _ in range(n_resamples):
        signs = rng.choice([-1, 1], size=len(diffs))
        perm_mean = float(np.mean(diffs * signs))
        if abs(perm_mean) >= abs(observed):
            count_extreme += 1

    p_value = (count_extreme + 1) / (n_resamples + 1)

    return SignificanceResult(
        statistic=observed,
        p_value=float(p_value),
        significant=float(p_value) < alpha,
        alpha=alpha,
        method="Permutation test",
        n=len(diffs),
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _validate_paired(baseline: Sequence[float], treatment: Sequence[float]) -> None:
    if len(baseline) != len(treatment):
        raise ValueError(
            f"Baseline ({len(baseline)}) and treatment ({len(treatment)}) "
            f"must have the same number of observations"
        )
    if len(baseline) < 2:
        raise ValueError(
            f"Need at least 2 paired observations, got {len(baseline)}"
        )
