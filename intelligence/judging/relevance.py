from __future__ import annotations

from typing import List, Sequence, Set

from intelligence.judging.judge import BaseJudge, JudgeResult, Judgment


class RelevanceJudge(BaseJudge):
    dimension: str = "relevance"

    def __init__(self, threshold_pass: float = 0.6, threshold_warn: float = 0.3) -> None:
        self.threshold_pass = threshold_pass
        self.threshold_warn = threshold_warn

    def evaluate(
        self,
        query: str,
        answer: str,
        context: Sequence[str],
    ) -> JudgeResult:
        if not answer.strip():
            return JudgeResult(
                dimension=self.dimension,
                score=0.0,
                judgment=Judgment.FAIL,
                explanation="Empty answer",
            )

        query_tokens = self._tokenize(query)
        answer_tokens = self._tokenize(answer)

        if not query_tokens:
            return JudgeResult(
                dimension=self.dimension,
                score=1.0,
                judgment=Judgment.PASS,
                explanation="No query tokens to compare",
            )

        overlap = query_tokens & answer_tokens
        score = len(overlap) / len(query_tokens)

        judgment = self._score_to_judgment(score)
        explanation = (
            f"Relevance score {score:.2f}: {len(overlap)}/{len(query_tokens)} "
            f"query tokens found in answer"
        )

        return JudgeResult(
            dimension=self.dimension,
            score=score,
            judgment=judgment,
            explanation=explanation,
            details={
                "query_tokens": len(query_tokens),
                "overlap": len(overlap),
                "overlap_tokens": sorted(overlap),
            },
        )

    def _score_to_judgment(self, score: float) -> Judgment:
        if score >= self.threshold_pass:
            return Judgment.PASS
        if score >= self.threshold_warn:
            return Judgment.WARN
        return Judgment.FAIL

    @staticmethod
    def _tokenize(text: str) -> Set[str]:
        import re
        return set(re.findall(r"[a-zA-Z0-9_]+", text.lower()))
