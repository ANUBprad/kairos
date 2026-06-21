from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional, Sequence

import numpy as np


@dataclass
class BootstrapResult:
    """Result of a bootstrap evaluation.

    Attributes:
        metric_name:       Name of the evaluated metric.
        point_estimate:    Observed value on the original sample.
        bias:              Mean of resampled estimates minus point estimate.
        std_error:         Standard deviation of resampled estimates.
        ci_lower:          2.5th percentile (for 95% CI).
        ci_upper:          97.5th percentile (for 95% CI).
        resampled_values:  All resampled metric values (for plotting).
        n_resamples:       Number of resamples performed.
    """

    metric_name: str
    point_estimate: float
    bias: float
    std_error: float
    ci_lower: float
    ci_upper: float
    resampled_values: List[float]
    n_resamples: int


class BootstrapEvaluator:
    """Bootstrap resampling evaluator for arbitrary metric functions.

    Resamples the input data with replacement *n_resamples* times and
    computes the metric on each resample to estimate uncertainty.

    Example::

        evaluator = BootstrapEvaluator(metric=np.mean, n_resamples=9999)
        result = evaluator.evaluate(data, metric_name="avg_recall")
        print(f"{result.point_estimate:.3f} ± [{result.ci_lower:.3f}, {result.ci_upper:.3f}]")
    """

    def __init__(
        self,
        metric: Callable[[np.ndarray], float],
        n_resamples: int = 9999,
        random_seed: Optional[int] = None,
    ):
        self._metric = metric
        self._n_resamples = n_resamples
        self._rng = np.random.default_rng(random_seed)

    def evaluate(
        self,
        data: Sequence[float],
        metric_name: str = "metric",
    ) -> BootstrapResult:
        """Run bootstrap resampling on *data*.

        Args:
            data:        Observations to resample from.
            metric_name: Label for the result (default ``"metric"``).

        Returns:
            A :class:`BootstrapResult`.
        """
        arr = np.asarray(data, dtype=float)
        n = len(arr)
        point_estimate = float(self._metric(arr))

        resampled = np.empty(self._n_resamples)
        for i in range(self._n_resamples):
            sample = self._rng.choice(arr, size=n, replace=True)
            resampled[i] = float(self._metric(sample))

        mean_resampled = float(np.mean(resampled))
        bias = mean_resampled - point_estimate
        std_error = float(np.std(resampled, ddof=1))

        ci_lower = float(np.percentile(resampled, 2.5))
        ci_upper = float(np.percentile(resampled, 97.5))

        return BootstrapResult(
            metric_name=metric_name,
            point_estimate=point_estimate,
            bias=bias,
            std_error=std_error,
            ci_lower=ci_lower,
            ci_upper=ci_upper,
            resampled_values=resampled.tolist(),
            n_resamples=self._n_resamples,
        )
