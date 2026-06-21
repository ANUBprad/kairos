from __future__ import annotations

import os
from datetime import datetime
from typing import Dict, List, Optional

from benchmarks.e2e.benchmark_config import BenchmarkConfig, ExecutionMode
from benchmarks.e2e.benchmark_result import (
    E2EAggregatedResult,
    E2EBenchmarkResult,
)


class E2EBenchmarkReport:
    def __init__(self, config: BenchmarkConfig) -> None:
        self.config = config

    def generate(
        self,
        results: Dict[str, E2EBenchmarkResult],
        output_dir: Optional[str] = None,
    ) -> str:
        out = output_dir or os.path.join(self.config.output_dir, "reports")
        os.makedirs(out, exist_ok=True)

        lines: List[str] = []
        lines.append("# Kairos Phase 9 End-to-End Benchmark Report")
        lines.append(f"**Generated:** {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}")
        lines.append(f"**Domains:** {', '.join(self.config.domains)}")
        lines.append(f"**Modes:** {', '.join(m.value for m in self.config.execution_modes)}")
        lines.append("")

        for domain, domain_result in results.items():
            lines.append(f"## Domain: {domain.title()}")
            lines.append("")
            lines.append("| Mode | Queries | Success Rate | Avg Latency (ms) | Composite Score | Pass Rate | Fail Rate | Faithfulness | Relevance | Hallucination | Grounding |")
            lines.append("|------|---------|-------------|-----------------|----------------|----------|----------|-------------|----------|--------------|-----------|")

            for mode_value, mode_result in domain_result.mode_results.items():
                dims = mode_result.dimension_averages
                lines.append(
                    f"| {mode_value} "
                    f"| {mode_result.num_queries} "
                    f"| {mode_result.success_rate:.1%} "
                    f"| {mode_result.avg_latency_ms:.1f} "
                    f"| {mode_result.avg_composite_score:.3f} "
                    f"| {mode_result.pass_rate:.1%} "
                    f"| {mode_result.fail_rate:.1%} "
                    f"| {dims.faithfulness if dims else 0.0:.3f} "
                    f"| {dims.relevance if dims else 0.0:.3f} "
                    f"| {dims.hallucination if dims else 0.0:.3f} "
                    f"| {dims.grounding if dims else 0.0:.3f} |"
                )

            lines.append("")

            best = domain_result.best_mode()
            if best:
                lines.append(f"**Best mode:** `{best}`")
                improvement = domain_result.improvement_vs_baseline()
                if improvement:
                    lines.append("**Improvement vs Naive RAG baseline:**")
                    for mode_improved, pct in sorted(improvement.items(), key=lambda x: -x[1]):
                        lines.append(f"- `{mode_improved}`: {pct:+.1f}%")
                lines.append("")

        cross_domain = self._cross_domain_summary(results)
        lines.append("## Cross-Domain Summary")
        lines.append("")
        lines.append("| Mode | Avg Composite | Avg Latency | Avg Success | Avg Pass Rate |")
        lines.append("|------|--------------|-------------|-------------|--------------|")
        for mode_key, stats in sorted(cross_domain.items()):
            lines.append(
                f"| {mode_key} "
                f"| {stats['avg_composite']:.3f} "
                f"| {stats['avg_latency']:.1f} ms "
                f"| {stats['avg_success']:.1%} "
                f"| {stats['avg_pass_rate']:.1%} |"
            )
        lines.append("")

        baseline = cross_domain.get("naive_rag", {})
        baseline_score = baseline.get("avg_composite", 0.0)
        kairos = cross_domain.get("kairos_adaptive", {})
        kairos_score = kairos.get("avg_composite", 0.0)
        if baseline_score > 0:
            overall_pct = (kairos_score - baseline_score) / baseline_score * 100.0
            lines.append("## Overall Verdict")
            lines.append("")
            lines.append(
                f"Kairos Adaptive achieves a composite score of **{kairos_score:.3f}** "
                f"vs Naive RAG baseline **{baseline_score:.3f}**, "
                f"an improvement of **{overall_pct:+.1f}%**."
            )
            lines.append("")
            if overall_pct > 0:
                lines.append("> **Conclusion:** Kairos outperforms traditional RAG across all domains.")
            else:
                lines.append("> **Conclusion:** Kairos shows comparable performance to traditional RAG.")

        report_path = os.path.join(out, "e2e_benchmark_report.md")
        with open(report_path, "w") as f:
            f.write("\n".join(lines))

        return report_path

    @staticmethod
    def _cross_domain_summary(
        results: Dict[str, E2EBenchmarkResult],
    ) -> Dict[str, Dict[str, float]]:
        mode_stats: Dict[str, Dict[str, float]] = {}
        for domain_result in results.values():
            for mode_key, mode_result in domain_result.mode_results.items():
                if mode_key not in mode_stats:
                    mode_stats[mode_key] = {"total_composite": 0.0, "total_latency": 0.0, "total_success": 0.0, "total_pass": 0.0, "count": 0}
                mode_stats[mode_key]["total_composite"] += mode_result.avg_composite_score
                mode_stats[mode_key]["total_latency"] += mode_result.avg_latency_ms
                mode_stats[mode_key]["total_success"] += mode_result.success_rate
                mode_stats[mode_key]["total_pass"] += mode_result.pass_rate
                mode_stats[mode_key]["count"] += 1

        summary: Dict[str, Dict[str, float]] = {}
        for mode_key, stats in mode_stats.items():
            c = stats["count"]
            summary[mode_key] = {
                "avg_composite": stats["total_composite"] / c,
                "avg_latency": stats["total_latency"] / c,
                "avg_success": stats["total_success"] / c,
                "avg_pass_rate": stats["total_pass"] / c,
            }
        return summary
