from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

from intelligence.experiments.models import ExperimentMetrics, ExperimentRun


@dataclass(frozen=True)
class RunComparison:
    """Delta between two experiment runs.

    All deltas are **treatment minus baseline** so a positive *recall_delta*
    means the treatment run improved recall.
    """

    baseline_run_id: str
    treatment_run_id: str
    baseline_name: str = ""
    treatment_name: str = ""
    recall_delta: Optional[float] = None
    precision_delta: Optional[float] = None
    latency_delta_ms: Optional[float] = None
    success_rate_delta: Optional[float] = None
    fallback_rate_delta: Optional[float] = None
    ece_delta: Optional[float] = None
    mce_delta: Optional[float] = None
    brier_score_delta: Optional[float] = None
    score_lift_delta: Optional[float] = None
    metadata: Dict[str, str] = field(default_factory=dict)


def compare_runs(
    baseline: ExperimentRun,
    treatment: ExperimentRun,
) -> RunComparison:
    """Compute metric deltas between two experiment runs.

    Args:
        baseline:  The reference run.
        treatment: The run to compare against *baseline*.

    Returns:
        A :class:`RunComparison` with deltas for all shared metrics.
    """
    bm = baseline.metrics
    tm = treatment.metrics

    return RunComparison(
        baseline_run_id=baseline.run_id,
        treatment_run_id=treatment.run_id,
        baseline_name=baseline.name,
        treatment_name=treatment.name,
        recall_delta=_opt_sub(tm.recall, bm.recall),
        precision_delta=_opt_sub(tm.precision, bm.precision),
        latency_delta_ms=_opt_sub(tm.latency_ms, bm.latency_ms),
        success_rate_delta=_opt_sub(tm.success_rate, bm.success_rate),
        fallback_rate_delta=_opt_sub(tm.fallback_rate, bm.fallback_rate),
        ece_delta=_opt_sub(tm.ece, bm.ece),
        mce_delta=_opt_sub(tm.mce, bm.mce),
        brier_score_delta=_opt_sub(tm.brier_score, bm.brier_score),
        score_lift_delta=_opt_sub(tm.score_lift, bm.score_lift),
    )


def generate_comparison_report(
    comparisons: List[RunComparison],
    title: str = "Experiment Comparison Report",
) -> str:
    """Generate a Markdown comparison report."""
    lines = [
        f"# {title}",
        "",
    ]
    for comp in comparisons:
        lines.extend([
            f"## {comp.treatment_name} vs {comp.baseline_name}",
            "",
            f"- **Baseline:** {comp.baseline_run_id}",
            f"- **Treatment:** {comp.treatment_run_id}",
            "",
            "| Metric | Delta |",
            "| ------ | ----- |",
        ])
        metrics: List[Tuple[str, Optional[float]]] = [
            ("Recall", comp.recall_delta),
            ("Precision", comp.precision_delta),
            ("Latency (ms)", comp.latency_delta_ms),
            ("Success Rate", comp.success_rate_delta),
            ("Fallback Rate", comp.fallback_rate_delta),
            ("ECE", comp.ece_delta),
            ("MCE", comp.mce_delta),
            ("Brier Score", comp.brier_score_delta),
            ("Score Lift", comp.score_lift_delta),
        ]
        for name, val in metrics:
            formatted = _fmt_delta(val)
            lines.append(f"| {name:<18} | {formatted:<12} |")
        lines.append("")

    return "\n".join(lines)


def compute_ranking(
    runs: List[ExperimentRun],
    metric: str = "recall",
) -> List[Tuple[int, ExperimentRun, Optional[float]]]:
    """Rank runs by a given metric (higher is better).

    Returns sorted list of ``(rank, run, value)`` tuples.
    """
    scored: List[Tuple[Optional[float], ExperimentRun]] = []
    for run in runs:
        val = _get_metric_attr(run.metrics, metric)
        scored.append((val, run))

    scored.sort(key=lambda x: _sort_key(x[0]), reverse=True)
    result: List[Tuple[int, ExperimentRun, Optional[float]]] = []
    for i, (val, run) in enumerate(scored):
        result.append((i + 1, run, val))
    return result


def _opt_sub(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None:
        return None
    return a - b


def _fmt_delta(val: Optional[float]) -> str:
    if val is None:
        return "N/A"
    return f"{val:+.4f}"


def _sort_key(val: Optional[float]) -> float:
    return val if val is not None else float("-inf")


def _get_metric_attr(metrics: ExperimentMetrics, metric: str) -> Optional[float]:
    return {
        "precision": metrics.precision,
        "recall": metrics.recall,
        "latency_ms": metrics.latency_ms,
        "success_rate": metrics.success_rate,
        "fallback_rate": metrics.fallback_rate,
        "ece": metrics.ece,
        "mce": metrics.mce,
        "brier_score": metrics.brier_score,
        "score_lift": metrics.score_lift,
        "learned_avg_score": metrics.learned_avg_score,
        "static_avg_score": metrics.static_avg_score,
        "training_samples": metrics.training_samples,
        "avg_recall": metrics.avg_recall,
        "avg_precision": metrics.avg_precision,
    }.get(metric)
