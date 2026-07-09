from __future__ import annotations

from typing import List, Optional, Tuple

from intelligence.ablation.comparison import AblationComparison
from intelligence.benchmarks.benchmark_result import BenchmarkResult
from intelligence.statistics.reporting import ValidationResult


def generate_markdown_benchmark_report(
    results: List[BenchmarkResult],
    title: str = "Benchmark Evaluation",
) -> str:
    """Generate a Markdown benchmark report.

    Includes per-dataset tables, aggregate summary, and per-metric breakdown.
    """
    lines: List[str] = [
        f"## {title}",
        "",
    ]
    if not results:
        lines.append("_No benchmark results._\n")
        return "\n".join(lines)

    # -- Aggregate summary --
    from intelligence.benchmarks.benchmark_result import aggregate_results

    agg = aggregate_results(results)
    lines.extend(
        [
            "### Aggregate Summary",
            "",
            "| Metric | Value |",
            "| ------ | ----- |",
            f"| Datasets | {agg['dataset_count']} |",
            f"| Total Queries | {agg['total_queries']} |",
            f"| Average Recall | {_fmt(agg['average_recall'])} |",
            f"| Average Precision | {_fmt(agg['average_precision'])} |",
            f"| Average Latency (ms) | {agg['average_latency_ms']:.1f} |",
            f"| Average Success Rate | {agg['average_success_rate']:.2%} |",
            f"| Average Fallback Rate | {agg['average_fallback_rate']:.2%} |",
            "",
        ]
    )

    # -- Per-dataset table --
    lines.extend(
        [
            "### Per-Dataset Metrics",
            "",
            "| Dataset | Queries | Recall | Precision | Latency (ms) | Success | Fallback |",
            "| ------- | ------- | ------ | --------- | ------------ | ------- | -------- |",
        ]
    )
    for r in results:
        lines.append(
            f"| {r.dataset_name:<20} "
            f"| {r.query_count:>7} "
            f"| {_fmt(r.average_recall):<10} "
            f"| {_fmt(r.average_precision):<10} "
            f"| {r.average_latency_ms:>8.1f} "
            f"| {r.success_rate:>5.1%} "
            f"| {r.fallback_rate:>5.1%} |"
        )
    lines.append("")

    # -- Detailed metric breakdown --
    for r in results:
        lines.extend(
            [
                f"### Dataset: {r.dataset_name}",
                "",
                f"- **Queries:** {r.query_count}",
                f"- **Recall:** {_fmt(r.average_recall)}",
                f"- **Precision:** {_fmt(r.average_precision)}",
                f"- **Latency (ms):** {r.average_latency_ms:.1f}",
                f"- **Success Rate:** {r.success_rate:.2%}",
                f"- **Fallback Rate:** {r.fallback_rate:.2%}",
                "",
                "| Metric | Value |",
                "| ------ | ----- |",
            ]
        )
        for k, v in sorted(r.metrics.items()):
            if isinstance(v, float):
                lines.append(f"| {k} | {v:.4f} |")
            else:
                lines.append(f"| {k} | {v} |")
        lines.append("")

    return "\n".join(lines)


def generate_markdown_ablation_report(
    comparisons: List[AblationComparison],
    title: str = "Ablation Study",
) -> str:
    """Generate a Markdown ablation report with delta tables."""
    lines: List[str] = [
        f"## {title}",
        "",
    ]
    if not comparisons:
        lines.append("_No ablation comparisons._\n")
        return "\n".join(lines)

    for i, comp in enumerate(comparisons):
        lines.extend(
            [
                f"### {comp.treatment_label} vs {comp.baseline_label}",
                "",
                f"- **Total Queries:** {comp.total_queries}",
                "",
                "| Component | Delta | Direction |",
                "| --------- | ----- | --------- |",
            ]
        )

        metrics: List[Tuple[str, Optional[float], bool]] = [
            ("Recall", comp.recall_delta, False),
            ("Precision", comp.precision_delta, False),
            ("Latency (ms)", comp.latency_delta_ms, True),
            ("Success Rate", comp.success_rate_delta, False),
            ("Fallback Rate", comp.fallback_rate_delta, True),
        ]
        for name, val, lower_better in metrics:
            if val is None:
                delta_str = "N/A"
                direction = "N/A"
            else:
                delta_str = f"{val:+.2%}" if name != "Latency (ms)" else f"{val:+.1f}"
                if lower_better:
                    direction = (
                        "Better" if val < 0 else "Worse" if val > 0 else "Neutral"
                    )
                else:
                    direction = (
                        "Better" if val > 0 else "Worse" if val < 0 else "Neutral"
                    )
            lines.append(f"| {name:<18} | {delta_str:<12} | {direction:<9} |")

        if comp.validation:
            v = comp.validation
            lines.append("")
            lines.append(f"**Statistical Validation:** {v.summary}")

        lines.append("")

    return "\n".join(lines)


def generate_markdown_statistical_report(
    validation: ValidationResult,
    title: str = "Statistical Validation",
) -> str:
    """Generate a Markdown statistical validation report."""
    lines: List[str] = [
        f"### {title}",
        "",
        f"**Metric:** {validation.metric_name}",
        f"**Baseline:** {validation.baseline_label}",
        f"**Treatment:** {validation.treatment_label}",
        f"**Observations:** {validation.n_observations}",
        f"**Summary:** {validation.summary}",
        "",
    ]

    # -- Significance tests --
    lines.extend(
        [
            "#### Significance Tests",
            "",
            "| Test | Statistic | p-value | Significant (α=0.05)? |",
            "| ---- | --------- | ------- | ---------------------- |",
        ]
    )
    for name, sig in validation.significance.items():
        lines.append(
            f"| {name:<20} | {sig.statistic:>9.4f} | {sig.p_value:>7.4f} | "
            f"{'Yes' if sig.significant else 'No':<4} |"
        )
    lines.append("")

    # -- Confidence intervals --
    lines.extend(
        [
            "#### Confidence Intervals (95%)",
            "",
            "| Group | Mean | Std Err | Lower | Upper | Method |",
            "| ----- | ---- | ------- | ----- | ----- | ------ |",
        ]
    )
    for label, ci in validation.confidence_intervals.items():
        lines.append(
            f"| {label:<25} | {ci.mean:>6.4f} | {ci.std_err:>7.4f} | "
            f"{ci.lower_bound:>6.4f} | {ci.upper_bound:>6.4f} | {ci.method:<25} |"
        )
    lines.append("")

    # -- Effect sizes --
    lines.extend(
        [
            "#### Effect Sizes",
            "",
            "| Measure | Value | Magnitude | Direction |",
            "| ------- | ----- | --------- | --------- |",
        ]
    )
    for name, es in validation.effect_sizes.items():
        lines.append(
            f"| {name:<15} | {es.value:>6.4f} | {es.magnitude:<10} | "
            f"{es.direction:<22} |"
        )
    lines.append("")

    # -- Bootstrap --
    if validation.bootstrap:
        bs = validation.bootstrap
        lines.extend(
            [
                "#### Bootstrap Evaluation",
                "",
                f"- **Point Estimate:** {bs.point_estimate:.4f}",
                f"- **Bias:** {bs.bias:.4f}",
                f"- **Standard Error:** {bs.std_error:.4f}",
                f"- **95% CI:** [{bs.ci_lower:.4f}, {bs.ci_upper:.4f}]",
                f"- **Resamples:** {bs.n_resamples}",
                "",
            ]
        )

    return "\n".join(lines)


def generate_markdown_leaderboard_report(
    rankings: List[Tuple[int, object, Optional[float]]],
    title: str = "Experiment Leaderboard",
) -> str:
    """Generate a Markdown leaderboard from ranked experiments.

    Args:
        rankings: List of ``(rank, experiment_run, metric_value)`` tuples
                  from :func:`rank_experiments`.
        title:    Section title.

    Returns:
        Markdown string.
    """
    lines: List[str] = [
        f"## {title}",
        "",
        "| Rank | Name | Phase | Recall | Precision | Latency (ms) | Score |",
        "| ---- | ---- | ----- | ------ | --------- | ------------ | ----- |",
    ]

    from intelligence.experiments.models import ExperimentRun

    for rank, run, score in rankings:
        if not isinstance(run, ExperimentRun):
            continue
        m = run.metrics
        lines.append(
            f"| {rank:>4} | {run.name:<20} | {run.phase:<10} "
            f"| {_fmt(m.recall):<10} | {_fmt(m.precision):<10} "
            f"| {m.latency_ms:>6.1f} ms | {_fmt(score):<10} |"
        )
    lines.append("")
    return "\n".join(lines)


def _fmt(val: object, fmt: str = ".4f") -> str:
    if val is None:
        return "N/A"
    if isinstance(val, float):
        return f"{val:{fmt}}"
    return str(val)
