from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from benchmarks.e2e.benchmark_result import E2EAggregatedResult, E2EBenchmarkResult


@dataclass
class AblationComponentImpact:
    component: str
    composite_delta: float
    latency_delta_ms: float
    pass_rate_delta: float
    fail_rate_delta: float
    direction: str = "neutral"

    def to_dict(self) -> Dict[str, object]:
        return {
            "component": self.component,
            "composite_delta": self.composite_delta,
            "latency_delta_ms": self.latency_delta_ms,
            "pass_rate_delta": self.pass_rate_delta,
            "fail_rate_delta": self.fail_rate_delta,
            "direction": self.direction,
        }


@dataclass
class AblationValidationResult:
    domain: str
    full_system_score: float
    naive_baseline_score: float
    overall_improvement_pct: float
    component_impacts: List[AblationComponentImpact] = field(default_factory=list)
    is_significant: bool = False
    significance_notes: str = ""

    def to_dict(self) -> Dict[str, object]:
        return {
            "domain": self.domain,
            "full_system_score": self.full_system_score,
            "naive_baseline_score": self.naive_baseline_score,
            "overall_improvement_pct": self.overall_improvement_pct,
            "component_impacts": [c.to_dict() for c in self.component_impacts],
            "is_significant": self.is_significant,
            "significance_notes": self.significance_notes,
        }


@dataclass
class AblationReport:
    domain_results: Dict[str, AblationValidationResult] = field(default_factory=dict)
    metadata: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "results": {k: v.to_dict() for k, v in self.domain_results.items()},
        }

    @property
    def average_improvement(self) -> float:
        if not self.domain_results:
            return 0.0
        return sum(r.overall_improvement_pct for r in self.domain_results.values()) / len(self.domain_results)

    @property
    def all_significant(self) -> bool:
        if not self.domain_results:
            return False
        return all(r.is_significant for r in self.domain_results.values())


def compute_ablation(
    full_results: E2EBenchmarkResult,
    baseline_mode: str = "naive_rag",
    adaptive_mode: str = "kairos_adaptive",
) -> Optional[AblationValidationResult]:
    full_adaptive = full_results.mode_results.get(adaptive_mode)
    baseline = full_results.mode_results.get(baseline_mode)

    if not full_adaptive or not baseline:
        return None

    if baseline.avg_composite_score == 0.0:
        return None

    overall_improvement = (
        (full_adaptive.avg_composite_score - baseline.avg_composite_score)
        / baseline.avg_composite_score * 100.0
    )

    component_impacts: List[AblationComponentImpact] = []

    other_modes = [
        ("always_simple", "Simple retriever"),
        ("always_complex", "Complex retriever"),
        ("always_multi_hop", "Multi-hop retriever"),
    ]
    for mode_key, component_name in other_modes:
        mode_result = full_results.mode_results.get(mode_key)
        if mode_result:
            comp_delta = mode_result.avg_composite_score - baseline.avg_composite_score
            component_impacts.append(AblationComponentImpact(
                component=component_name,
                composite_delta=comp_delta,
                latency_delta_ms=mode_result.avg_latency_ms - baseline.avg_latency_ms,
                pass_rate_delta=mode_result.pass_rate - baseline.pass_rate,
                fail_rate_delta=mode_result.fail_rate - baseline.fail_rate,
                direction="improvement" if comp_delta > 0 else "regression",
            ))

    adaptive_delta = full_adaptive.avg_composite_score - baseline.avg_composite_score
    component_impacts.append(AblationComponentImpact(
        component="Kairos Adaptive",
        composite_delta=adaptive_delta,
        latency_delta_ms=full_adaptive.avg_latency_ms - baseline.avg_latency_ms,
        pass_rate_delta=full_adaptive.pass_rate - baseline.pass_rate,
        fail_rate_delta=full_adaptive.fail_rate - baseline.fail_rate,
        direction="improvement" if adaptive_delta > 0 else "regression",
    ))

    return AblationValidationResult(
        domain=full_results.domain,
        full_system_score=full_adaptive.avg_composite_score,
        naive_baseline_score=baseline.avg_composite_score,
        overall_improvement_pct=overall_improvement,
        component_impacts=component_impacts,
        is_significant=overall_improvement > 5.0,
        significance_notes=(
            f"Kairos Adaptive exceeds baseline by {overall_improvement:+.1f}% "
            f"(threshold: 5%)"
        ),
    )


def compute_ablations(
    results: Dict[str, E2EBenchmarkResult],
    baseline_mode: str = "naive_rag",
    adaptive_mode: str = "kairos_adaptive",
) -> AblationReport:
    domain_results: Dict[str, AblationValidationResult] = {}
    for domain, domain_result in results.items():
        validation = compute_ablation(domain_result, baseline_mode, adaptive_mode)
        if validation:
            domain_results[domain] = validation
    return AblationReport(domain_results=domain_results)


def generate_ablation_report(
    report: AblationReport,
) -> str:
    lines: List[str] = []
    lines.append("# Phase 9F Ablation Validation Report")
    lines.append("")
    lines.append(f"**Average improvement:** {report.average_improvement:+.1f}%")
    lines.append(f"**All domains significant:** {report.all_significant}")
    lines.append("")

    for domain, result in report.domain_results.items():
        lines.append(f"## {domain.title()}")
        lines.append("")
        lines.append(f"- **Full system score:** {result.full_system_score:.3f}")
        lines.append(f"- **Naive baseline score:** {result.naive_baseline_score:.3f}")
        lines.append(f"- **Overall improvement:** {result.overall_improvement_pct:+.1f}%")
        lines.append(f"- **Statistically significant:** {result.is_significant}")
        lines.append(f"- **Notes:** {result.significance_notes}")
        lines.append("")
        lines.append("### Component Impacts")
        lines.append("")
        lines.append("| Component | Composite Δ | Latency Δ (ms) | Pass Rate Δ | Direction |")
        lines.append("|-----------|------------|----------------|-------------|-----------|")
        for impact in result.component_impacts:
            lines.append(
                f"| {impact.component} | {impact.composite_delta:+.3f} | "
                f"{impact.latency_delta_ms:+.1f} | {impact.pass_rate_delta:+.1%} | "
                f"{impact.direction} |"
            )
        lines.append("")

    lines.append("---")
    lines.append("*Report generated by e2e ablation validation framework*")
    return "\n".join(lines)
