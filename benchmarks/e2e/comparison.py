from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from benchmarks.e2e.benchmark_result import E2EAggregatedResult, E2EBenchmarkResult


@dataclass
class ModeComparison:
    mode: str
    domain: str
    composite_score: float
    latency_ms: float
    pass_rate: float
    fail_rate: float
    success_rate: float
    improvement_vs_baseline_pct: Optional[float] = None

    def to_dict(self) -> Dict[str, object]:
        return {
            "mode": self.mode,
            "domain": self.domain,
            "composite_score": self.composite_score,
            "latency_ms": self.latency_ms,
            "pass_rate": self.pass_rate,
            "fail_rate": self.fail_rate,
            "success_rate": self.success_rate,
            "improvement_vs_baseline_pct": self.improvement_vs_baseline_pct,
        }


@dataclass
class CrossDomainComparison:
    comparisons: List[ModeComparison] = field(default_factory=list)

    def by_mode(self, mode: str) -> List[ModeComparison]:
        return [c for c in self.comparisons if c.mode == mode]

    def by_domain(self, domain: str) -> List[ModeComparison]:
        return [c for c in self.comparisons if c.domain == domain]

    def best_performing_mode(self, metric: str = "composite_score") -> str:
        mode_scores: Dict[str, List[float]] = {}
        for c in self.comparisons:
            mode_scores.setdefault(c.mode, []).append(
                getattr(c, metric, c.composite_score)
            )
        if not mode_scores:
            return ""
        averages = {m: sum(s) / len(s) for m, s in mode_scores.items()}
        return max(averages, key=averages.get)

    def improvement_summary(self, baseline_mode: str = "naive_rag") -> Dict[str, float]:
        baseline_avg = self._mode_average(baseline_mode)
        if baseline_avg is None or baseline_avg == 0.0:
            return {}
        summary: Dict[str, float] = {}
        for c in self.comparisons:
            if c.mode == baseline_mode:
                continue
            key = c.mode
            if key not in summary:
                mode_avg = self._mode_average(c.mode)
                if mode_avg is not None:
                    summary[key] = (mode_avg - baseline_avg) / baseline_avg * 100.0
        return summary

    def _mode_average(self, mode: str) -> Optional[float]:
        scores = [c.composite_score for c in self.comparisons if c.mode == mode]
        if not scores:
            return None
        return sum(scores) / len(scores)

    def to_dict(self) -> Dict[str, object]:
        return {
            "comparisons": [c.to_dict() for c in self.comparisons],
            "best_mode": self.best_performing_mode(),
        }


def compare_modes(
    results: Dict[str, E2EBenchmarkResult],
    baseline_mode: str = "naive_rag",
) -> CrossDomainComparison:
    comparisons: List[ModeComparison] = []
    for domain, domain_result in results.items():
        baseline = domain_result.mode_results.get(baseline_mode)
        baseline_score = baseline.avg_composite_score if baseline else 0.0

        for mode_key, mode_result in domain_result.mode_results.items():
            improvement = None
            if baseline and baseline_score > 0 and mode_key != baseline_mode:
                improvement = (
                    (mode_result.avg_composite_score - baseline_score)
                    / baseline_score * 100.0
                )

            comparisons.append(ModeComparison(
                mode=mode_key,
                domain=domain,
                composite_score=mode_result.avg_composite_score,
                latency_ms=mode_result.avg_latency_ms,
                pass_rate=mode_result.pass_rate,
                fail_rate=mode_result.fail_rate,
                success_rate=mode_result.success_rate,
                improvement_vs_baseline_pct=improvement,
            ))

    return CrossDomainComparison(comparisons=comparisons)


def generate_comparison_report(
    comparison: CrossDomainComparison,
    baseline_mode: str = "naive_rag",
) -> str:
    lines: List[str] = []
    lines.append("# Baseline Comparison Report")
    lines.append("")
    lines.append(f"**Baseline mode:** `{baseline_mode}`")
    lines.append(f"**Best overall mode:** `{comparison.best_performing_mode()}`")
    lines.append("")

    domains = sorted(set(c.domain for c in comparison.comparisons))
    modes = sorted(set(c.mode for c in comparison.comparisons))

    lines.append("## Cross-Domain Average Scores")
    lines.append("")
    lines.append("| Mode | Avg Composite | Avg Latency (ms) | Avg Pass Rate | Avg Fail Rate |")
    lines.append("|------|--------------|-----------------|--------------|--------------|")
    for mode in modes:
        mode_comps = comparison.by_mode(mode)
        avg_score = sum(c.composite_score for c in mode_comps) / len(mode_comps)
        avg_lat = sum(c.latency_ms for c in mode_comps) / len(mode_comps)
        avg_pass = sum(c.pass_rate for c in mode_comps) / len(mode_comps)
        avg_fail = sum(c.fail_rate for c in mode_comps) / len(mode_comps)
        lines.append(
            f"| {mode} | {avg_score:.3f} | {avg_lat:.1f} | {avg_pass:.1%} | {avg_fail:.1%} |"
        )
    lines.append("")

    lines.append("## Per-Domain Breakdown")
    lines.append("")
    for domain in domains:
        lines.append(f"### {domain.title()}")
        lines.append("")
        lines.append("| Mode | Composite | Latency (ms) | Pass Rate | Improvement vs Baseline |")
        lines.append("|------|----------|-------------|----------|----------------------|")
        for c in comparison.by_domain(domain):
            imp = f"{c.improvement_vs_baseline_pct:+.1f}%" if c.improvement_vs_baseline_pct is not None else "N/A"
            lines.append(
                f"| {c.mode} | {c.composite_score:.3f} | {c.latency_ms:.1f} | "
                f"{c.pass_rate:.1%} | {imp} |"
            )
        lines.append("")

    lines.append("## Improvement Summary")
    lines.append("")
    improvements = comparison.improvement_summary(baseline_mode)
    if improvements:
        lines.append("| Mode | Improvement vs Baseline |")
        lines.append("|------|----------------------|")
        for mode, pct in sorted(improvements.items(), key=lambda x: -x[1]):
            lines.append(f"| {mode} | {pct:+.1f}% |")
    else:
        lines.append("No improvement data available.")
    lines.append("")

    lines.append("---")
    lines.append("*Report generated by e2e baseline comparison framework*")
    return "\n".join(lines)
