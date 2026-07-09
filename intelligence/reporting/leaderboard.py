from __future__ import annotations

from typing import Dict, List, Optional, Tuple

from intelligence.experiments.models import ExperimentMetrics, ExperimentRun


def rank_experiments(
    runs: List[ExperimentRun],
    metric: str = "recall",
    ascending: bool = False,
    include_secondary: bool = True,
    secondary_weight: float = 0.3,
) -> List[Tuple[int, ExperimentRun, Optional[float]]]:
    """Rank experiments by primary metric with optional composite scoring.

    Args:
        runs:                Experiment runs to rank.
        metric:              Primary metric (``"recall"``, ``"precision"``,
                             ``"composite"``, ``"latency_ms"``).
        ascending:           Sort ascending (e.g. for latency).
        include_secondary:   When True and metric is not ``"composite"``,
                             compute a composite score for display.
        secondary_weight:    Weight of secondary metric in composite score.
                             Composite = primary_weight * primary + (1 - primary_weight) * secondary.
                             Default 0.3 means recall=0.7, precision=0.3.

    Returns:
        List of ``(rank, run, score)`` sorted best-to-worst. *score* is the
        primary metric value (or composite if ``metric="composite"``).
    """
    scored: List[Tuple[Optional[float], ExperimentRun]] = []

    for run in runs:
        if run.metrics is None:
            scored.append((None, run))
            continue

        raw_score: Optional[float] = None
        if metric == "composite":
            raw_score = compute_composite_score(
                run.metrics,
                primary="recall",
                secondary="precision",
                primary_weight=1.0 - secondary_weight,
            )
        elif metric == "recall":
            raw_score = run.metrics.recall
        elif metric == "precision":
            raw_score = run.metrics.precision
        elif metric == "latency_ms":
            raw_score = run.metrics.latency_ms
        else:
            raw_score = getattr(run.metrics, metric, None)
            if raw_score is None:
                raw_score = run.metrics.recall

        scored.append((raw_score, run))

    # Sort: None scores go last
    scored.sort(
        key=lambda x: (
            0 if x[0] is not None else 1,
            x[0]
            if x[0] is not None
            else (float("-inf") if ascending else float("inf")),
        ),
        reverse=not ascending,
    )

    result: List[Tuple[int, ExperimentRun, Optional[float]]] = []
    for rank, (score, run) in enumerate(scored, start=1):
        display_score: Optional[float] = score
        if (
            score is not None
            and include_secondary
            and metric != "composite"
            and run.metrics is not None
        ):
            display_score = compute_composite_score(
                run.metrics,
                primary=metric,
                secondary=("precision" if metric != "precision" else "recall"),
                primary_weight=1.0 - secondary_weight,
            )
        result.append((rank, run, display_score))

    return result


def compute_composite_score(
    metrics: ExperimentMetrics,
    primary: str = "recall",
    secondary: str = "precision",
    primary_weight: float = 0.7,
    penalty_weight: float = 0.1,
) -> float:
    """Compute a weighted composite performance score.

    Formula:
        score = primary_weight * primary + (1 - primary_weight) * secondary
                - penalty_weight * log(1 + latency_ms / 1000)

    The latency penalty prevents excessive runtime from going unpunished.

    Returns:
        Composite score (higher is better).
    """
    p_val = getattr(metrics, primary, 0.0)
    s_val = getattr(metrics, secondary, 0.0)
    if p_val is None:
        p_val = 0.0
    if s_val is None:
        s_val = 0.0

    import math

    latency_ms = metrics.latency_ms if metrics.latency_ms is not None else 0.0
    penalty = penalty_weight * math.log1p(latency_ms / 1000.0)

    return primary_weight * p_val + (1.0 - primary_weight) * s_val - penalty


def leaderboard_to_dict(
    rankings: List[Tuple[int, ExperimentRun, Optional[float]]],
) -> Dict[str, object]:
    """Convert leaderboard to a JSON-serializable dict."""
    entries: List[Dict[str, object]] = []
    for rank, run, score in rankings:
        m = run.metrics
        entries.append(
            {
                "rank": rank,
                "run_id": run.run_id,
                "name": run.name,
                "phase": run.phase,
                "recall": m.recall,
                "precision": m.precision,
                "latency_ms": m.latency_ms,
                "score": score,
                "timestamp": str(run.timestamp),
            }
        )
    return {"leaderboard": entries, "count": len(entries)}
