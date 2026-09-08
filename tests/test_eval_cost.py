"""Tests for Phase B — cost estimation + trace ids on eval results."""

from __future__ import annotations

import contextvars

import pytest

from intelligence.evaluation.cost import estimate_cost
from intelligence.evaluation.entry_result import (
    EntryResult,
    RunResult,
    get_trace_id,
    new_trace_id,
    set_trace_id,
)


class TestEstimateCost:
    def test_known_model_gpt4o(self) -> None:
        # $2.50/M in, $10/M out
        assert estimate_cost("gpt-4o", 1_000_000, 1_000_000) == pytest.approx(12.50)

    def test_known_model_gpt4_mini(self) -> None:
        assert estimate_cost("gpt-4o-mini", 1_000_000, 1_000_000) == pytest.approx(
            0.75
        )

    def test_unknown_model_uses_default(self) -> None:
        # default $2.50/M in, $10/M out
        assert estimate_cost("some-exotic-model", 1_000_000, 1_000_000) == (
            2.50 + 10.00
        )

    def test_ollama_free(self) -> None:
        assert estimate_cost("llama3", 1_000_000, 1_000_000) == 0.0
        assert estimate_cost("llama3:8b", 5, 9) == 0.0

    def test_zero_tokens_zero_cost(self) -> None:
        assert estimate_cost("gpt-4o", 0, 0) == 0.0

    def test_case_insensitive_self_hosted(self) -> None:
        assert estimate_cost("Llama3:LATEST", 1_000_000, 0) == 0.0

    def test_paid_llama3_70b_not_self_hosted(self) -> None:
        # llama3-70b is a paid Groq model, must not be treated as free
        assert estimate_cost("llama3-70b", 1_000_000, 0) > 0.0


class TestTraceIdContext:
    def test_default_empty(self) -> None:
        set_trace_id("")
        assert get_trace_id() == ""

    def test_set_and_get(self) -> None:
        set_trace_id("abc")
        assert get_trace_id() == "abc"

    def test_new_trace_id_unique(self) -> None:
        a = new_trace_id()
        b = new_trace_id()
        assert a != b
        assert get_trace_id() == b

    def test_trace_id_isolation_between_contexts(self) -> None:
        from intelligence.evaluation.entry_result import _trace_id_var

        token = _trace_id_var.set("outer")
        try:
            ctx = contextvars.copy_context()

            def _set_inner() -> None:
                set_trace_id("inner")

            ctx.run(_set_inner)
            assert get_trace_id() == "outer"
        finally:
            _trace_id_var.reset(token)


class TestEntryResultCostAndTrace:
    def test_to_dict_includes_cost_and_trace(self) -> None:
        r = EntryResult(
            entry_id="Q1",
            query="q",
            query_type="simple",
            generated_answer="a",
            prompt_tokens=100,
            completion_tokens=50,
            model="gpt-4o",
            cost_usd=0.00075,
            trace_id="t1",
        )
        d = r.to_dict()
        assert d["cost_usd"] == 0.00075
        assert d["trace_id"] == "t1"

    def test_to_dict_omits_cost_when_no_generation(self) -> None:
        r = EntryResult(entry_id="Q1", query="q", query_type="simple")
        assert "cost_usd" not in r.to_dict()

    def test_trace_id_empty_omitted(self) -> None:
        r = EntryResult(entry_id="Q1", query="q", query_type="simple")
        assert "trace_id" not in r.to_dict()


class TestRunResultCost:
    def test_total_cost(self) -> None:
        r = RunResult(
            results=(
                EntryResult(
                    entry_id="Q1", query="q", query_type="s", cost_usd=0.1
                ),
                EntryResult(
                    entry_id="Q2", query="q", query_type="s", cost_usd=0.2
                ),
            )
        )
        assert r.total_cost() == pytest.approx(0.3)

    def test_total_cost_empty(self) -> None:
        assert RunResult(results=()).total_cost() == 0.0

    def test_to_dict_includes_total_cost(self) -> None:
        r = RunResult(
            results=(
                EntryResult(
                    entry_id="Q1", query="q", query_type="s", cost_usd=0.15
                ),
            )
        )
        assert r.to_dict()["total_cost_usd"] == pytest.approx(0.15)