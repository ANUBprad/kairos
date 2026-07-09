from __future__ import annotations

import re
from typing import Sequence

from intelligence.judging.judge import BaseJudge, JudgeResult, Judgment


class GroundingJudge(BaseJudge):
    dimension: str = "grounding"

    def __init__(
        self, threshold_pass: float = 0.7, threshold_warn: float = 0.4
    ) -> None:
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
                score=0.0,
                judgment=Judgment.FAIL,
                explanation="No context provided — answer cannot be grounded",
            )

        direct_quotes = self._find_direct_quotes(answer)
        context_text = " ".join(context).lower()
        answer_lower = answer.lower()

        avg_overlap = self._compute_word_overlap(answer_lower, context_text)

        quote_support = 0
        if direct_quotes:
            supported_quotes = sum(
                1 for q in direct_quotes if q.lower() in context_text
            )
            quote_support = supported_quotes / len(direct_quotes)

        score = (
            0.4 * avg_overlap + 0.6 * quote_support if direct_quotes else avg_overlap
        )
        score = max(0.0, min(1.0, score))

        judgment = self._score_to_judgment(score)
        explanation = (
            f"Grounding score {score:.2f}: {avg_overlap:.2f} word overlap, "
            f"{quote_support:.2f} quote support"
        )

        return JudgeResult(
            dimension=self.dimension,
            score=score,
            judgment=judgment,
            explanation=explanation,
            details={
                "word_overlap_ratio": avg_overlap,
                "quote_support_ratio": quote_support if direct_quotes else None,
                "direct_quotes_found": len(direct_quotes),
                "threshold_pass": self.threshold_pass,
            },
        )

    def _score_to_judgment(self, score: float) -> Judgment:
        if score >= self.threshold_pass:
            return Judgment.PASS
        if score >= self.threshold_warn:
            return Judgment.WARN
        return Judgment.FAIL

    @staticmethod
    def _find_direct_quotes(text: str) -> list[str]:
        return re.findall(r'"([^"]+)"', text)

    @staticmethod
    def _compute_word_overlap(answer: str, context: str) -> float:
        answer_words = set(answer.lower().split())
        context_words = set(context.lower().split())
        if not answer_words:
            return 0.0
        stop_words = {
            "the",
            "a",
            "an",
            "is",
            "are",
            "was",
            "were",
            "be",
            "been",
            "being",
            "have",
            "has",
            "had",
            "do",
            "does",
            "did",
            "will",
            "would",
            "could",
            "should",
            "may",
            "might",
            "shall",
            "can",
            "to",
            "of",
            "in",
            "for",
            "on",
            "with",
            "at",
            "by",
            "from",
            "as",
            "into",
            "through",
            "during",
            "before",
            "after",
            "and",
            "but",
            "or",
            "nor",
            "not",
            "so",
            "yet",
            "both",
            "either",
            "neither",
            "each",
            "every",
            "all",
            "any",
            "few",
            "more",
            "most",
            "other",
            "some",
            "such",
            "no",
            "only",
            "own",
            "same",
            "than",
            "too",
            "very",
            "just",
            "also",
            "if",
            "then",
            "else",
            "when",
            "where",
            "why",
            "how",
            "which",
            "who",
            "whom",
            "this",
            "that",
            "these",
            "those",
            "it",
            "its",
        }
        content_words = answer_words - stop_words
        if not content_words:
            return 1.0
        return len(content_words & context_words) / len(content_words)
