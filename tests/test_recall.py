"""Unit tests for benchmarks.metrics.recall."""

from __future__ import annotations

import pytest

from benchmarks.metrics import recall_at_k


class TestRecallAtK:
    """Recall@k metric."""

    def test_all_relevant_retrieved(self) -> None:
        relevant = {"a", "b", "c"}
        retrieved = ["a", "b", "c", "d"]
        assert recall_at_k(relevant, retrieved) == 1.0

    def test_partial_relevant(self) -> None:
        relevant = {"a", "b", "c"}
        retrieved = ["a", "d", "e"]
        assert recall_at_k(relevant, retrieved) == pytest.approx(1 / 3)

    def test_none_relevant_retrieved(self) -> None:
        relevant = {"x", "y", "z"}
        retrieved = ["a", "b", "c"]
        assert recall_at_k(relevant, retrieved) == 0.0

    def test_at_k(self) -> None:
        relevant = {"a", "b", "c"}
        retrieved = ["a", "b", "x", "y", "c"]
        assert recall_at_k(relevant, retrieved, k=2) == pytest.approx(2 / 3)

    def test_k_larger_than_retrieved(self) -> None:
        relevant = {"a", "b"}
        retrieved = ["a"]
        assert recall_at_k(relevant, retrieved, k=10) == pytest.approx(0.5)

    def test_k_is_zero(self) -> None:
        relevant = {"a", "b"}
        retrieved = ["a", "b"]
        assert recall_at_k(relevant, retrieved, k=0) == 0.0

    def test_empty_relevant(self) -> None:
        assert recall_at_k(set(), ["a", "b"]) == 0.0

    def test_empty_retrieved(self) -> None:
        relevant = {"a", "b"}
        assert recall_at_k(relevant, []) == 0.0

    def test_both_empty(self) -> None:
        assert recall_at_k(set(), []) == 0.0

    def test_duplicates_in_retrieved(self) -> None:
        """Duplicates don't inflate recall — a chunk is relevant or not."""
        relevant = {"a"}
        retrieved = ["a", "a", "a"]
        assert recall_at_k(relevant, retrieved) == 1.0

    def test_retrieved_order_matters_at_k(self) -> None:
        relevant = {"a", "b"}
        retrieved = ["x", "a", "b"]
        assert recall_at_k(relevant, retrieved, k=1) == 0.0
        assert recall_at_k(relevant, retrieved, k=2) == 0.5
        assert recall_at_k(relevant, retrieved, k=3) == 1.0


class TestRecallEdgeCases:
    """Edge-case arguments."""

    def test_k_none_uses_all(self) -> None:
        """k=None is equivalent to k=len(retrieved)."""
        relevant = {"a", "b", "c"}
        retrieved = ["a", "x", "y"]
        assert recall_at_k(relevant, retrieved) == recall_at_k(
            relevant, retrieved, k=3
        )

    def test_returns_float(self) -> None:
        result = recall_at_k({"a"}, ["a"])
        assert isinstance(result, float)
