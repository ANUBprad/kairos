from __future__ import annotations

from typing import List, Sequence, Set

from intelligence.judging.judge import BaseJudge, JudgeResult, Judgment


class FaithfulnessJudge(BaseJudge):
    dimension: str = "faithfulness"

    def __init__(self, threshold_pass: float = 0.7, threshold_warn: float = 0.4) -> None:
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
        if not context:
            return JudgeResult(
                dimension=self.dimension,
                score=1.0,
                judgment=Judgment.PASS,
                explanation="No context provided — cannot verify faithfulness",
            )

        answer_ngrams = self._extract_ngrams(answer)
        context_text = " ".join(context)
        context_ngrams = self._extract_ngrams(context_text)

        if not answer_ngrams:
            return JudgeResult(
                dimension=self.dimension,
                score=1.0,
                judgment=Judgment.PASS,
                explanation="No extractable n-grams in answer",
            )

        supported = sum(1 for ng in answer_ngrams if ng in context_ngrams)
        score = supported / len(answer_ngrams)

        judgment = self._score_to_judgment(score)
        explanation = self._build_explanation(score, supported, len(answer_ngrams))

        return JudgeResult(
            dimension=self.dimension,
            score=score,
            judgment=judgment,
            explanation=explanation,
            details={
                "supported_ngrams": supported,
                "total_ngrams": len(answer_ngrams),
                "threshold_pass": self.threshold_pass,
                "threshold_warn": self.threshold_warn,
            },
        )

    def _score_to_judgment(self, score: float) -> Judgment:
        if score >= self.threshold_pass:
            return Judgment.PASS
        if score >= self.threshold_warn:
            return Judgment.WARN
        return Judgment.FAIL

    @staticmethod
    def _build_explanation(score: float, supported: int, total: int) -> str:
        return (
            f"Faithfulness score {score:.2f}: {supported}/{total} "
            f"answer n-grams supported by context"
        )

    @staticmethod
    def _extract_ngrams(text: str, n: int = 3) -> Set[str]:
        words = text.lower().split()
        if len(words) < n:
            return set(text.lower().split())
        return {" ".join(words[i:i + n]) for i in range(len(words) - n + 1)}
