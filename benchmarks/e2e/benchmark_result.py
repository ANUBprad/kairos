from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from benchmarks.e2e.benchmark_config import ExecutionMode


@dataclass
class E2EDimensionScores:
    faithfulness: float = 0.0
    relevance: float = 0.0
    hallucination: float = 0.0
    grounding: float = 0.0

    def to_dict(self) -> Dict[str, float]:
        return {
            "faithfulness": self.faithfulness,
            "relevance": self.relevance,
            "hallucination": self.hallucination,
            "grounding": self.grounding,
        }

    @property
    def average(self) -> float:
        vals = [self.faithfulness, self.relevance, self.hallucination, self.grounding]
        return sum(vals) / len(vals) if vals else 0.0


@dataclass
class E2EQueryResult:
    query_id: str
    query: str
    domain: str
    query_type: str
    execution_mode: str
    latency_ms: float = 0.0
    num_docs: int = 0
    confidence: float = 0.0
    success: bool = True
    error: str = ""
    dimension_scores: Optional[E2EDimensionScores] = None
    composite_score: float = 0.0
    composite_judgment: str = "fail"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query_id": self.query_id,
            "query": self.query[:100],
            "domain": self.domain,
            "query_type": self.query_type,
            "execution_mode": self.execution_mode,
            "latency_ms": self.latency_ms,
            "num_docs": self.num_docs,
            "confidence": self.confidence,
            "success": self.success,
            "error": self.error,
            "dimension_scores": self.dimension_scores.to_dict() if self.dimension_scores else {},
            "composite_score": self.composite_score,
            "composite_judgment": self.composite_judgment,
        }


@dataclass
class E2EAggregatedResult:
    execution_mode: str
    domain: str = ""
    num_queries: int = 0
    success_rate: float = 0.0
    avg_latency_ms: float = 0.0
    avg_composite_score: float = 0.0
    avg_confidence: float = 0.0
    avg_docs: float = 0.0
    dimension_averages: Optional[E2EDimensionScores] = None
    pass_rate: float = 0.0
    fail_rate: float = 0.0
    warn_rate: float = 0.0
    per_query: List[E2EQueryResult] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "execution_mode": self.execution_mode,
            "domain": self.domain,
            "num_queries": self.num_queries,
            "success_rate": self.success_rate,
            "avg_latency_ms": self.avg_latency_ms,
            "avg_composite_score": self.avg_composite_score,
            "avg_confidence": self.avg_confidence,
            "avg_docs": self.avg_docs,
            "dimension_averages": self.dimension_averages.to_dict() if self.dimension_averages else {},
            "pass_rate": self.pass_rate,
            "fail_rate": self.fail_rate,
            "warn_rate": self.warn_rate,
        }


@dataclass
class E2EBenchmarkResult:
    domain: str
    mode_results: Dict[str, E2EAggregatedResult] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain,
            "mode_results": {
                k: v.to_dict() for k, v in self.mode_results.items()
            },
        }

    def best_mode(self) -> Optional[str]:
        best = None
        best_score = -1.0
        for mode, result in self.mode_results.items():
            if result.avg_composite_score > best_score:
                best_score = result.avg_composite_score
                best = mode
        return best

    def improvement_vs_baseline(self, baseline_mode: str = "naive_rag") -> Dict[str, float]:
        baseline = self.mode_results.get(baseline_mode)
        if not baseline or baseline.avg_composite_score == 0.0:
            return {}
        improvements: Dict[str, float] = {}
        for mode, result in self.mode_results.items():
            if mode == baseline_mode:
                continue
            improvements[mode] = (
                (result.avg_composite_score - baseline.avg_composite_score)
                / baseline.avg_composite_score
                * 100.0
            )
        return improvements
