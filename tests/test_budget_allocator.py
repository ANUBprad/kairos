"""Unit tests for budget allocation logic.

Covers:
- Band resolution at every threshold boundary.
- All nine (query_type × confidence_band) budget combinations.
- Edge cases (out-of-range, frozen dataclass, unknown type).
- Doctest verification.
"""

from __future__ import annotations

import pytest

from intelligence.planner import (
    allocate_budget,
    resolve_confidence_band,
    BUDGET_TABLE,
    ConfidenceBand,
    QueryType,
    RetrievalBudget,
)


# ======================================================================
# resolve_confidence_band
# ======================================================================


class TestResolveConfidenceBand:
    """Continuous → discrete band mapping."""

    def test_high_at_upper_bound(self) -> None:
        assert resolve_confidence_band(1.0) is ConfidenceBand.HIGH

    def test_high_at_threshold(self) -> None:
        assert resolve_confidence_band(0.8) is ConfidenceBand.HIGH

    def test_high_typical(self) -> None:
        assert resolve_confidence_band(0.95) is ConfidenceBand.HIGH

    def test_medium_just_below_high(self) -> None:
        assert resolve_confidence_band(0.79) is ConfidenceBand.MEDIUM

    def test_medium_at_threshold(self) -> None:
        assert resolve_confidence_band(0.5) is ConfidenceBand.MEDIUM

    def test_medium_typical(self) -> None:
        assert resolve_confidence_band(0.65) is ConfidenceBand.MEDIUM

    def test_low_just_below_medium(self) -> None:
        assert resolve_confidence_band(0.49) is ConfidenceBand.LOW

    def test_low_at_lower_bound(self) -> None:
        assert resolve_confidence_band(0.0) is ConfidenceBand.LOW

    def test_low_typical(self) -> None:
        assert resolve_confidence_band(0.1) is ConfidenceBand.LOW

    def test_out_of_range_above(self) -> None:
        with pytest.raises(ValueError, match="must be in"):
            resolve_confidence_band(1.5)

    def test_out_of_range_below(self) -> None:
        with pytest.raises(ValueError, match="must be in"):
            resolve_confidence_band(-0.01)


# ======================================================================
# allocate_budget
# ======================================================================


class TestAllocateBudgetSimple:
    """SIMPLE query type — all three confidence bands."""

    def test_high_confidence(self) -> None:
        budget = allocate_budget(QueryType.SIMPLE, 0.92)
        assert budget == RetrievalBudget(top_k=3, rerank=False, decompose=False)

    def test_medium_confidence(self) -> None:
        budget = allocate_budget(QueryType.SIMPLE, 0.60)
        assert budget == RetrievalBudget(top_k=5, rerank=True, decompose=False)

    def test_low_confidence(self) -> None:
        budget = allocate_budget(QueryType.SIMPLE, 0.30)
        assert budget == RetrievalBudget(top_k=8, rerank=True, decompose=False)


class TestAllocateBudgetComplex:
    """COMPLEX query type — all three confidence bands."""

    def test_high_confidence(self) -> None:
        budget = allocate_budget(QueryType.COMPLEX, 0.85)
        assert budget == RetrievalBudget(top_k=8, rerank=True, decompose=False)

    def test_medium_confidence(self) -> None:
        budget = allocate_budget(QueryType.COMPLEX, 0.55)
        assert budget == RetrievalBudget(top_k=10, rerank=True, decompose=False)

    def test_low_confidence(self) -> None:
        budget = allocate_budget(QueryType.COMPLEX, 0.20)
        assert budget == RetrievalBudget(top_k=12, rerank=True, decompose=True)


class TestAllocateBudgetMultiHop:
    """MULTI_HOP query type — all three confidence bands."""

    def test_high_confidence(self) -> None:
        budget = allocate_budget(QueryType.MULTI_HOP, 0.90)
        assert budget == RetrievalBudget(top_k=3, rerank=False, decompose=True)

    def test_medium_confidence(self) -> None:
        budget = allocate_budget(QueryType.MULTI_HOP, 0.72)
        assert budget == RetrievalBudget(top_k=5, rerank=True, decompose=True)

    def test_low_confidence(self) -> None:
        budget = allocate_budget(QueryType.MULTI_HOP, 0.10)
        assert budget == RetrievalBudget(top_k=8, rerank=True, decompose=True)


# ======================================================================
# Edge cases
# ======================================================================


class TestAllocateBudgetEdgeCases:
    """Boundary values, invariants, and error paths."""

    def test_boundary_high_medium(self) -> None:
        """At exactly 0.8 the band should be HIGH, giving the high budget."""
        budget = allocate_budget(QueryType.SIMPLE, 0.8)
        assert budget.top_k == 3

    def test_boundary_medium_low(self) -> None:
        """At exactly 0.5 the band should be MEDIUM, giving the medium budget."""
        budget = allocate_budget(QueryType.SIMPLE, 0.5)
        assert budget.top_k == 5

    def test_confidence_out_of_range(self) -> None:
        with pytest.raises(ValueError, match="must be in"):
            allocate_budget(QueryType.SIMPLE, -0.1)

    def test_returns_frozen_instance(self) -> None:
        """RetrievalBudget is frozen — mutation should raise."""
        budget = allocate_budget(QueryType.SIMPLE, 0.9)
        with pytest.raises(AttributeError):
            budget.top_k = 99  # type: ignore[misc]

    def test_returns_budget_instance(self) -> None:
        budget = allocate_budget(QueryType.SIMPLE, 0.9)
        assert isinstance(budget, RetrievalBudget)

    def test_all_table_entries_have_valid_top_k(self) -> None:
        """Every entry in the budget table has a positive top_k."""
        for query_type, band_map in BUDGET_TABLE.items():
            for band, budget in band_map.items():
                assert budget.top_k >= 1, (
                    f"{query_type.value}.{band.value} has top_k={budget.top_k}"
                )

    def test_all_table_entries_are_frozen(self) -> None:
        """Every entry in the budget table is a frozen dataclass."""
        for query_type, band_map in BUDGET_TABLE.items():
            for band, budget in band_map.items():
                assert isinstance(budget, RetrievalBudget)


# ======================================================================
# Doctest integration
# ======================================================================


def test_doctests_pass() -> None:
    """Run the doctests embedded in planner modules."""
    import doctest

    for module_name in (
        "intelligence.planner.budget_allocator",
        "intelligence.planner.planner_config",
    ):
        import importlib

        module = importlib.import_module(module_name)
        results = doctest.testmod(module, verbose=False)
        assert results.failed == 0, (
            f"{module_name} has {results.failed} failing doctest(s)"
        )
