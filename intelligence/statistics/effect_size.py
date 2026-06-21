from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Sequence, Tuple

import numpy as np


@dataclass(frozen=True)
class EffectSize:
    """Standardised effect size between two groups.

    Attributes:
        value:          The effect size estimate.
        magnitude:      Human-readable interpretation (negligible/small/medium/large).
        direction:      "treatment > baseline", "treatment < baseline", or "neutral".
        method:         How the effect size was computed.
        n_baseline:     Number of baseline observations.
        n_treatment:    Number of treatment observations.
    """

    value: float
    magnitude: str
    direction: str
    method: str
    n_baseline: int
    n_treatment: int


def cohens_d(
    baseline: Sequence[float],
    treatment: Sequence[float],
) -> EffectSize:
    """Cohen's *d* — standardised mean difference.

    Interpretation thresholds (abs *d*):
        < 0.2 → negligible
        0.2–0.5 → small
        0.5–0.8 → medium
        >= 0.8 → large

    Args:
        baseline:   Scores for the baseline group.
        treatment:  Scores for the treatment group.

    Returns:
        An :class:`EffectSize`.
    """
    a = np.asarray(baseline, dtype=float)
    b = np.asarray(treatment, dtype=float)
    n1, n2 = len(a), len(b)

    mean1, mean2 = float(np.mean(a)), float(np.mean(b))
    var1, var2 = float(np.var(a, ddof=1)), float(np.var(b, ddof=1))

    pooled_var = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2)
    if pooled_var <= 1e-15:
        d = 0.0
    else:
        d = (mean2 - mean1) / np.sqrt(pooled_var)

    return EffectSize(
        value=float(d),
        magnitude=_cohens_magnitude(abs(d)),
        direction=_direction(mean2, mean1),
        method="Cohen's d",
        n_baseline=n1,
        n_treatment=n2,
    )


def cliffs_delta(
    baseline: Sequence[float],
    treatment: Sequence[float],
) -> EffectSize:
    """Cliff's *delta* — non-parametric effect size for ordinal data.

    Measures how often values in one group are larger than values in the
    other.  Range is [-1, 1].

    Interpretation thresholds (abs *delta*):
        < 0.147 → negligible
        0.147–0.33 → small
        0.33–0.474 → medium
        >= 0.474 → large

    Args:
        baseline:   Scores for the baseline group.
        treatment:  Scores for the treatment group.

    Returns:
        An :class:`EffectSize`.
    """
    a = np.asarray(baseline, dtype=float)
    b = np.asarray(treatment, dtype=float)
    n1, n2 = len(a), len(b)

    # Count how many times a value in treatment is > / < a value in baseline
    count_greater = 0
    count_less = 0
    for val_b in b:
        for val_a in a:
            if val_b > val_a:
                count_greater += 1
            elif val_b < val_a:
                count_less += 1

    total = n1 * n2
    if total == 0:
        delta = 0.0
    else:
        delta = (count_greater - count_less) / total

    return EffectSize(
        value=float(delta),
        magnitude=_cliffs_magnitude(abs(delta)),
        direction=_direction_b(
            count_greater / total if total > 0 else 0.0,
            count_less / total if total > 0 else 0.0,
        ),
        method="Cliff's delta",
        n_baseline=n1,
        n_treatment=n2,
    )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _cohens_magnitude(abs_d: float) -> str:
    if abs_d < 0.2:
        return "negligible"
    if abs_d < 0.5:
        return "small"
    if abs_d < 0.8:
        return "medium"
    return "large"


def _cliffs_magnitude(abs_delta: float) -> str:
    if abs_delta < 0.147:
        return "negligible"
    if abs_delta < 0.33:
        return "small"
    if abs_delta < 0.474:
        return "medium"
    return "large"


def _direction(treatment_mean: float, baseline_mean: float) -> str:
    if treatment_mean > baseline_mean + 1e-12:
        return "treatment > baseline"
    if treatment_mean < baseline_mean - 1e-12:
        return "treatment < baseline"
    return "neutral"


def _direction_b(prop_greater: float, prop_less: float) -> str:
    if prop_greater > prop_less + 1e-12:
        return "treatment > baseline"
    if prop_less > prop_greater + 1e-12:
        return "treatment < baseline"
    return "neutral"
