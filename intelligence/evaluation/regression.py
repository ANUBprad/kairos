"""Regression + drift baseline for evaluation runs.

Persists a JSON snapshot of :class:`RunResult` aggregates and compares a
later run against it, using per-metric absolute thresholds. Pure stdlib —
no new dependencies. Gate consumers (CLI ``--baseline``, Phase E quality
gates, Phase F CI job) all feed from :func:`check_regression`.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Dict, Optional

from intelligence.evaluation.entry_result import RunResult

# Default absolute tolerances, one per aggregate metric key emitted by
# RunResult.to_dict(). Small absolute overrides are sturdier than relative
# deltas for near-1.0 metrics (a 1% relative slip would be |0.01| anyway),
# and unambiguous for latency/cost.
DEFAULT_TOLERANCES: Dict[str, float] = {
    "success_rate": 0.05,
    "mean_recall": 0.05,
    "mean_precision": 0.05,
    "mean_judge_scores": 0.1,
    "mean_latency.total": 0.25,
    "total_cost_usd": 0.2,
}
# Metrics where lower is better (latency, cost). Absent metrics default to
# higher-is-better.
_LOWER_IS_BETTER = {
    "mean_latency.classify",
    "mean_latency.retrieval",
    "mean_latency.generation",
    "mean_latency.total",
    "total_cost_usd",
    "total_tokens.prompt_tokens",
    "total_tokens.completion_tokens",
}


def _flatten(agg: Dict[str, object], prefix: str = "") -> Dict[str, float]:
    flat: Dict[str, float] = {}
    for key, value in agg.items():
        fq = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            flat.update(_flatten(value, fq))
        elif isinstance(value, (int, float)):
            flat[fq] = float(value)
    return flat


def snapshot(result: RunResult) -> Dict[str, float]:
    """Flatten a run's aggregates into a comparable metric map."""
    return _flatten(result.to_dict())


def save_baseline(result: RunResult, path: str) -> None:
    """Persist the run's aggregates as a JSON baseline snapshot."""
    payload = {
        "version": 1,
        "metrics": snapshot(result),
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)


def load_baseline(path: str) -> Dict[str, float]:
    """Load a baseline snapshot written by :func:`save_baseline`."""
    with open(path, "r", encoding="utf-8") as f:
        payload = json.load(f)
    return dict(payload["metrics"])


@dataclass(frozen=True)
class MetricDelta:
    metric: str
    baseline: float
    current: float
    tolerance: float
    passed: bool

    @property
    def delta(self) -> float:
        return self.current - self.baseline


@dataclass
class RegressionCheck:
    """Result of comparing one run against a baseline snapshot."""

    passed: bool
    deltas: Dict[str, MetricDelta] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "passed": self.passed,
            "regressions": {
                metric: {
                    "baseline": d.baseline,
                    "current": d.current,
                    "delta": d.delta,
                    "tolerance": d.tolerance,
                }
                for metric, d in self.deltas.items()
                if not d.passed
            },
        }


def check_regression(
    result: RunResult,
    baseline_path: str,
    tolerances: Optional[Dict[str, float]] = None,
) -> RegressionCheck:
    """Compare a run against a baseline JSON snapshot.

    Each baseline metric must stay within ``tolerance`` of the baseline:
    higher-is-better metrics may not fall below ``baseline - tol``,
    lower-is-better metrics may not rise above ``baseline + tol``. Metrics
    in the current run but missing from the baseline are ignored; metrics
    in the baseline but missing now count as regressions.
    """
    baseline = load_baseline(baseline_path)
    current = snapshot(result)
    effective = dict(DEFAULT_TOLERANCES)
    if tolerances:
        effective.update(tolerances)

    deltas: Dict[str, MetricDelta] = {}
    for metric, b_value in baseline.items():
        if metric not in current:
            deltas[metric] = MetricDelta(
                metric, b_value, 0.0, effective.get(metric, 0.05), False
            )
            continue
        c_value = current[metric]
        tol = effective.get(metric, 0.05)
        if metric in _LOWER_IS_BETTER:
            passed = c_value <= b_value + tol
        else:
            passed = c_value >= b_value - tol
        deltas[metric] = MetricDelta(metric, b_value, c_value, tol, passed)

    return RegressionCheck(passed=all(d.passed for d in deltas.values()), deltas=deltas)
