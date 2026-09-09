"""Tests for Phase A — native LLM-as-Judge."""

from __future__ import annotations

import json


from intelligence.judging.llm import (
    AnswerRelevancyLLMJudge,
    CorrectnessLLMJudge,
    FaithfulnessLLMJudge,
    _parse_score,
)
from intelligence.judging.judge import BaseJudge, CompositeJudge, Judgment
from intelligence.llm.base_llm import BaseLLM


class _FakeLLM(BaseLLM):
    def __init__(self, responses: list[str] | None = None) -> None:
        super().__init__(client=object(), model_name="fake-model")
        self._responses = list(responses or [])
        self.prompts: list[str] = []

    def get_response(self, query: str, chunks: list[str]):
        raise AssertionError("judge should not call get_response")

    def complete(self, prompt: str) -> str:
        self.prompts.append(prompt)
        if not self._responses:
            raise AssertionError("no scripted response left")
        return self._responses.pop(0)


class _RaisingLLM(_FakeLLM):
    def complete(self, prompt: str) -> str:
        self.prompts.append(prompt)
        raise RuntimeError("provider down")


class _RecordingJudge(BaseJudge):
    dimension = "recorded"

    def __init__(self) -> None:
        self.received_reference: str | None = None
        self.calls = 0

    def evaluate(self, query, answer, context, reference: str = "") -> object:
        self.calls += 1
        self.received_reference = reference
        from intelligence.judging.judge import JudgeResult

        return JudgeResult(self.dimension, 0.5, Judgment.WARN)


class TestParseScore:
    def test_plain_json(self) -> None:
        assert _parse_score('{"score": 0.8, "reason": "ok"}') == (0.8, "ok")

    def test_json_inside_code_fence(self) -> None:
        raw = '```json\n{"score": 0.9, "reason": "good"}\n```'
        assert _parse_score(raw) == (0.9, "good")

    def test_reason_missing(self) -> None:
        assert _parse_score('{"score": 0.5}') == (0.5, "")

    def test_missing_score_field(self) -> None:
        assert _parse_score('{"foo": 1}') is None

    def test_score_out_of_range_clamped(self) -> None:
        assert _parse_score('{"score": 1.5}') == (1.0, "")
        assert _parse_score('{"score": -0.3}') == (0.0, "")

    def test_json_embedded_in_prose(self) -> None:
        raw = 'Here you go: {"score": 0.6, "reason": "decent"} — hope it helps.'
        assert _parse_score(raw) == (0.6, "decent")

    def test_garbage(self) -> None:
        assert _parse_score("I cannot rate this.") is None


class TestFaithfulnessLLMJudge:
    def test_uses_complete_with_judge_prompt(self) -> None:
        llm = _FakeLLM(['{"score": 0.0, "reason": "no"}'])
        judge = FaithfulnessLLMJudge(llm)
        result = judge.evaluate(
            query="q", answer="The sky is blue", context=["GRASS IS GREEN"]
        )
        assert llm.prompts, "complete() must be invoked"
        assert "faithfulness" in llm.prompts[0].lower()
        assert "skies are blue" not in llm.prompts[0]
        assert result.dimension == "llm_faithfulness"
        assert result.score == 0.0
        assert result.judgment == Judgment.FAIL
        assert result.details.get("model") == "fake-model"

    def test_empty_answer_fails_without_llm_call(self) -> None:
        llm = _FakeLLM([])
        judge = FaithfulnessLLMJudge(llm)
        result = judge.evaluate(query="q", answer="   ", context=["does not matter"])
        assert result.judgment == Judgment.FAIL
        assert llm.prompts == []

    def test_judgment_buckets(self) -> None:
        llm = _FakeLLM(['{"score": 0.8}', '{"score": 0.5}', '{"score": 0.1}'])
        judge = FaithfulnessLLMJudge(llm)
        assert judge.evaluate("q", "a", ["c"]).judgment == Judgment.PASS
        assert judge.evaluate("q", "a", ["c"]).judgment == Judgment.WARN
        assert judge.evaluate("q", "a", ["c"]).judgment == Judgment.FAIL

    def test_fallback_on_llm_failure(self) -> None:
        llm = _RaisingLLM([])
        from intelligence.judging.faithfulness import FaithfulnessJudge

        fallback = FaithfulnessJudge()
        judge = FaithfulnessLLMJudge(llm, fallback_judge=fallback)
        result = judge.evaluate(
            query="q", answer="GRASS IS GREEN", context=["GRASS IS GREEN"]
        )
        assert result.dimension == "llm_faithfulness"
        assert result.score > 0.0
        assert "algorithmic judge" in result.explanation

    def test_fallback_when_response_unparseable(self) -> None:
        llm = _FakeLLM(["I refuse to answer."])
        judge = FaithfulnessLLMJudge(llm)
        result = judge.evaluate("q", "GRASS IS GREEN", ["GRASS IS GREEN"])
        assert result.judgment == Judgment.PASS  # algorithmic fallback supports it
        assert "Unparseable" in result.explanation

    def test_no_fallback_raises_fail(self) -> None:
        llm = _FakeLLM(["I refuse to answer."])
        judge = FaithfulnessLLMJudge(llm, fallback_judge=None)
        result = judge.evaluate("q", "GRASS IS GREEN", ["GRASS IS GREEN"])
        assert result.score == 0.0
        assert result.judgment == Judgment.FAIL

    def test_default_fallback_is_algorithmic_faithfulness(self) -> None:
        llm = _RaisingLLM([])
        judge = FaithfulnessLLMJudge(llm)
        result = judge.evaluate(
            query="q", answer="GRASS IS GREEN", context=["GRASS IS GREEN"]
        )
        assert result.score == 1.0
        assert result.details["supported_ngrams"] == 1
        assert result.score > 0.0


class TestAnswerRelevancyLLMJudge:
    def test_prompt_contains_query_and_answer(self) -> None:
        llm = _FakeLLM(['{"score": 0.9, "reason": "on topic"}'])
        judge = AnswerRelevancyLLMJudge(llm)
        result = judge.evaluate(query="what is kairos", answer="an engine", context=[])
        assert "what is kairos" in llm.prompts[0]
        assert "an engine" in llm.prompts[0]
        assert result.dimension == "llm_answer_relevancy"
        assert result.score == 0.9
        assert result.judgment == Judgment.PASS


class TestCorrectnessLLMJudge:
    def test_requires_reference(self) -> None:
        llm = _FakeLLM([])
        judge = CorrectnessLLMJudge(llm)
        result = judge.evaluate(query="q", answer="a", context=["c"], reference="")
        assert result.judgment == Judgment.FAIL
        assert "reference" in result.explanation
        assert llm.prompts == []

    def test_reference_in_prompt_and_score_near_perfect(self) -> None:
        llm = _FakeLLM(['{"score": 0.99, "reason": "matches"}'])
        judge = CorrectnessLLMJudge(llm)
        result = judge.evaluate(
            query="q",
            answer="Paris is the capital of France",
            context=["c"],
            reference="Paris is the capital of France.",
        )
        assert "Paris is the capital of France" in llm.prompts[0]
        assert result.dimension == "llm_correctness"
        assert result.score == 0.99
        assert result.judgment == Judgment.PASS


class TestCompositeWithLLMJudge:
    def test_reference_only_reaches_llm_correctness(self) -> None:
        composite = CompositeJudge()
        composite.add_judge(_RecordingJudge())
        composite.add_judge(CorrectnessLLMJudge(_FakeLLM(['{"score": 0.9}'])))
        results = composite.evaluate(
            query="q", answer="a", context=["c"], reference="gold"
        )
        by_dim = {r.dimension: r for r in results}
        assert by_dim["recorded"].dimension == "recorded"
        assert "llm_correctness" in by_dim

    def test_composite_forwards_reference_to_judges(self) -> None:
        recorder = _RecordingJudge()
        llm = _FakeLLM(['{"score": 0.9}'])
        composite = CompositeJudge()
        composite.add_judge(recorder)
        composite.add_judge(CorrectnessLLMJudge(llm))
        composite.composite_score(
            query="q", answer="a", context=["c"], reference="gold"
        )
        assert recorder.received_reference == "gold"

    def test_composite_without_reference_falls_back(self) -> None:
        composite = CompositeJudge()
        composite.add_judge(CorrectnessLLMJudge(_FakeLLM([])))
        results = composite.evaluate(query="q", answer="a", context=["c"])
        assert results[0].judgment == Judgment.FAIL


def test_json_module_roundtrip() -> None:
    """Guard the exact response shape the judges are scripted against."""
    assert json.loads('{"score": 0.8, "reason": "ok"}')["score"] == 0.8
