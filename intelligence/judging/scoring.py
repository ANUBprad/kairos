from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from intelligence.judging.judge import JudgeResult


@dataclass
class JudgingReport:
    query: str = ""
    answer: str = ""
    composite_score: float = 0.0
    composite_judgment: str = "fail"
    dimension_results: Dict[str, JudgeResult] = field(default_factory=dict)
    num_context_docs: int = 0

    def to_dict(self) -> Dict[str, object]:
        return {
            "query": self.query,
            "answer": self.answer[:200] if self.answer else "",
            "composite_score": self.composite_score,
            "composite_judgment": self.composite_judgment,
            "dimensions": {k: v.to_dict() for k, v in self.dimension_results.items()},
            "num_context_docs": self.num_context_docs,
        }

    @property
    def passed(self) -> bool:
        return self.composite_judgment == "pass"

    @property
    def failed(self) -> bool:
        return self.composite_judgment == "fail"


def aggregate_scores(results: List[JudgeResult]) -> float:
    if not results:
        return 0.0
    return sum(r.score for r in results) / len(results)


def weight_scores(
    results: List[JudgeResult],
    weights: Dict[str, float],
) -> float:
    total_weight = 0.0
    weighted_sum = 0.0
    for r in results:
        w = weights.get(r.dimension, 1.0)
        weighted_sum += r.score * w
        total_weight += w
    if total_weight == 0.0:
        return 0.0
    return weighted_sum / total_weight


def score_to_rating(score: float) -> str:
    if score >= 0.9:
        return "excellent"
    if score >= 0.7:
        return "good"
    if score >= 0.5:
        return "fair"
    if score >= 0.3:
        return "poor"
    return "very_poor"


def rating_to_score(rating: str) -> float:
    mapping = {
        "excellent": 0.95,
        "good": 0.8,
        "fair": 0.6,
        "poor": 0.4,
        "very_poor": 0.15,
    }
    return mapping.get(rating.lower(), 0.0)


def default_weights() -> Dict[str, float]:
    return {
        "faithfulness": 1.0,
        "relevance": 1.0,
        "hallucination": 1.5,
        "grounding": 1.0,
    }
