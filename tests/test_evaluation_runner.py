"""Tests for the evaluation runner, RunConfig, EntryResult, and RunResult."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from benchmarks.dataset.loader import QueryEntry
from intelligence.evaluation.entry_result import EntryResult, RunResult
from intelligence.evaluation.run_config import RunConfig
from intelligence.evaluation.runner import EvaluationRunner


# ── RunConfig ────────────────────────────────────────────────────────────────


class TestRunConfig:
    def test_construction(self) -> None:
        cfg = RunConfig(namespace="test_ns", dataset_name="test_ds")
        assert cfg.namespace == "test_ns"
        assert cfg.dataset_name == "test_ds"
        assert cfg.generate is True
        assert cfg.judge is True
        assert cfg.top_k is None
        assert cfg.max_entries is None
        assert cfg.extra == {}

    def test_frozen(self) -> None:
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        with pytest.raises(AttributeError):
            cfg.namespace = "other"  # type: ignore[misc]

    def test_to_dict(self) -> None:
        cfg = RunConfig(
            namespace="ns",
            dataset_name="ds",
            generate=False,
            top_k=5,
            extra={"key": "val"},
        )
        d = cfg.to_dict()
        assert d["namespace"] == "ns"
        assert d["dataset_name"] == "ds"
        assert d["generate"] is False
        assert d["top_k"] == 5
        assert d["extra"] == {"key": "val"}

    def test_defaults(self) -> None:
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        assert cfg.dataset_path is None
        assert cfg.generate is True
        assert cfg.judge is True


# ── EntryResult ──────────────────────────────────────────────────────────────


class TestEntryResult:
    def test_ok_entry(self) -> None:
        r = EntryResult(
            entry_id="Q1",
            query="test query",
            query_type="simple",
        )
        assert r.status == "ok"
        assert r.entry_id == "Q1"
        assert r.generated_answer is None
        assert r.recall is None

    def test_error_entry(self) -> None:
        r = EntryResult(
            entry_id="Q1",
            query="test",
            query_type="simple",
            status="error",
            error_type="RuntimeError",
            error_message="something broke",
        )
        assert r.status == "error"
        assert r.error_type == "RuntimeError"

    def test_to_dict_ok(self) -> None:
        r = EntryResult(
            entry_id="Q1",
            query="q",
            query_type="simple",
            retrieved_chunks=("c1", "c2"),
            recall=0.8,
            precision=0.5,
            generated_answer="answer",
            prompt_tokens=100,
            completion_tokens=50,
            model="gpt-4",
            judge_scores={"faithfulness": 0.9},
            composite_judge_score=0.85,
        )
        d = r.to_dict()
        assert d["entry_id"] == "Q1"
        assert d["retrieved_chunks"] == ["c1", "c2"]
        assert d["recall"] == 0.8
        assert d["generated_answer"] == "answer"
        assert d["prompt_tokens"] == 100
        assert d["model"] == "gpt-4"
        assert d["judge_scores"] == {"faithfulness": 0.9}
        assert d["composite_judge_score"] == 0.85

    def test_to_dict_error(self) -> None:
        r = EntryResult(
            entry_id="Q1",
            query="q",
            query_type="simple",
            status="error",
            error_type="ValueError",
            error_message="bad input",
        )
        d = r.to_dict()
        assert d["status"] == "error"
        assert d["error_type"] == "ValueError"
        assert "generated_answer" not in d

    def test_to_dict_no_generated(self) -> None:
        r = EntryResult(
            entry_id="Q1",
            query="q",
            query_type="simple",
            generated_answer=None,
        )
        d = r.to_dict()
        assert "generated_answer" not in d
        assert "prompt_tokens" not in d

    def test_frozen(self) -> None:
        r = EntryResult(entry_id="Q1", query="q", query_type="simple")
        with pytest.raises(AttributeError):
            r.entry_id = "Q2"  # type: ignore[misc]


# ── RunResult ────────────────────────────────────────────────────────────────


class TestRunResult:
    def _make_entry(
        self,
        entry_id: str = "Q1",
        status: str = "ok",
        query_type: str = "simple",
        recall: float | None = None,
        precision: float | None = None,
        judge_scores: dict | None = None,
        latency_total: float = 0.1,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> EntryResult:
        return EntryResult(
            entry_id=entry_id,
            query=f"query {entry_id}",
            query_type=query_type,
            status=status,
            recall=recall,
            precision=precision,
            judge_scores=judge_scores or {},
            latency_total=latency_total,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
        )

    def test_total(self) -> None:
        r = RunResult(results=(self._make_entry("Q1"), self._make_entry("Q2")))
        assert r.total == 2

    def test_succeeded(self) -> None:
        r = RunResult(
            results=(
                self._make_entry("Q1", status="ok"),
                self._make_entry("Q2", status="error"),
                self._make_entry("Q3", status="ok"),
            )
        )
        assert r.succeeded == 2
        assert r.failed == 1
        assert r.success_rate == pytest.approx(2 / 3)

    def test_empty(self) -> None:
        r = RunResult(results=())
        assert r.total == 0
        assert r.success_rate == 0.0

    def test_mean_recall(self) -> None:
        r = RunResult(
            results=(
                self._make_entry("Q1", recall=1.0),
                self._make_entry("Q2", recall=0.5),
            )
        )
        assert r.mean_recall() == pytest.approx(0.75)

    def test_mean_recall_none_when_no_ground_truth(self) -> None:
        r = RunResult(results=(self._make_entry("Q1", recall=None),))
        assert r.mean_recall() is None

    def test_mean_precision(self) -> None:
        r = RunResult(
            results=(
                self._make_entry("Q1", precision=1.0),
                self._make_entry("Q2", precision=0.0),
            )
        )
        assert r.mean_precision() == pytest.approx(0.5)

    def test_mean_latency(self) -> None:
        r = RunResult(
            results=(
                self._make_entry("Q1", latency_total=0.1),
                self._make_entry("Q2", latency_total=0.3),
            )
        )
        lat = r.mean_latency()
        assert lat["total"] == pytest.approx(0.2)

    def test_mean_judge_scores(self) -> None:
        r = RunResult(
            results=(
                self._make_entry(
                    "Q1", judge_scores={"faithfulness": 0.8, "relevance": 0.6}
                ),
                self._make_entry(
                    "Q2", judge_scores={"faithfulness": 1.0, "relevance": 0.4}
                ),
            )
        )
        scores = r.mean_judge_scores()
        assert scores["faithfulness"] == pytest.approx(0.9)
        assert scores["relevance"] == pytest.approx(0.5)

    def test_total_tokens(self) -> None:
        r = RunResult(
            results=(
                self._make_entry("Q1", prompt_tokens=100, completion_tokens=50),
                self._make_entry("Q2", prompt_tokens=200, completion_tokens=30),
            )
        )
        tokens = r.total_tokens()
        assert tokens["prompt_tokens"] == 300
        assert tokens["completion_tokens"] == 80

    def test_per_type_results(self) -> None:
        r = RunResult(
            results=(
                self._make_entry("Q1", query_type="simple"),
                self._make_entry("Q2", query_type="complex"),
                self._make_entry("Q3", query_type="simple"),
            )
        )
        by_type = r.per_type_results()
        assert len(by_type["simple"]) == 2
        assert len(by_type["complex"]) == 1

    def test_to_dict(self) -> None:
        r = RunResult(
            results=(
                self._make_entry("Q1", recall=0.8, precision=0.5, latency_total=0.1),
            )
        )
        d = r.to_dict()
        assert d["total"] == 1
        assert d["succeeded"] == 1
        assert d["mean_recall"] == pytest.approx(0.8)
        assert d["mean_precision"] == pytest.approx(0.5)


# ── EvaluationRunner ─────────────────────────────────────────────────────────


def _make_engine():
    engine = MagicMock()
    engine.classify_query.return_value = {
        "query_type": 1,
        "retrieval_type": 1,
        "top_k": 5,
        "rerank": False,
        "decompose": False,
        "confidence_score": 0.9,
    }
    engine.execute_retrieval.return_value = {
        "chunks": ["chunk_a", "chunk_b"],
        "used_type": 1,
        "fallback_triggered": False,
        "escalated_tier_str": "",
    }
    engine.generate_response.return_value = {
        "response": "The answer is Article 3.",
        "prompt_tokens": 100,
        "completion_tokens": 20,
        "model": "gpt-4o-mini",
    }
    return engine


def _make_entry(
    entry_id: str = "SIMPLE-001",
    expected_chunks: list[str] | None = None,
    expected_answer: str | None = None,
) -> QueryEntry:
    return QueryEntry(
        id=entry_id,
        text="What is an AI system?",
        query_type="simple",
        expected_chunks=expected_chunks,
        expected_answer=expected_answer,
    )


class TestEvaluationRunner:
    def test_single_entry_ok(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="test_ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry(expected_chunks=["chunk_a"])
        result = runner.run([entry])

        assert result.total == 1
        assert result.succeeded == 1
        er = result.results[0]
        assert er.status == "ok"
        assert er.generated_answer == "The answer is Article 3."
        assert er.recall == 1.0
        assert er.precision == pytest.approx(0.5)
        assert er.model == "gpt-4o-mini"
        assert er.prompt_tokens == 100
        assert er.completion_tokens == 20

    def test_retrieval_metrics_computed(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry(expected_chunks=["chunk_a", "chunk_c"])
        result = runner.run([entry])
        er = result.results[0]
        assert er.recall == pytest.approx(0.5)
        assert er.precision == pytest.approx(0.5)

    def test_recall_zero_when_no_chunks(self) -> None:
        engine = _make_engine()
        engine.execute_retrieval.return_value = {
            "chunks": [],
            "used_type": 1,
            "fallback_triggered": False,
            "escalated_tier_str": "",
        }
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry(expected_chunks=["chunk_a"])
        result = runner.run([entry])
        er = result.results[0]
        assert er.recall == 0.0
        assert er.precision == 0.0

    def test_recall_none_without_ground_truth(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry(expected_chunks=None)
        result = runner.run([entry])
        er = result.results[0]
        assert er.recall is None
        assert er.precision is None

    def test_generate_disabled(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="ns", dataset_name="ds", generate=False)
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry()
        result = runner.run([entry])
        er = result.results[0]
        assert er.generated_answer is None
        engine.generate_response.assert_not_called()

    def test_multiple_entries(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entries = [_make_entry("Q1"), _make_entry("Q2")]
        result = runner.run(entries)
        assert result.total == 2
        assert result.succeeded == 2

    def test_entry_failure_continues(self) -> None:
        engine = _make_engine()
        call_count = 0

        def classify_side_effect(query):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise RuntimeError("classifier down")
            return {
                "query_type": 1,
                "retrieval_type": 1,
                "top_k": 5,
                "rerank": False,
                "decompose": False,
                "confidence_score": 0.9,
            }

        engine.classify_query.side_effect = classify_side_effect
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entries = [_make_entry("Q1"), _make_entry("Q2")]
        result = runner.run(entries)
        assert result.total == 2
        assert result.succeeded == 1
        assert result.failed == 1
        assert result.results[0].status == "error"
        assert result.results[0].error_type == "RuntimeError"
        assert result.results[1].status == "ok"

    def test_retrieval_failure_recorded(self) -> None:
        engine = _make_engine()
        engine.execute_retrieval.side_effect = ConnectionError("chroma down")
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry()
        result = runner.run([entry])
        er = result.results[0]
        assert er.status == "error"
        assert er.error_type == "ConnectionError"

    def test_generation_failure_recorded(self) -> None:
        engine = _make_engine()
        engine.generate_response.side_effect = TimeoutError("LLM timeout")
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry()
        result = runner.run([entry])
        er = result.results[0]
        assert er.status == "error"
        assert er.error_type == "TimeoutError"

    def test_top_k_override(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="ns", dataset_name="ds", top_k=3)
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry()
        runner.run([entry])
        call_args = engine.execute_retrieval.call_args
        assert call_args.kwargs["top_k"] == 3

    def test_max_entries(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="ns", dataset_name="ds", max_entries=2)
        runner = EvaluationRunner(engine=engine, config=cfg)

        entries = [_make_entry("Q1"), _make_entry("Q2"), _make_entry("Q3")]
        result = runner.run(entries)
        assert result.total == 2

    def test_judge_integration(self) -> None:
        from intelligence.judging import (
            CompositeJudge,
            FaithfulnessJudge,
            RelevanceJudge,
        )

        engine = _make_engine()
        judge = CompositeJudge()
        judge.add_judge(FaithfulnessJudge())
        judge.add_judge(RelevanceJudge())

        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg, judge=judge)

        entry = _make_entry()
        result = runner.run([entry])
        er = result.results[0]
        assert "faithfulness" in er.judge_scores
        assert "relevance" in er.judge_scores
        assert er.composite_judge_score is not None
        assert 0.0 <= er.composite_judge_score <= 1.0

    def test_latency_recorded(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry()
        result = runner.run([entry])
        er = result.results[0]
        assert er.latency_classify > 0
        assert er.latency_retrieval > 0
        assert er.latency_generation > 0
        assert er.latency_total > 0

    def test_empty_entries(self) -> None:
        engine = _make_engine()
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        result = runner.run([])
        assert result.total == 0

    def test_error_entry_no_secrets(self) -> None:
        engine = _make_engine()
        engine.classify_query.side_effect = ValueError("api_key=sk-abc123")
        cfg = RunConfig(namespace="ns", dataset_name="ds")
        runner = EvaluationRunner(engine=engine, config=cfg)

        entry = _make_entry()
        result = runner.run([entry])
        er = result.results[0]
        assert er.status == "error"
        d = er.to_dict()
        assert "sk-abc123" not in str(d.get("error_message", ""))


# ── QueryEntry extension ─────────────────────────────────────────────────────


class TestQueryEntryExpectedAnswer:
    def test_default_none(self) -> None:
        e = QueryEntry(id="Q1", text="q", query_type="simple")
        assert e.expected_answer is None

    def test_with_expected_answer(self) -> None:
        e = QueryEntry(
            id="Q1",
            text="q",
            query_type="simple",
            expected_answer="The answer is 42.",
        )
        assert e.expected_answer == "The answer is 42."

    def test_backward_compat(self) -> None:
        e = QueryEntry(
            id="Q1",
            text="q",
            query_type="simple",
            domain="test",
            expected_chunks=["c1"],
        )
        assert e.domain == "test"
        assert e.expected_chunks == ["c1"]
        assert e.expected_answer is None

    def test_frozen(self) -> None:
        e = QueryEntry(id="Q1", text="q", query_type="simple")
        with pytest.raises(AttributeError):
            e.expected_answer = "x"  # type: ignore[misc]
