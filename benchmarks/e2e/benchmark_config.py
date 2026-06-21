from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Optional, Sequence


class ExecutionMode(str, Enum):
    NAIVE_RAG = "naive_rag"
    ALWAYS_SIMPLE = "always_simple"
    ALWAYS_COMPLEX = "always_complex"
    ALWAYS_MULTI_HOP = "always_multi_hop"
    KAIROS_ADAPTIVE = "kairos_adaptive"


class RunMode(str, Enum):
    FULL = "full"
    ABLATION = "ablation"
    VALIDATION = "validation"


@dataclass
class BenchmarkConfig:
    domains: List[str] = field(default_factory=lambda: [
        "finance", "legal", "healthcare", "technology", "general"
    ])
    mode: RunMode = RunMode.FULL
    execution_modes: List[ExecutionMode] = field(default_factory=lambda: [
        ExecutionMode.NAIVE_RAG,
        ExecutionMode.ALWAYS_SIMPLE,
        ExecutionMode.ALWAYS_COMPLEX,
        ExecutionMode.ALWAYS_MULTI_HOP,
        ExecutionMode.KAIROS_ADAPTIVE,
    ])
    top_k: int = 5
    num_queries_per_domain: Optional[int] = None
    output_dir: str = "benchmarks/results/e2e"
    judge_weights: Dict[str, float] = field(default_factory=lambda: {
        "faithfulness": 1.0,
        "relevance": 1.0,
        "hallucination": 1.5,
        "grounding": 1.0,
    })
    seed: int = 42
    include_judging: bool = True
    include_cost_analysis: bool = True
    parallel: bool = False
    max_workers: int = 4

    def get_domain_limit(self, domain: str) -> Optional[int]:
        return self.num_queries_per_domain

    def get_output_path(self, domain: str, mode: ExecutionMode) -> str:
        import os
        base = self.output_dir
        os.makedirs(base, exist_ok=True)
        return os.path.join(base, f"{domain}_{mode.value}_results.json")

    @property
    def mode_labels(self) -> Dict[ExecutionMode, str]:
        return {
            ExecutionMode.NAIVE_RAG: "Naive RAG (baseline)",
            ExecutionMode.ALWAYS_SIMPLE: "Always Simple",
            ExecutionMode.ALWAYS_COMPLEX: "Always Complex",
            ExecutionMode.ALWAYS_MULTI_HOP: "Always Multi-Hop",
            ExecutionMode.KAIROS_ADAPTIVE: "Kairos Adaptive",
        }
