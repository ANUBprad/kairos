"""Unit tests for benchmarks.metrics.precision."""

from __future__ import annotations

import pytest

from benchmarks.metrics import precision_at_k


class TestPrecisionAtK:
    """Precision@k metric."""

    def test_all_retrieved_relevant(self) -> None:
        relevant = {"a", "b", "c"}
        retrieved = ["a", "b", "c"]
        assert precision_at_k(relevant, retrieved) == 1.0

    def test_partial_precision(self) -> None:
        relevant = {"a", "b"}
        retrieved = ["a", "x", "y"]
        assert precision_at_k(relevant, retrieved) == pytest.approx(1 / 3)

    def test_none_retrieved_relevant(self) -> None:
        relevant = {"z"}
        retrieved = ["a", "b", "c"]
        assert precision_at_k(relevant, retrieved) == 0.0

    def test_at_k(self) -> None:
        relevant = {"a", "b"}
        retrieved = ["a", "x", "b", "y"]
        assert precision_at_k(relevant, retrieved, k=3) == pytest.approx(2 / 3)

    def test_k_larger_than_retrieved(self) -> None:
        relevant = {"a"}
        retrieved = ["a"]
        assert precision_at_k(relevant, retrieved, k=10) == pytest.approx(0.1)

    def test_k_is_zero(self) -> None:
        assert precision_at_k({"a"}, ["a"], k=0) == 0.0

    def test_empty_retrieved(self) -> None:
        assert precision_at_k({"a"}, []) == 0.0

    def test_empty_relevant(self) -> None:
        """With no relevant chunks defined, no retrieved item can match."""
        retrieved = ["a", "b"]
        assert precision_at_k(set(), retrieved) == 0.0

    def test_both_empty(self) -> None:
        assert precision_at_k(set(), []) == 0.0

    def test_precision_higher_than_recall(self) -> None:
        """Precision can be 1.0 while recall is low — different semantics."""
        relevant = {"a", "b", "c", "d", "e"}
        retrieved = ["a"]
        assert precision_at_k(relevant, retrieved) == 1.0

    def test_retrieved_order_matters_at_k(self) -> None:
        relevant = {"c"}
        retrieved = ["a", "b", "c", "d"]
        assert precision_at_k(relevant, retrieved, k=1) == 0.0
        assert precision_at_k(relevant, retrieved, k=2) == 0.0
        assert precision_at_k(relevant, retrieved, k=3) == pytest.approx(1 / 3)
        assert precision_at_k(relevant, retrieved) == pytest.approx(0.25)


class TestPrecisionEdgeCases:
    """Edge-case arguments."""

    def test_k_none_defaults_to_len_retrieved(self) -> None:
        relevant = {"a"}
        retrieved = ["a"]
        assert precision_at_k(relevant, retrieved) == precision_at_k(
            relevant, retrieved, k=1
        )

    def test_returns_float(self) -> None:
        result = precision_at_k({"a"}, ["a"])
        assert isinstance(result, float)

    def test_duplicates_count_separately(self) -> None:
        """Each position is evaluated independently for precision."""
        relevant = {"a"}
        retrieved = ["a", "a", "a"]
        assert precision_at_k(relevant, retrieved) == 1.0
