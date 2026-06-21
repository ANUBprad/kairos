from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List, Optional, Sequence, Tuple

from benchmarks.runner import RunnerResult

from intelligence.ablation.config import AblationConfig


@dataclass(frozen=True)
class AblationComparison:
    """Structured delta between two ablation runs.

    All deltas are **treatment minus baseline** so a positive ``recall_delta``
    means the treatment configuration improved recall.

    Attributes:
        baseline_label:      Label of the baseline configuration.
        treatment_label:     Label of the treatment configuration.
        total_queries:       Number of queries in each run (must match).
        recall_delta:        Treatment recall minus baseline recall.
        precision_delta:     Treatment precision minus baseline precision.
        latency_delta_ms:    Treatment avg latency minus baseline avg latency (ms).
        success_rate_delta:  Treatment success rate minus baseline success rate.
        fallback_rate_delta: Treatment fallback rate minus baseline fallback rate.
        per_type_recall_delta:   Recall delta by query type.
        per_type_precision_delta: Precision delta by query type.
        per_type_latency_delta_ms:  Latency delta (ms) by query type.
    """

    baseline_label: str = ""
    treatment_label: str = ""
    total_queries: int = 0
    recall_delta: Optional[float] = None
    precision_delta: Optional[float] = None
    latency_delta_ms: float = 0.0
    success_rate_delta: float = 0.0
    fallback_rate_delta: float = 0.0
    per_type_recall_delta: Dict[str, Optional[float]] = field(default_factory=dict)
    per_type_precision_delta: Dict[str, Optional[float]] = field(default_factory=dict)
    per_type_latency_delta_ms: Dict[str, float] = field(default_factory=dict)
    metadata: Dict[str, str] = field(default_factory=dict)
    validation: Optional["ValidationResult"] = None


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def compare_runs(
    baseline: RunnerResult,
    treatment: RunnerResult,
    baseline_label: str = "Baseline",
    treatment_label: str = "Treatment",
    metric_name: str = "recall",
    include_validation: bool = True,
) -> AblationComparison:
    """Compute metric deltas between two ablation runs.

    Args:
        baseline:   Result from the baseline ablation configuration.
        treatment:  Result from the treatment ablation configuration.
        baseline_label:  Human-readable label for the baseline.
        treatment_label: Human-readable label for the treatment.
        metric_name: Which per-query metric to validate (default ``"recall"``).
        include_validation: Whether to run statistical validation.

    Returns:
        An :class:`AblationComparison` with all computed deltas, optionally
        including a :class:`ValidationResult`.

    Raises:
        ValueError: If the two runs have different query counts.
    """
    if baseline.total_queries != treatment.total_queries:
        raise ValueError(
            f"Baseline ({baseline.total_queries}) and treatment "
            f"({treatment.total_queries}) must have the same number of queries"
        )

    total = baseline.total_queries

    recall_delta = _opt_sub(treatment.average_recall(), baseline.average_recall())
    precision_delta = _opt_sub(treatment.average_precision(), baseline.average_precision())
    latency_delta_ms = (
        treatment.average_latency().total - baseline.average_latency().total
    ) * 1000.0

    b_fails = baseline.aggregated_failures()
    t_fails = treatment.aggregated_failures()
    b_total = b_fails.total_queries or total
    t_total = t_fails.total_queries or total
    b_success = 1.0 - (b_fails.timeout + b_fails.empty_retrieval) / b_total if b_total else 1.0
    t_success = 1.0 - (t_fails.timeout + t_fails.empty_retrieval) / t_total if t_total else 1.0
    success_rate_delta = t_success - b_success

    b_fallback_rate = b_fails.planner_fallback / b_total if b_total else 0.0
    t_fallback_rate = t_fails.planner_fallback / t_total if t_total else 0.0
    fallback_rate_delta = t_fallback_rate - b_fallback_rate

    per_type_recall_delta: Dict[str, Optional[float]] = {}
    per_type_precision_delta: Dict[str, Optional[float]] = {}
    per_type_latency_delta_ms: Dict[str, float] = {}

    all_types = sorted(
        set(baseline.per_type_recall()) | set(treatment.per_type_recall())
    )
    for qt in all_types:
        per_type_recall_delta[qt] = _opt_sub(
            treatment.per_type_recall().get(qt), baseline.per_type_recall().get(qt)
        )
        per_type_precision_delta[qt] = _opt_sub(
            treatment.per_type_precision().get(qt), baseline.per_type_precision().get(qt)
        )

        bl = baseline.per_type_latency().get(qt)
        tl = treatment.per_type_latency().get(qt)
        bl_avg = bl.total / baseline.total_queries if bl else 0.0
        tl_avg = tl.total / treatment.total_queries if tl else 0.0
        per_type_latency_delta_ms[qt] = (tl_avg - bl_avg) * 1000.0

    validation_result = None
    if include_validation:
        try:
            from intelligence.statistics.reporting import generate_validation_report

            bl_vals = [
                getattr(r, metric_name, 0.0) or 0.0
                for r in baseline.results
            ]
            tr_vals = [
                getattr(r, metric_name, 0.0) or 0.0
                for r in treatment.results
            ]
            if len(bl_vals) == total and len(tr_vals) == total:
                validation_result = generate_validation_report(
                    baseline=bl_vals,
                    treatment=tr_vals,
                    metric_name=metric_name,
                    baseline_label=baseline_label,
                    treatment_label=treatment_label,
                )
        except Exception:
            validation_result = None

    return AblationComparison(
        baseline_label=baseline_label,
        treatment_label=treatment_label,
        total_queries=total,
        recall_delta=recall_delta,
        precision_delta=precision_delta,
        latency_delta_ms=latency_delta_ms,
        success_rate_delta=success_rate_delta,
        fallback_rate_delta=fallback_rate_delta,
        per_type_recall_delta=per_type_recall_delta,
        per_type_precision_delta=per_type_precision_delta,
        per_type_latency_delta_ms=per_type_latency_delta_ms,
        metadata={
            "generated_at": datetime.now().isoformat(),
        },
        validation=validation_result,
    )


def compare_multiple(
    results: Dict[str, RunnerResult],
) -> List[AblationComparison]:
    """Compare every configuration against the first (baseline) entry.

    Args:
        results:  Dict mapping config labels to ``RunnerResult`` objects.
                  The first entry (insertion order) is treated as the baseline.

    Returns:
        List of :class:`AblationComparison` objects, one per non-baseline run.
    """
    labels = list(results.keys())
    if len(labels) < 2:
        return []

    baseline_label = labels[0]
    baseline_result = results[baseline_label]
    comparisons: List[AblationComparison] = []

    for label in labels[1:]:
        comp = compare_runs(
            baseline=baseline_result,
            treatment=results[label],
            baseline_label=baseline_label,
            treatment_label=label,
        )
        comparisons.append(comp)

    return comparisons


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


def generate_ablation_report(
    comparisons: List[AblationComparison],
    title: str = "Ablation Study Report",
) -> str:
    """Generate a Markdown ablation study report from comparisons."""
    lines = [
        f"# {title}",
        "",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
    ]

    for i, comp in enumerate(comparisons):
        lines.extend([
            f"## {i + 1}. {comp.treatment_label} vs {comp.baseline_label}",
            "",
            f"- **Total Queries:** {comp.total_queries}",
            "",
            "### Aggregate Metrics",
            "",
            "| Metric | Delta | Direction |",
            "| ------ | ----- | --------- |",
        ])

        metrics: List[Tuple[str, str, str]] = [
            ("Recall", _fmt_opt_float(comp.recall_delta, "%+.2f%%"), _direction(comp.recall_delta)),
            ("Precision", _fmt_opt_float(comp.precision_delta, "%+.2f%%"), _direction(comp.precision_delta)),
            ("Latency (ms)", f"{comp.latency_delta_ms:+.1f}", _direction(comp.latency_delta_ms, lower_is_better=True)),
            ("Success Rate", f"{comp.success_rate_delta:+.2%}", _direction(comp.success_rate_delta)),
            ("Fallback Rate", f"{comp.fallback_rate_delta:+.2%}", _direction(comp.fallback_rate_delta, lower_is_better=True)),
        ]
        for name, value, direction in metrics:
            lines.append(f"| {name:<18} | {value:<18} | {direction:<9} |")

        lines.append("")
        lines.append("### Per-Type Recall Delta")
        lines.append("")
        lines.append("| Query Type | Delta |")
        lines.append("| ---------- | ----- |")
        for qt, delta in sorted(comp.per_type_recall_delta.items()):
            lines.append(f"| {qt:<10} | {_fmt_opt_float(delta, '%+.2f%%'):<18} |")
        lines.append("")

        lines.append("### Per-Type Precision Delta")
        lines.append("")
        lines.append("| Query Type | Delta |")
        lines.append("| ---------- | ----- |")
        for qt, delta in sorted(comp.per_type_precision_delta.items()):
            lines.append(f"| {qt:<10} | {_fmt_opt_float(delta, '%+.2f%%'):<18} |")
        lines.append("")

        lines.append("### Per-Type Latency Delta (ms)")
        lines.append("")
        lines.append("| Query Type | Delta |")
        lines.append("| ---------- | ----- |")
        for qt, delta in sorted(comp.per_type_latency_delta_ms.items()):
            lines.append(f"| {qt:<10} | {delta:+.1f} |")
        lines.append("")

        if comp.validation:
            lines.append("### Statistical Validation")
            lines.append("")
            lines.append(
                f"**{comp.validation.summary}**"
            )
            lines.append("")
            lines.append("#### Significance Tests")
            lines.append("")
            lines.append("| Test | Statistic | p-value | Significant? |")
            lines.append("| ---- | --------- | ------- | ------------ |")
            for name, sig in comp.validation.significance.items():
                lines.append(
                    f"| {name:<20} | {sig.statistic:>9.4f} | {sig.p_value:>7.4f} "
                    f"| {'Yes' if sig.significant else 'No':<4} |"
                )
            lines.append("")
            lines.append("#### Effect Sizes")
            lines.append("")
            lines.append("| Measure | Value | Magnitude | Direction |")
            lines.append("| ------- | ----- | --------- | --------- |")
            for name, es in comp.validation.effect_sizes.items():
                lines.append(
                    f"| {name:<15} | {es.value:>6.4f} | {es.magnitude:<10} "
                    f"| {es.direction:<22} |"
                )
            lines.append("")
            if comp.validation.bootstrap:
                bs = comp.validation.bootstrap
                lines.append("#### Bootstrap Evaluation")
                lines.append("")
                lines.append(f"- **Point estimate:** {bs.point_estimate:.4f}")
                lines.append(f"- **Bias:** {bs.bias:.4f}")
                lines.append(f"- **Std error:** {bs.std_error:.4f}")
                lines.append(f"- **95% CI:** [{bs.ci_lower:.4f}, {bs.ci_upper:.4f}]")
                lines.append("")

    lines.append("---")
    lines.append("*Report generated by ablation framework*")
    lines.append("")
    return "\n".join(lines)


def generate_ablation_matrix(
    comparisons: List[AblationComparison],
) -> str:
    """Generate a compact ablation matrix table.

    Rows are configurations (treatment labels), columns are aggregate metrics.
    """
    if not comparisons:
        return ""

    lines = [
        "# Ablation Matrix",
        "",
        f"**Generated:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "| Config | Recall Δ | Precision Δ | Latency Δ (ms) | Success Δ | Fallback Δ |",
        "| ------ | -------- | ----------- | --------------- | --------- | ---------- |",
    ]

    for comp in comparisons:
        lines.append(
            f"| {comp.treatment_label:<20} "
            f"| {_fmt_opt_float(comp.recall_delta, '%+.2f%%'):<10} "
            f"| {_fmt_opt_float(comp.precision_delta, '%+.2f%%'):<11} "
            f"| {comp.latency_delta_ms:>+9.1f} ms "
            f"| {comp.success_rate_delta:>+7.2%} "
            f"| {comp.fallback_rate_delta:>+7.2%} |"
        )

    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _opt_sub(a: Optional[float], b: Optional[float]) -> Optional[float]:
    if a is None or b is None:
        return None
    return a - b


def _fmt_opt_float(val: Optional[float], fmt: str = "%+.2f") -> str:
    if val is None:
        return "N/A"
    return fmt % val


def _direction(
    val: Optional[float],
    lower_is_better: bool = False,
) -> str:
    if val is None:
        return "N/A"
    if abs(val) < 1e-9:
        return "Neutral"
    if lower_is_better:
        return "Better" if val < 0 else "Worse"
    return "Better" if val > 0 else "Worse"
