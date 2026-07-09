from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence

import numpy as np


@dataclass(frozen=True)
class ConfidenceInterval:
    """Confidence interval for a metric estimate.

    Attributes:
        lower_bound:  Lower bound of the interval.
        upper_bound:  Upper bound of the interval.
        confidence:   Confidence level (e.g., 0.95 for 95% CI).
        method:       How the interval was computed.
        n:            Number of observations.
        mean:         Sample mean.
        std_err:      Standard error of the mean.
    """

    lower_bound: float
    upper_bound: float
    confidence: float
    method: str
    n: int
    mean: float
    std_err: float

    @property
    def interval_width(self) -> float:
        return self.upper_bound - self.lower_bound


def mean_confidence_interval(
    data: Sequence[float],
    confidence: float = 0.95,
) -> ConfidenceInterval:
    """Compute the confidence interval for the mean using the t-distribution.

    Assumes data are approximately normally distributed.

    Args:
        data:        Sample of observations.
        confidence:  Confidence level (default 0.95).

    Returns:
        A :class:`ConfidenceInterval`.

    Raises:
        ValueError: If fewer than 2 observations.
    """
    arr = np.asarray(data, dtype=float)
    n = len(arr)
    if n < 2:
        raise ValueError(f"Need at least 2 observations, got {n}")

    from scipy import stats as scipy_stats

    mean = float(np.mean(arr))
    std_err = float(np.std(arr, ddof=1)) / np.sqrt(n)
    dof = n - 1
    t_val = float(scipy_stats.t.ppf((1 + confidence) / 2, dof))
    margin = t_val * std_err

    return ConfidenceInterval(
        lower_bound=mean - margin,
        upper_bound=mean + margin,
        confidence=confidence,
        method=f"t-distribution ({dof} dof)",
        n=n,
        mean=mean,
        std_err=std_err,
    )


def bootstrap_confidence_interval(
    data: Sequence[float],
    confidence: float = 0.95,
    n_resamples: int = 9999,
    random_seed: Optional[int] = None,
) -> ConfidenceInterval:
    """Compute the bootstrap percentile confidence interval for the mean.

    Does **not** assume normality.  Resamples with replacement from *data*
    and takes the percentiles at ``(1 - confidence) / 2`` and
    ``1 - (1 - confidence) / 2``.

    Args:
        data:         Sample of observations.
        confidence:   Confidence level (default 0.95).
        n_resamples:  Number of bootstrap resamples (default 9999).
        random_seed:  Seed for reproducible resampling.

    Returns:
        A :class:`ConfidenceInterval`.
    """
    arr = np.asarray(data, dtype=float)
    n = len(arr)
    if n < 2:
        raise ValueError(f"Need at least 2 observations, got {n}")

    rng = np.random.default_rng(random_seed)
    means = np.empty(n_resamples)
    for i in range(n_resamples):
        sample = rng.choice(arr, size=n, replace=True)
        means[i] = float(np.mean(sample))

    alpha = 1.0 - confidence
    lower = float(np.percentile(means, 100 * alpha / 2))
    upper = float(np.percentile(means, 100 * (1 - alpha / 2)))
    mean = float(np.mean(arr))
    std_err = float(np.std(arr, ddof=1)) / np.sqrt(n)

    return ConfidenceInterval(
        lower_bound=lower,
        upper_bound=upper,
        confidence=confidence,
        method=f"Bootstrap percentile ({n_resamples} resamples)",
        n=n,
        mean=mean,
        std_err=std_err,
    )
