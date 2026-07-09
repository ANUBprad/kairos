from __future__ import annotations

import io
from typing import List, Optional, Tuple

from intelligence.ablation.comparison import AblationComparison
from intelligence.benchmarks.benchmark_result import BenchmarkResult
from intelligence.experiments.models import ExperimentRun


def _import_plt():
    """Lazy import matplotlib.pyplot."""
    import matplotlib

    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    return plt


def plot_metric_trend(
    runs: List[ExperimentRun],
    metric: str = "recall",
    title: str = "Metric Trend",
    figsize: Tuple[float, float] = (8, 4),
) -> bytes:
    """Plot a metric across experiment runs (ordered by timestamp).

    Returns:
        PNG image bytes.
    """
    plt = _import_plt()
    fig, ax = plt.subplots(figsize=figsize)

    sorted_runs = sorted(
        [r for r in runs if r.metrics is not None],
        key=lambda r: r.timestamp,
    )
    if not sorted_runs:
        ax.text(0.5, 0.5, "No data", ha="center", va="center", transform=ax.transAxes)
        return _fig_to_bytes(fig)

    m_val: List[Optional[float]] = [
        getattr(r.metrics, metric, None) for r in sorted_runs
    ]
    labels = [r.name or r.run_id[:8] for r in sorted_runs]

    valid = [(v, lbl) for v, lbl in zip(m_val, labels) if v is not None]
    if not valid:
        ax.text(
            0.5, 0.5, "No valid data", ha="center", va="center", transform=ax.transAxes
        )
        return _fig_to_bytes(fig)

    values, lbls = zip(*valid)
    ax.plot(range(len(values)), values, marker="o", linestyle="-", color="#4361ee")
    ax.set_xticks(range(len(values)))
    ax.set_xticklabels(lbls, rotation=45, ha="right", fontsize=8)
    ax.set_ylabel(metric.replace("_", " ").title())
    ax.set_title(title)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    return _fig_to_bytes(fig)


def plot_experiment_comparison(
    runs: List[ExperimentRun],
    metrics: Optional[List[str]] = None,
    title: str = "Experiment Comparison",
    figsize: Tuple[float, float] = (10, 5),
) -> bytes:
    """Grouped bar chart comparing multiple metrics across runs.

    Returns:
        PNG image bytes.
    """
    plt = _import_plt()
    if metrics is None:
        metrics = ["recall", "precision"]

    valid_runs = [r for r in runs if r.metrics is not None]
    if not valid_runs:
        fig, ax = plt.subplots(figsize=figsize)
        ax.text(0.5, 0.5, "No data", ha="center", va="center", transform=ax.transAxes)
        return _fig_to_bytes(fig)

    n_groups = len(valid_runs)
    n_metrics = len(metrics)
    fig, ax = plt.subplots(figsize=figsize)

    x = [i * (n_metrics + 1) for i in range(n_groups)]
    bar_width = 0.8
    colors = ["#4361ee", "#f72585", "#7209b7", "#4cc9f0", "#e63946"]

    for mi, m_name in enumerate(metrics):
        vals = []
        for r in valid_runs:
            v = getattr(r.metrics, m_name, None)
            vals.append(v if v is not None else 0.0)
        offset = (mi - (n_metrics - 1) / 2) * bar_width
        ax.bar(
            [xi + offset for xi in x],
            vals,
            bar_width,
            label=m_name.replace("_", " ").title(),
            color=colors[mi % len(colors)],
        )

    ax.set_xticks(x)
    ax.set_xticklabels(
        [r.name or r.run_id[:8] for r in valid_runs],
        rotation=45,
        ha="right",
        fontsize=8,
    )
    ax.set_ylabel("Score")
    ax.set_title(title)
    ax.legend(fontsize=9)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    return _fig_to_bytes(fig)


def plot_benchmark_comparison(
    results: List[BenchmarkResult],
    metric: str = "average_recall",
    title: str = "Benchmark Comparison",
    figsize: Tuple[float, float] = (8, 4),
) -> bytes:
    """Bar chart comparing a metric across benchmark datasets.

    Returns:
        PNG image bytes.
    """
    plt = _import_plt()
    fig, ax = plt.subplots(figsize=figsize)

    if not results:
        ax.text(0.5, 0.5, "No data", ha="center", va="center", transform=ax.transAxes)
        return _fig_to_bytes(fig)

    names = [r.dataset_name for r in results]
    vals = [getattr(r, metric, 0.0) or 0.0 for r in results]

    bars = ax.bar(range(len(names)), vals, color="#4361ee")
    ax.set_xticks(range(len(names)))
    ax.set_xticklabels(names, rotation=45, ha="right", fontsize=9)
    ax.set_ylabel(metric.replace("_", " ").title())
    ax.set_title(title)
    ax.grid(axis="y", alpha=0.3)

    for bar, v in zip(bars, vals):
        ax.text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max(vals) * 0.01,
            f"{v:.2f}" if v < 1 else f"{v:.1f}",
            ha="center",
            va="bottom",
            fontsize=8,
        )

    fig.tight_layout()
    return _fig_to_bytes(fig)


def plot_ablation_impact(
    comparisons: List[AblationComparison],
    title: str = "Ablation Impact",
    figsize: Tuple[float, float] = (8, 6),
) -> bytes:
    """Horizontal bar chart showing delta impact per ablation component.

    Positive deltas (improvement) appear to the right; negative to the left.

    Returns:
        PNG image bytes.
    """
    plt = _import_plt()
    fig, ax = plt.subplots(figsize=figsize)

    if not comparisons:
        ax.text(0.5, 0.5, "No data", ha="center", va="center", transform=ax.transAxes)
        return _fig_to_bytes(fig)

    rows: List[Tuple[str, float, str]] = []
    for comp in comparisons:
        label = f"{comp.treatment_label} vs {comp.baseline_label}"
        for metric_name, delta in [
            ("Recall", comp.recall_delta),
            ("Precision", comp.precision_delta),
        ]:
            if delta is not None:
                rows.append((label, delta, metric_name))

    if not rows:
        ax.text(
            0.5, 0.5, "No delta data", ha="center", va="center", transform=ax.transAxes
        )
        return _fig_to_bytes(fig)

    y_labels = [f"{r[2]}: {r[0]}" for r in rows]
    deltas = [r[1] for r in rows]
    colors = ["#06d6a0" if d >= 0 else "#ef476f" for d in deltas]

    ax.barh(range(len(y_labels)), deltas, color=colors)
    ax.set_yticks(range(len(y_labels)))
    ax.set_yticklabels(y_labels, fontsize=8)
    ax.axvline(0, color="gray", linestyle="-", linewidth=0.5)
    ax.set_xlabel("Delta")
    ax.set_title(title)
    ax.grid(axis="x", alpha=0.3)
    fig.tight_layout()
    return _fig_to_bytes(fig)


def _fig_to_bytes(fig) -> bytes:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=150)
    buf.seek(0)
    data = buf.read()
    import matplotlib.pyplot as plt

    plt.close(fig)
    return data
