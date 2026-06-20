from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, Optional


@dataclass(frozen=True)
class BudgetRecommendation:
    recommended_top_k: int
    recommended_rerank: bool
    recommended_decompose: bool
    expected_success: float
    expected_latency: float
    source: str = "optimizer"


@dataclass
class BudgetScorer:
    success_weight: float = 1.0
    latency_weight: float = 0.01
    fallback_weight: float = 0.5
    top_k_penalty_weight: float = 0.02
    top_k_reference: int = 5

    def score(
        self,
        success_rate: float,
        avg_latency_ms: float,
        fallback_rate: float,
        top_k: int,
    ) -> float:
        success_reward = self.success_weight * success_rate
        latency_penalty = self.latency_weight * (avg_latency_ms / 1000.0)
        fallback_penalty = self.fallback_weight * fallback_rate
        top_k_inflation = max(0, top_k - self.top_k_reference)
        cost_penalty = self.top_k_penalty_weight * top_k_inflation

        return success_reward - latency_penalty - fallback_penalty - cost_penalty


@dataclass
class LearnedBudgetTable:
    mapping: Dict[str, Dict[str, BudgetRecommendation]] = field(default_factory=dict)

    def get(self, query_type: str, confidence_band: str) -> Optional[BudgetRecommendation]:
        return self.mapping.get(query_type, {}).get(confidence_band)

    def set(self, query_type: str, confidence_band: str, rec: BudgetRecommendation) -> None:
        if query_type not in self.mapping:
            self.mapping[query_type] = {}
        self.mapping[query_type][confidence_band] = rec

    def to_dict(self) -> dict:
        out: dict = {}
        for qt, bands in self.mapping.items():
            out[qt] = {}
            for cb, rec in bands.items():
                out[qt][cb] = {
                    "recommended_top_k": rec.recommended_top_k,
                    "recommended_rerank": rec.recommended_rerank,
                    "recommended_decompose": rec.recommended_decompose,
                    "expected_success": rec.expected_success,
                    "expected_latency": rec.expected_latency,
                }
        return out

    @classmethod
    def from_dict(cls, data: dict) -> LearnedBudgetTable:
        table = cls()
        for qt, bands in data.items():
            for cb, rec in bands.items():
                table.set(qt, cb, BudgetRecommendation(**rec))
        return table
