from __future__ import annotations

from typing import List, Sequence, Set, Tuple

from intelligence.judging.judge import BaseJudge, JudgeResult, Judgment


class HallucinationJudge(BaseJudge):
    dimension: str = "hallucination"

    def __init__(self, threshold_pass: float = 0.8, threshold_warn: float = 0.6) -> None:
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
                score=1.0,
                judgment=Judgment.PASS,
                explanation="Empty answer — no hallucination risk",
            )
        if not context:
            return JudgeResult(
                dimension=self.dimension,
                score=0.0,
                judgment=Judgment.FAIL,
                explanation="No context provided — cannot detect hallucination",
            )

        answer_claims = self._extract_claims(answer)
        context_text = " ".join(context).lower()
        context_ngrams = self._build_context_ngrams(context_text)

        unsupported_claims: List[str] = []
        supported_claims: List[str] = []
        for claim in answer_claims:
            if self._claim_is_supported(claim, context_ngrams):
                supported_claims.append(claim)
            else:
                unsupported_claims.append(claim)

        total = len(answer_claims)
        if total == 0:
            return JudgeResult(
                dimension=self.dimension,
                score=1.0,
                judgment=Judgment.PASS,
                explanation="No extractable claims in answer",
            )

        supported_ratio = len(supported_claims) / total
        score = supported_ratio

        judgment = self._score_to_judgment(score)
        explanation = (
            f"Hallucination score {score:.2f}: {len(supported_claims)}/{total} "
            f"claims supported by context"
        )

        return JudgeResult(
            dimension=self.dimension,
            score=score,
            judgment=judgment,
            explanation=explanation,
            details={
                "total_claims": total,
                "supported_claims": len(supported_claims),
                "unsupported_claims": len(unsupported_claims),
                "unsupported_examples": unsupported_claims[:5],
            },
        )

    def _score_to_judgment(self, score: float) -> Judgment:
        hallucination_free_score = score
        if hallucination_free_score >= self.threshold_pass:
            return Judgment.PASS
        if hallucination_free_score >= self.threshold_warn:
            return Judgment.WARN
        return Judgment.FAIL

    @staticmethod
    def _extract_claims(text: str) -> List[str]:
        sentences = text.replace("! ", ". ").replace("? ", ". ").split(". ")
        claims: List[str] = []
        for s in sentences:
            cleaned = s.strip().lower()
            if cleaned and len(cleaned) > 10:
                claims.append(cleaned)
        return claims

    @staticmethod
    def _build_context_ngrams(text: str, n: int = 3) -> Set[str]:
        words = text.lower().split()
        if len(words) < n:
            return {text.lower()}
        return {" ".join(words[i:i + n]) for i in range(len(words) - n + 1)}

    @staticmethod
    def _claim_is_supported(claim: str, context_ngrams: Set[str]) -> bool:
        claim_words = claim.split()
        if len(claim_words) < 4:
            return claim in context_ngrams or any(
                claim in ng for ng in context_ngrams
            )
        claim_trigrams = {
            " ".join(claim_words[i:i + 3])
            for i in range(len(claim_words) - 2)
        }
        if not claim_trigrams:
            return False
        matches = sum(1 for tg in claim_trigrams if tg in context_ngrams)
        return (matches / len(claim_trigrams)) >= 0.5
