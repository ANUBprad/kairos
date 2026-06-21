from __future__ import annotations

from intelligence.reporting.report_generator import generate_full_report
from intelligence.reporting.markdown_report import (
    generate_markdown_benchmark_report,
    generate_markdown_ablation_report,
    generate_markdown_statistical_report,
    generate_markdown_leaderboard_report,
)
from intelligence.reporting.html_report import generate_html_report
from intelligence.reporting.leaderboard import (
    rank_experiments,
    compute_composite_score,
)
from intelligence.reporting.visualization import (
    plot_metric_trend,
    plot_experiment_comparison,
    plot_benchmark_comparison,
    plot_ablation_impact,
)
from intelligence.reporting.reproducibility import (
    generate_experiment_manifest,
    generate_benchmark_manifest,
    generate_environment_snapshot,
)

__all__ = [
    "generate_full_report",
    "generate_markdown_benchmark_report",
    "generate_markdown_ablation_report",
    "generate_markdown_statistical_report",
    "generate_markdown_leaderboard_report",
    "generate_html_report",
    "rank_experiments",
    "compute_composite_score",
    "plot_metric_trend",
    "plot_experiment_comparison",
    "plot_benchmark_comparison",
    "plot_ablation_impact",
    "generate_experiment_manifest",
    "generate_benchmark_manifest",
    "generate_environment_snapshot",
]
