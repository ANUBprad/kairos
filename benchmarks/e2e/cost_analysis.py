from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

from benchmarks.e2e.benchmark_result import E2EAggregatedResult, E2EBenchmarkResult


@dataclass
class CostBreakdown:
    mode: str
    domain: str
    estimated_cost_usd: float
    num_queries: int
    avg_cost_per_query_usd: float
    total_latency_ms: float
    num_docs_retrieved: int
    embedding_cost_est: float = 0.0
    llm_call_cost_est: float = 0.0
    storage_cost_est: float = 0.0

    @property
    def cost_per_doc_usd(self) -> float:
        if self.num_docs_retrieved == 0:
            return 0.0
        return self.estimated_cost_usd / self.num_docs_retrieved

    def to_dict(self) -> Dict[str, object]:
        return {
            "mode": self.mode,
            "domain": self.domain,
            "estimated_cost_usd": self.estimated_cost_usd,
            "num_queries": self.num_queries,
            "avg_cost_per_query_usd": self.avg_cost_per_query_usd,
            "total_latency_ms": self.total_latency_ms,
            "num_docs_retrieved": self.num_docs_retrieved,
            "cost_per_doc_usd": self.cost_per_doc_usd,
        }


@dataclass
class CostAnalysisReport:
    breakdowns: List[CostBreakdown] = field(default_factory=list)

    def by_mode(self, mode: str) -> List[CostBreakdown]:
        return [b for b in self.breakdowns if b.mode == mode]

    def by_domain(self, domain: str) -> List[CostBreakdown]:
        return [b for b in self.breakdowns if b.domain == domain]

    def total_cost(self) -> float:
        return sum(b.estimated_cost_usd for b in self.breakdowns)

    def mode_total_cost(self, mode: str) -> float:
        return sum(b.estimated_cost_usd for b in self.breakdowns if b.mode == mode)

    def avg_cost_per_query(self, mode: str) -> float:
        mode_breakdowns = self.by_mode(mode)
        if not mode_breakdowns:
            return 0.0
        return sum(b.avg_cost_per_query_usd for b in mode_breakdowns) / len(mode_breakdowns)

    def cost_ratio_vs_baseline(self, mode: str, baseline_mode: str = "naive_rag") -> float:
        mode_cost = self.mode_total_cost(mode)
        baseline_cost = self.mode_total_cost(baseline_mode)
        if baseline_cost == 0.0:
            return float("inf")
        return mode_cost / baseline_cost

    def to_dict(self) -> Dict[str, object]:
        return {
            "breakdowns": [b.to_dict() for b in self.breakdowns],
            "total_cost_usd": self.total_cost(),
            "num_modes": len(set(b.mode for b in self.breakdowns)),
        }


class CostAnalyzer:
    COST_PER_EMBEDDING = 0.0001
    COST_PER_LLM_CALL = 0.002
    COST_PER_STORAGE_DOC = 0.00001
    COST_PER_LATENCY_MS = 0.000001

    def __init__(
        self,
        embedding_cost: float = COST_PER_EMBEDDING,
        llm_call_cost: float = COST_PER_LLM_CALL,
        storage_cost: float = COST_PER_STORAGE_DOC,
        latency_cost: float = COST_PER_LATENCY_MS,
    ) -> None:
        self.embedding_cost = embedding_cost
        self.llm_call_cost = llm_call_cost
        self.storage_cost = storage_cost
        self.latency_cost = latency_cost

    def analyze(self, results: Dict[str, E2EBenchmarkResult]) -> CostAnalysisReport:
        breakdowns: List[CostBreakdown] = []
        for domain, domain_result in results.items():
            for mode_key, mode_result in domain_result.mode_results.items():
                cost = self._compute_cost(mode_result)
                breakdowns.append(cost)
        return CostAnalysisReport(breakdowns=breakdowns)

    def _compute_cost(self, result: E2EAggregatedResult) -> CostBreakdown:
        n = result.num_queries
        total_docs = int(result.avg_docs * n)

        embedding_cost = total_docs * self.embedding_cost
        llm_cost = n * self.llm_call_cost
        storage_cost = total_docs * self.storage_cost
        latency_cost = result.avg_latency_ms * n * self.latency_cost

        total_cost = embedding_cost + llm_cost + storage_cost + latency_cost
        avg_per_query = total_cost / n if n > 0 else 0.0

        return CostBreakdown(
            mode=result.execution_mode,
            domain=result.domain,
            estimated_cost_usd=total_cost,
            num_queries=n,
            avg_cost_per_query_usd=avg_per_query,
            total_latency_ms=result.avg_latency_ms * n,
            num_docs_retrieved=total_docs,
            embedding_cost_est=embedding_cost,
            llm_call_cost_est=llm_cost,
            storage_cost_est=storage_cost,
        )


def generate_cost_report(report: CostAnalysisReport, baseline_mode: str = "naive_rag") -> str:
    lines: List[str] = []
    lines.append("# Phase 9G Cost Analysis Report")
    lines.append("")
    lines.append(f"**Total estimated cost:** ${report.total_cost():.4f}")
    lines.append("")

    modes = sorted(set(b.mode for b in report.breakdowns))
    lines.append("## Cost by Mode")
    lines.append("")
    lines.append("| Mode | Total Cost | Avg Cost/Query | Cost Ratio vs Baseline |")
    lines.append("|------|-----------|---------------|----------------------|")
    for mode in modes:
        total = report.mode_total_cost(mode)
        avg = report.avg_cost_per_query(mode)
        ratio = report.cost_ratio_vs_baseline(mode, baseline_mode)
        lines.append(
            f"| {mode} | ${total:.4f} | ${avg:.6f} | {ratio:.2f}x |"
        )
    lines.append("")

    domains = sorted(set(b.domain for b in report.breakdowns))
    for domain in domains:
        lines.append(f"## {domain.title()}")
        lines.append("")
        lines.append("| Mode | Total Cost | Avg/Query | Embedding | LLM | Storage |")
        lines.append("|------|-----------|----------|-----------|-----|---------|")
        for b in report.by_domain(domain):
            lines.append(
                f"| {b.mode} | ${b.estimated_cost_usd:.4f} | "
                f"${b.avg_cost_per_query_usd:.6f} | "
                f"${b.embedding_cost_est:.4f} | "
                f"${b.llm_call_cost_est:.4f} | "
                f"${b.storage_cost_est:.4f} |"
            )
        lines.append("")

    lines.append("---")
    lines.append("*Report generated by e2e cost analysis framework*")
    return "\n".join(lines)
