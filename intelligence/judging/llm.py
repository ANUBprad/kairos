from __future__ import annotations

import json
import re
from typing import Optional, Sequence

from intelligence.judging.judge import BaseJudge, JudgeResult, Judgment
from intelligence.llm.base_llm import BaseLLM

_DEFAULT_FALLBACK = object()


def _parse_score(raw: str) -> Optional[tuple[float, str]]:
    """Extract (score, reason) from an LLM judge response.

    Accepts a JSON object (optionally wrapped in markdown code fences)
    with numeric ``score`` and a ``reason`` string, or a bare number.
    """
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    obj: object = None
    try:
        obj = json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        if match:
            try:
                obj = json.loads(match.group(0))
            except json.JSONDecodeError:
                obj = None

    if isinstance(obj, dict):
        score = obj.get("score")
        if isinstance(score, (int, float)) and not isinstance(score, bool):
            return (float(min(max(score, 0.0), 1.0)), str(obj.get("reason", "")))
    elif isinstance(obj, (int, float)) and not isinstance(obj, bool):
        return (float(min(max(obj, 0.0), 1.0)), "")

    return None


class LLMJudge(BaseJudge):
    """Base class for judges that ask an underlying LLM to score an answer.

    The LLM is prompted to return a ``{"score": 0-1, "reason": "..."}``
    JSON object. If the call fails or the response cannot be parsed the
    judge falls back to ``fallback_judge`` (an algorithmic judge covering
    the same dimension) when provided, otherwise it records a FAIL.
    """

    dimension: str = ""
    _dimension_label: str = ""

    def __init__(
        self,
        llm: BaseLLM,
        fallback_judge: Optional[BaseJudge] | object = _DEFAULT_FALLBACK,
        threshold_pass: float = 0.7,
        threshold_warn: float = 0.4,
    ) -> None:
        if not self.dimension:
            raise ValueError("LLMJudge subclasses must set a dimension")
        if fallback_judge is _DEFAULT_FALLBACK:
            fallback_judge = self._make_default_fallback(
                threshold_pass, threshold_warn
            )
        self.llm = llm
        self.fallback_judge = fallback_judge
        self.threshold_pass = threshold_pass
        self.threshold_warn = threshold_warn

    def _make_default_fallback(
        self, threshold_pass: float, threshold_warn: float
    ) -> BaseJudge:
        raise NotImplementedError

    def _build_prompt(
        self, query: str, answer: str, context: Sequence[str], reference: str
    ) -> str:
        raise NotImplementedError

    def evaluate(
        self,
        query: str,
        answer: str,
        context: Sequence[str],
        reference: str = "",
    ) -> JudgeResult:
        if not answer.strip():
            return JudgeResult(
                dimension=self.dimension,
                score=0.0,
                judgment=Judgment.FAIL,
                explanation="Empty answer",
            )

        try:
            prompt = self._build_prompt(query, answer, context, reference)
            raw = self.llm.complete(prompt)
        except ValueError as exc:
            return self._fallback(query, answer, context, str(exc))
        except Exception as exc:
            return self._fallback(
                query, answer, context, f"LLM call failed: {type(exc).__name__}: {exc}"
            )

        parsed = _parse_score(raw)
        if parsed is None:
            return self._fallback(
                query, answer, context, f"Unparseable LLM response: {raw[:200]!r}"
            )

        score, reason = parsed
        judgment = self._score_to_judgment(score)
        return JudgeResult(
            dimension=self.dimension,
            score=score,
            judgment=judgment,
            explanation=reason or f"{self._dimension_label} score {score:.2f}",
            details={
                "model": self._model_name(),
                "threshold_pass": self.threshold_pass,
                "threshold_warn": self.threshold_warn,
            },
        )

    def _fallback(
        self, query: str, answer: str, context: Sequence[str], reason: str
    ) -> JudgeResult:
        if self.fallback_judge is None:
            return JudgeResult(
                dimension=self.dimension,
                score=0.0,
                judgment=Judgment.FAIL,
                explanation=reason,
            )
        fallback = self.fallback_judge.evaluate(query, answer, context, "")
        return JudgeResult(
            dimension=self.dimension,
            score=fallback.score,
            judgment=fallback.judgment,
            explanation=f"{reason} — fell back to algorithmic judge",
            details=dict(fallback.details),
        )

    def _score_to_judgment(self, score: float) -> Judgment:
        if score >= self.threshold_pass:
            return Judgment.PASS
        if score >= self.threshold_warn:
            return Judgment.WARN
        return Judgment.FAIL

    def _model_name(self) -> str:
        return getattr(self.llm, "model", "") or type(self.llm).__name__


class FaithfulnessLLMJudge(LLMJudge):
    dimension: str = "llm_faithfulness"
    _dimension_label: str = "Faithfulness"

    def _make_default_fallback(
        self, threshold_pass: float, threshold_warn: float
    ) -> BaseJudge:
        from intelligence.judging.faithfulness import FaithfulnessJudge

        return FaithfulnessJudge(
            threshold_pass=threshold_pass, threshold_warn=threshold_warn
        )

    def _build_prompt(
        self, query: str, answer: str, context: Sequence[str], reference: str
    ) -> str:
        context_text = "\n".join(context)
        return (
            "You are a strict evaluator of answer faithfulness.\n"
            "Rate how faithfully the ANSWER is supported ONLY by the CONTEXT. "
            "A score of 1.0 means every claim in the answer is supported by the "
            "context; 0.0 means the answer contradicts or invents beyond the context.\n"
            f"QUERY: {query}\n\n"
            f"CONTEXT:\n{context_text}\n\n"
            f"ANSWER: {answer}\n\n"
            'Respond with JSON only: {"score": <0.0-1.0>, "reason": "<brief explanation>"}'
        )


class AnswerRelevancyLLMJudge(LLMJudge):
    dimension: str = "llm_answer_relevancy"
    _dimension_label: str = "Answer relevance"

    def _make_default_fallback(
        self, threshold_pass: float, threshold_warn: float
    ) -> BaseJudge:
        from intelligence.judging.relevance import RelevanceJudge

        return RelevanceJudge(
            threshold_pass=threshold_pass, threshold_warn=threshold_warn
        )

    def _build_prompt(
        self, query: str, answer: str, context: Sequence[str], reference: str
    ) -> str:
        return (
            "You are an evaluator of answer relevance.\n"
            "Rate how well the ANSWER addresses the QUERY. "
            "A score of 1.0 means the answer directly and completely answers the "
            "query; 0.0 means it is off-topic or unhelpful.\n"
            f"QUERY: {query}\n\n"
            f"ANSWER: {answer}\n\n"
            'Respond with JSON only: {"score": <0.0-1.0>, "reason": "<brief explanation>"}'
        )


class CorrectnessLLMJudge(LLMJudge):
    """Reference-based correctness: compares the answer to a gold reference.

    Requires the ``reference`` argument on ``evaluate`` (the expected answer);
    without one it falls back already with a clear explanation.
    """

    dimension: str = "llm_correctness"
    _dimension_label: str = "Correctness"

    def _make_default_fallback(
        self, threshold_pass: float, threshold_warn: float
    ) -> BaseJudge:
        from intelligence.judging.faithfulness import FaithfulnessJudge

        return FaithfulnessJudge(
            threshold_pass=threshold_pass, threshold_warn=threshold_warn
        )

    def _build_prompt(
        self, query: str, answer: str, context: Sequence[str], reference: str
    ) -> str:
        if not reference:
            raise ValueError("CorrectnessLLMJudge requires a reference answer")
        return (
            "You are an evaluator of answer correctness.\n"
            "Compare the ANSWER to the REFERENCE (the expected correct answer). "
            "A score of 1.0 means the answer is semantically equivalent and conveys "
            "the same key facts; 0.0 means it is incorrect or missing key facts.\n"
            f"QUERY: {query}\n\n"
            f"REFERENCE: {reference}\n\n"
            f"ANSWER: {answer}\n\n"
            'Respond with JSON only: {"score": <0.0-1.0>, "reason": "<brief explanation>"}'
        )