"""Tests for the quality gates over evaluation aggregates (Phase E)."""

from __future__ import annotations

import pytest

from intelligence.evaluation.entry_result import EntryResult, RunResult
from intelligence.evaluation.quality_gate import (
    ConditionResult,
    QualityGateCondition,
    check_gate,
    check_gate_on_run,
)


def _run() -> RunResult:
    return RunResult(
        results=(
            EntryResult(
                entry_id="SIMPLE-001",
                query="q",
                query_type="simple",
                retrieved_chunks=("c1",),
                recall=0.9,
                precision=0.8,
                latency_total=2.0,
            ),
        )
    )


def test_condition_validates_operator() -> None:
    with pytest.raises(ValueError):
        QualityGateCondition(metric="mean_recall", operator="between", value=0.5)


def test_check_gate_all_pass() -> None:
    gate = [
        QualityGateCondition("mean_recall", "gte", 0.8),
        QualityGateCondition("mean_precision", "gte", 0.7),
    ]
    result = check_gate(gate, {"mean_recall": 0.9, "mean_precision": 0.8})
    assert result.passed is True
    assert result.score == 1.0
    assert len(result.results) == 2


def test_check_gate_fails_on_violation() -> None:
    gate = [
        QualityGateCondition("mean_recall", "gte", 0.8),
        QualityGateCondition("mean_precision", "gte", 0.95),
    ]
    result = check_gate(gate, {"mean_recall": 0.9, "mean_precision": 0.8})
    assert result.passed is False
    assert result.score == 0.5
    precision_result = result.results[1]
    assert isinstance(precision_result, ConditionResult)
    assert precision_result.passed is False
    assert precision_result.actual == 0.8
    assert precision_result.threshold == 0.95


def test_check_gate_missing_metric_fails() -> None:
    gate = [
        QualityGateCondition("mean_recall", "gte", 0.8),
        QualityGateCondition("mean_ndcg", "gte", 0.9),
    ]
    result = check_gate(gate, {"mean_recall": 0.9})
    assert result.passed is False
    assert result.results[1].passed is False


def test_check_gate_empty_conditions_fails() -> None:
    result = check_gate([], {"mean_recall": 0.9})
    assert result.passed is False
    assert result.score == 0.0


def test_all_operators() -> None:
    cases = [
        (QualityGateCondition("m", "gt", 0.5), 0.6, True),
        (QualityGateCondition("m", "gte", 0.5), 0.5, True),
        (QualityGateCondition("m", "lt", 0.5), 0.4, True),
        (QualityGateCondition("m", "lte", 0.5), 0.5, True),
        (QualityGateCondition("m", "eq", 0.5), 0.5, True),
        (QualityGateCondition("m", "neq", 0.5), 0.6, True),
    ]
    for condition, actual, expected in cases:
        assert check_gate([condition], {"m": actual}).passed is expected


def test_check_gate_on_run_uses_snapshot() -> None:
    gate = [
        QualityGateCondition("mean_recall", "gte", 0.88),
        QualityGateCondition("mean_latency.total", "lte", 5.0),
    ]
    result = check_gate_on_run(gate, _run())
    assert result.passed is True


def test_to_dict() -> None:
    gate = [QualityGateCondition("mean_recall", "gte", 0.95)]
    payload = check_gate(gate, {"mean_recall": 0.9}).to_dict()
    assert payload["passed"] is False
    assert payload["results"][0]["metric"] == "mean_recall"
    assert payload["results"][0]["actual"] == 0.9
