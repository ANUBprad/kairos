from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Sequence


class Judgment(Enum):
    PASS = "pass"
    WARN = "warn"
    FAIL = "fail"


@dataclass
class JudgeResult:
    dimension: str
    score: float
    judgment: Judgment
    explanation: str = ""
    details: Dict[str, object] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, object]:
        return {
            "dimension": self.dimension,
            "score": self.score,
            "judgment": self.judgment.value,
            "explanation": self.explanation,
            "details": dict(self.details),
        }

    @property
    def passed(self) -> bool:
        return self.judgment == Judgment.PASS

    @property
    def is_warning(self) -> bool:
        return self.judgment == Judgment.WARN

    @property
    def failed(self) -> bool:
        return self.judgment == Judgment.FAIL


class BaseJudge:
    dimension: str = "base"

    def evaluate(
        self,
        query: str,
        answer: str,
        context: Sequence[str],
    ) -> JudgeResult:
        raise NotImplementedError

    def __call__(
        self,
        query: str,
        answer: str,
        context: Sequence[str],
    ) -> JudgeResult:
        return self.evaluate(query, answer, context)


@dataclass
class CompositeJudge:
    judges: List[BaseJudge] = field(default_factory=list)
    weights: Dict[str, float] = field(default_factory=dict)

    def add_judge(self, judge: BaseJudge, weight: float = 1.0) -> None:
        self.judges.append(judge)
        self.weights[judge.dimension] = weight

    def evaluate(
        self,
        query: str,
        answer: str,
        context: Sequence[str],
    ) -> List[JudgeResult]:
        results: List[JudgeResult] = []
        for judge in self.judges:
            result = judge.evaluate(query, answer, context)
            results.append(result)
        return results

    def evaluate_all(
        self,
        query: str,
        answer: str,
        context: Sequence[str],
    ) -> Dict[str, JudgeResult]:
        return {r.dimension: r for r in self.evaluate(query, answer, context)}

    def composite_score(
        self,
        query: str,
        answer: str,
        context: Sequence[str],
    ) -> float:
        results = self.evaluate(query, answer, context)
        total_weight = 0.0
        weighted_sum = 0.0
        for r in results:
            w = self.weights.get(r.dimension, 1.0)
            weighted_sum += r.score * w
            total_weight += w
        if total_weight == 0.0:
            return 0.0
        return weighted_sum / total_weight
