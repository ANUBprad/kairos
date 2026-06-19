"""Comparison charts — grouped bar charts for recall, precision, latency, failure rates.

Each chart reads from the saved JSON result files and produces a PNG
with baseline vs treatment side-by-side per query type.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Tuple

# ---------------------------------------------------------------------------
# Path helpers
# ---------------------------------------------------------------------------

_QTY_ORDER = ["simple", "complex", "multi_hop"]

_COLORS = {
    "baseline": (0.4, 0.6, 0.9, 0.85),  # muted blue
    "treatment": (0.9, 0.5, 0.3, 0.85),  # muted orange
}


def _qty_index(qt: str) -> int:
    return _QTY_ORDER.index(qt) if qt in _QTY_ORDER else -1


def _load(path: os.PathLike[str]) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)  # type: ignore[no-any-return]


# ---------------------------------------------------------------------------
# Chart generators
# ---------------------------------------------------------------------------


def _plot_grouped_bars(
    ax: object,
    labels: List[str],
    baseline_vals: List[float],
    treatment_vals: List[float],
    ylabel: str,
    title: str,
    rot: int = 0,
) -> None:
    """Draw a grouped bar chart on *ax*."""
    import matplotlib.pyplot as plt

    n = len(labels)
    x = list(range(n))
    w = 0.35

    bars_b = ax.bar(  # type: ignore[union-attr]
        [xi - w / 2 for xi in x],
        baseline_vals,
        w,
        label="Baseline",
        color=_COLORS["baseline"],
        edgecolor="black",
        linewidth=0.5,
    )
    bars_t = ax.bar(  # type: ignore[union-attr]
        [xi + w / 2 for xi in x],
        treatment_vals,
        w,
        label="Treatment",
        color=_COLORS["treatment"],
        edgecolor="black",
        linewidth=0.5,
    )

    ax.set_xticks(x)  # type: ignore[union-attr]
    ax.set_xticklabels(labels, rotation=rot)  # type: ignore[union-attr]
    ax.set_ylabel(ylabel)  # type: ignore[union-attr]
    ax.set_title(title)  # type: ignore[union-attr]
    ax.legend()  # type: ignore[union-attr]

    # Value labels on bars
    for bar in bars_b:
        _add_bar_label(ax, bar)
    for bar in bars_t:
        _add_bar_label(ax, bar)


def _add_bar_label(ax: object, bar: object) -> None:
    """Annotate a single bar with its height."""
    import matplotlib.pyplot as plt

    h = bar.get_height()
    if h != 0:
        ax.text(  # type: ignore[union-attr]
            bar.get_x() + bar.get_width() / 2,
            h,
            f"{h:.2f}",
            ha="center",
            va="bottom",
            fontsize=8,
        )


def _save_fig(path: os.PathLike[str]) -> None:
    import matplotlib.pyplot as plt

    plt.tight_layout()
    plt.savefig(path, dpi=150, bbox_inches="tight")
    plt.close()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def recall_comparison(
    baseline: dict,
    treatment: dict,
    output_path: os.PathLike[str],
) -> None:
    """Bar chart: average recall per query type."""
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 4))

    labels: List[str] = []
    b_vals: List[float] = []
    t_vals: List[float] = []

    b_recall = baseline.get("per_type", {}).get("recall", {})
    t_recall = treatment.get("per_type", {}).get("recall", {})

    for qt in _QTY_ORDER:
        labels.append(qt)
        b_vals.append(b_recall.get(qt, 0.0) or 0.0)
        t_vals.append(t_recall.get(qt, 0.0) or 0.0)

    _plot_grouped_bars(
        ax,
        labels,
        b_vals,
        t_vals,
        ylabel="Recall",
        title="Retrieval Recall by Query Type",
    )
    _save_fig(output_path)


def precision_comparison(
    baseline: dict,
    treatment: dict,
    output_path: os.PathLike[str],
) -> None:
    """Bar chart: average precision per query type."""
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 4))

    labels: List[str] = []
    b_vals: List[float] = []
    t_vals: List[float] = []

    b_prec = baseline.get("per_type", {}).get("precision", {})
    t_prec = treatment.get("per_type", {}).get("precision", {})

    for qt in _QTY_ORDER:
        labels.append(qt)
        b_vals.append(b_prec.get(qt, 0.0) or 0.0)
        t_vals.append(t_prec.get(qt, 0.0) or 0.0)

    _plot_grouped_bars(
        ax,
        labels,
        b_vals,
        t_vals,
        ylabel="Precision",
        title="Retrieval Precision by Query Type",
    )
    _save_fig(output_path)


def latency_comparison(
    baseline: dict,
    treatment: dict,
    output_path: os.PathLike[str],
) -> None:
    """Bar chart: average total latency per query type."""
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(6, 4))

    labels: List[str] = []
    b_vals: List[float] = []
    t_vals: List[float] = []

    b_lat = baseline.get("per_type", {}).get("latency", {})
    t_lat = treatment.get("per_type", {}).get("latency", {})

    n_b = baseline["metadata"]["total_queries"]
    n_t = treatment["metadata"]["total_queries"]

    for qt in _QTY_ORDER:
        labels.append(qt)
        bl = b_lat.get(qt, {})
        tl = t_lat.get(qt, {})
        b_vals.append(bl.get("total", 0.0) / (n_b / 3) if n_b else 0.0)
        t_vals.append(tl.get("total", 0.0) / (n_t / 3) if n_t else 0.0)

    _plot_grouped_bars(
        ax,
        labels,
        b_vals,
        t_vals,
        ylabel="Avg Latency (s)",
        title="Average Total Latency by Query Type",
    )
    _save_fig(output_path)


def failure_rate_comparison(
    baseline: dict,
    treatment: dict,
    output_path: os.PathLike[str],
) -> None:
    """Grouped bar chart: per-category failure rates."""
    import matplotlib.pyplot as plt

    cats = [
        "empty_retrieval_rate",
        "timeout_rate",
        "planner_fallback_rate",
        "generation_failure_rate",
        "overall_failure_rate",
    ]
    labels = [c.replace("_rate", "").replace("_", " ") for c in cats]

    b_rates = baseline.get("aggregate", {}).get("failure_rates", {})
    t_rates = treatment.get("aggregate", {}).get("failure_rates", {})

    b_vals = [b_rates.get(c, 0.0) for c in cats]
    t_vals = [t_rates.get(c, 0.0) for c in cats]

    fig, ax = plt.subplots(figsize=(7, 4))
    _plot_grouped_bars(
        ax,
        labels,
        b_vals,
        t_vals,
        ylabel="Failure Rate",
        title="Failure Rate Comparison",
        rot=15,
    )
    _save_fig(output_path)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

REPORT_DIR = Path(__file__).resolve().parent.parent.parent / "benchmarks" / "results"

_CHART_FILES = {
    "recall": "recall_comparison.png",
    "precision": "precision_comparison.png",
    "latency": "latency_comparison.png",
    "failure_rate": "failure_rate_comparison.png",
}


def generate_all_charts(
    baseline_path: os.PathLike[str] | None = None,
    treatment_path: os.PathLike[str] | None = None,
    output_dir: os.PathLike[str] | None = None,
) -> Dict[str, str]:
    """Generate all four comparison charts.

    Parameters
    ----------
    baseline_path:
        Path to ``baseline_results.json``.  Defaults to
        ``benchmarks/results/baseline_results.json``.
    treatment_path:
        Path to ``treatment_results.json``.  Defaults to
        ``benchmarks/results/treatment_results.json``.
    output_dir:
        Directory for PNG output.  Defaults to
        ``benchmarks/results/``.

    Returns
    -------
    dict
        Mapping from metric name to output file path.
    """
    bp = baseline_path or (REPORT_DIR / "baseline_results.json")
    tp = treatment_path or (REPORT_DIR / "treatment_results.json")
    od = Path(output_dir) if output_dir else REPORT_DIR
    od.mkdir(parents=True, exist_ok=True)

    baseline = _load(bp)
    treatment = _load(tp)

    out: Dict[str, str] = {}
    for name, fname in _CHART_FILES.items():
        dest = od / fname
        if name == "recall":
            recall_comparison(baseline, treatment, dest)
        elif name == "precision":
            precision_comparison(baseline, treatment, dest)
        elif name == "latency":
            latency_comparison(baseline, treatment, dest)
        elif name == "failure_rate":
            failure_rate_comparison(baseline, treatment, dest)
        out[name] = str(dest)

    return out


if __name__ == "__main__":
    result = generate_all_charts()
    print("Generated charts:")
    for k, v in result.items():
        print(f"  {k}: {v}")
