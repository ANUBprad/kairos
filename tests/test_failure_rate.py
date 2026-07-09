"""Unit tests for benchmarks.metrics.failure_rate."""

from __future__ import annotations

import pytest

from benchmarks.metrics import FailureRecord, compute_failure_rates, merge_records


class TestFailureRecord:
    """FailureRecord dataclass."""

    def test_defaults(self) -> None:
        record = FailureRecord()
        assert record.empty_retrieval == 0
        assert record.timeout == 0
        assert record.planner_fallback == 0
        assert record.generation_failure == 0
        assert record.total_queries == 0

    def test_frozen(self) -> None:
        record = FailureRecord()
        with pytest.raises(AttributeError):
            record.empty_retrieval = 1  # type: ignore[misc]

    def test_all_fields_set(self) -> None:
        record = FailureRecord(
            empty_retrieval=2,
            timeout=1,
            planner_fallback=3,
            generation_failure=0,
            total_queries=50,
        )
        assert record.empty_retrieval == 2
        assert record.timeout == 1
        assert record.planner_fallback == 3
        assert record.generation_failure == 0
        assert record.total_queries == 50


class TestComputeFailureRates:
    """compute_failure_rates function."""

    def test_basic(self) -> None:
        record = FailureRecord(
            empty_retrieval=2,
            timeout=0,
            planner_fallback=3,
            generation_failure=1,
            total_queries=20,
        )
        rates = compute_failure_rates(record)
        assert rates["empty_retrieval_rate"] == 0.1
        assert rates["timeout_rate"] == 0.0
        assert rates["planner_fallback_rate"] == 0.15
        assert rates["generation_failure_rate"] == 0.05
        assert rates["overall_failure_rate"] == pytest.approx(0.3)

    def test_no_failures(self) -> None:
        record = FailureRecord(total_queries=100)
        rates = compute_failure_rates(record)
        assert all(v == 0.0 for v in rates.values())

    def test_all_queries_fail(self) -> None:
        record = FailureRecord(
            empty_retrieval=5,
            timeout=3,
            planner_fallback=2,
            generation_failure=0,
            total_queries=10,
        )
        rates = compute_failure_rates(record)
        assert rates["overall_failure_rate"] == 1.0

    def test_zero_total(self) -> None:
        """All rates are 0.0 when total is 0 (avoids division by zero)."""
        record = FailureRecord(empty_retrieval=1, total_queries=0)
        rates = compute_failure_rates(record)
        assert all(v == 0.0 for v in rates.values())

    def test_returns_float_values(self) -> None:
        record = FailureRecord(empty_retrieval=1, total_queries=10)
        rates = compute_failure_rates(record)
        for v in rates.values():
            assert isinstance(v, float)

    def test_all_keys_present(self) -> None:
        rates = compute_failure_rates(FailureRecord())
        expected_keys = {
            "empty_retrieval_rate",
            "timeout_rate",
            "planner_fallback_rate",
            "generation_failure_rate",
            "overall_failure_rate",
        }
        assert set(rates.keys()) == expected_keys


class TestMergeRecords:
    """merge_records function."""

    def test_basic_merge(self) -> None:
        r1 = FailureRecord(empty_retrieval=1, total_queries=10)
        r2 = FailureRecord(timeout=2, planner_fallback=1, total_queries=10)
        merged = merge_records([r1, r2])
        assert merged.empty_retrieval == 1
        assert merged.timeout == 2
        assert merged.planner_fallback == 1
        assert merged.generation_failure == 0
        assert merged.total_queries == 20

    def test_empty_list(self) -> None:
        merged = merge_records([])
        assert merged.empty_retrieval == 0
        assert merged.total_queries == 0

    def test_three_records(self) -> None:
        records = [
            FailureRecord(empty_retrieval=1, total_queries=5),
            FailureRecord(timeout=2, total_queries=5),
            FailureRecord(generation_failure=1, total_queries=10),
        ]
        merged = merge_records(records)
        assert merged.empty_retrieval == 1
        assert merged.timeout == 2
        assert merged.generation_failure == 1
        assert merged.total_queries == 20

    def test_returns_frozen_record(self) -> None:
        r1 = FailureRecord(empty_retrieval=1, total_queries=5)
        r2 = FailureRecord(timeout=1, total_queries=5)
        merged = merge_records([r1, r2])
        with pytest.raises(AttributeError):
            merged.empty_retrieval = 99  # type: ignore[misc]

    def test_preserves_type(self) -> None:
        merged = merge_records([])
        assert isinstance(merged, FailureRecord)

    def test_zero_records_preserves_zeros(self) -> None:
        r = FailureRecord()
        records = [r, r, r]
        merged = merge_records(records)
        assert merged.total_queries == 0
        assert merged.empty_retrieval == 0
