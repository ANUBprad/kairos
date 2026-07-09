"""Unit tests for confidence-aware strategy selection.

Covers:
- Backward compatibility: old call signature returns static config.
- High confidence (>= 0.8) returns static config unchanged.
- Medium and low confidence apply budget overrides.
- All nine (query_type × confidence_band) combinations.
- `retrieval_type` is never overridden by the budget.
- Domain-specific logic (simple + domain → HYBRID) is preserved.
"""

from __future__ import annotations

import pytest

from intelligence.classifier.strategy_selector import get_config
from intelligence.classifier.query_classifier import ResponseSchema
from intelligence.planner import RetrievalBudget


# ======================================================================
# Static config helpers
# ======================================================================


def _static_simple(domain: str | None = None) -> dict:
    return {
        "retrieval_type": "HYBRID" if domain else "RETRIEVAL_TYPE_UNSPECIFIED",
        "top_k": 3,
        "rerank": False,
        "decompose": False,
    }


def _static_complex() -> dict:
    return {
        "retrieval_type": "MULTI_VECTOR",
        "top_k": 8,
        "rerank": True,
        "decompose": False,
    }


def _static_multihop() -> dict:
    return {
        "retrieval_type": "SELF_QUERYING",
        "top_k": 3,
        "rerank": False,
        "decompose": True,
    }


# ======================================================================
# Backward compatibility
# ======================================================================


class TestBackwardCompatibility:
    """Callers that do not pass confidence should get static behaviour."""

    @pytest.mark.parametrize(
        ("details", "expected"),
        [
            (ResponseSchema(query_type="simple", domain=None), _static_simple()),
            (ResponseSchema(query_type="simple", domain="law"), _static_simple("law")),
            (ResponseSchema(query_type="complex", domain=None), _static_complex()),
            (ResponseSchema(query_type="multi_hop", domain=None), _static_multihop()),
        ],
    )
    def test_legacy_call_returns_static_config(
        self, details: ResponseSchema, expected: dict
    ) -> None:
        assert get_config(query_details=details) == expected


# ======================================================================
# High confidence (≥ 0.8)
# ======================================================================


class TestHighConfidence:
    """Confidence >= 0.8 must return the static config unchanged."""

    @pytest.mark.parametrize(
        ("details", "confidence", "expected"),
        [
            (ResponseSchema(query_type="simple", domain=None), 0.8, _static_simple()),
            (ResponseSchema(query_type="simple", domain=None), 0.95, _static_simple()),
            (
                ResponseSchema(query_type="simple", domain="hr"),
                1.0,
                _static_simple("hr"),
            ),
            (
                ResponseSchema(query_type="complex", domain=None),
                0.80,
                _static_complex(),
            ),
            (
                ResponseSchema(query_type="complex", domain=None),
                0.99,
                _static_complex(),
            ),
            (
                ResponseSchema(query_type="multi_hop", domain=None),
                0.85,
                _static_multihop(),
            ),
            (
                ResponseSchema(query_type="multi_hop", domain=None),
                0.80,
                _static_multihop(),
            ),
        ],
    )
    def test_static_config_returned(
        self, details: ResponseSchema, confidence: float, expected: dict
    ) -> None:
        assert get_config(details, confidence) == expected


# ======================================================================
# Budget overrides (confidence < 0.8)
# ======================================================================


class TestBudgetOverridesSimple:
    """SIMPLE queries with confidence < 0.8 use budget overrides."""

    def test_medium_confidence(self) -> None:
        cfg = get_config(ResponseSchema(query_type="simple", domain=None), 0.60)
        # retrieval_type is static; top_k, rerank come from budget
        assert cfg["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"
        assert cfg["top_k"] == 5
        assert cfg["rerank"] is True
        assert cfg["decompose"] is False

    def test_low_confidence(self) -> None:
        cfg = get_config(ResponseSchema(query_type="simple", domain=None), 0.30)
        assert cfg["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"
        assert cfg["top_k"] == 8
        assert cfg["rerank"] is True
        assert cfg["decompose"] is False

    def test_medium_confidence_with_domain(self) -> None:
        """Domain-based HYBRID selection must survive budget override."""
        cfg = get_config(ResponseSchema(query_type="simple", domain="law"), 0.60)
        assert cfg["retrieval_type"] == "HYBRID"  # preserved from static
        assert cfg["top_k"] == 5


class TestBudgetOverridesComplex:
    """COMPLEX queries with confidence < 0.8 use budget overrides."""

    def test_medium_confidence(self) -> None:
        cfg = get_config(ResponseSchema(query_type="complex", domain=None), 0.55)
        assert cfg["retrieval_type"] == "MULTI_VECTOR"
        assert cfg["top_k"] == 10
        assert cfg["rerank"] is True
        assert cfg["decompose"] is False

    def test_low_confidence(self) -> None:
        cfg = get_config(ResponseSchema(query_type="complex", domain=None), 0.20)
        assert cfg["retrieval_type"] == "MULTI_VECTOR"
        assert cfg["top_k"] == 12
        assert cfg["rerank"] is True
        assert cfg["decompose"] is True


class TestBudgetOverridesMultiHop:
    """MULTI_HOP queries with confidence < 0.8 use budget overrides."""

    def test_medium_confidence(self) -> None:
        cfg = get_config(ResponseSchema(query_type="multi_hop", domain=None), 0.72)
        assert cfg["retrieval_type"] == "SELF_QUERYING"
        assert cfg["top_k"] == 5
        assert cfg["rerank"] is True
        assert cfg["decompose"] is True

    def test_low_confidence(self) -> None:
        cfg = get_config(ResponseSchema(query_type="multi_hop", domain=None), 0.10)
        assert cfg["retrieval_type"] == "SELF_QUERYING"
        assert cfg["top_k"] == 8
        assert cfg["rerank"] is True
        assert cfg["decompose"] is True


# ======================================================================
# Retrieval_type invariance
# ======================================================================


class TestRetrievalTypeInvariant:
    """The retrieval_type must never be altered by budget overrides."""

    def test_no_override_for_simple(self) -> None:
        cfg = get_config(ResponseSchema(query_type="simple", domain=None), 0.10)
        assert cfg["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"

    def test_no_override_for_complex(self) -> None:
        cfg = get_config(ResponseSchema(query_type="complex", domain=None), 0.10)
        assert cfg["retrieval_type"] == "MULTI_VECTOR"

    def test_no_override_for_multihop(self) -> None:
        cfg = get_config(ResponseSchema(query_type="multi_hop", domain=None), 0.10)
        assert cfg["retrieval_type"] == "SELF_QUERYING"

    def test_no_override_for_simple_with_domain(self) -> None:
        cfg = get_config(ResponseSchema(query_type="simple", domain="tech"), 0.10)
        assert cfg["retrieval_type"] == "HYBRID"


# ======================================================================
# Explicit budget parameter
# ======================================================================


class TestExplicitBudget:
    """Callers may pass a pre-computed budget directly."""

    def test_explicit_budget_overrides_static(self) -> None:
        details = ResponseSchema(query_type="simple", domain=None)
        custom_budget = RetrievalBudget(top_k=42, rerank=True, decompose=True)
        cfg = get_config(details, confidence=0.70, budget=custom_budget)

        assert cfg["top_k"] == 42
        assert cfg["rerank"] is True
        assert cfg["decompose"] is True
        assert cfg["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"

    def test_explicit_budget_with_high_confidence(self) -> None:
        """Even at high confidence, an explicit budget is honoured."""
        details = ResponseSchema(query_type="simple", domain=None)
        custom_budget = RetrievalBudget(top_k=99, rerank=False, decompose=False)
        cfg = get_config(details, confidence=0.99, budget=custom_budget)

        assert (
            cfg["top_k"] == 99
        )  # explicit budget is honoured at all confidence levels


# ======================================================================
# Edge cases
# ======================================================================


class TestEdgeCases:
    """Boundary confidence values and unknown types."""

    def test_confidence_just_below_high(self) -> None:
        """0.79 < 0.8 → budget overrides should apply."""
        cfg = get_config(ResponseSchema(query_type="simple", domain=None), 0.79)
        assert cfg["top_k"] == 5  # medium budget, not static 3

    def test_unknown_query_type_defaults(self) -> None:
        """An unrecognised query_type falls through to the else branch."""
        details = ResponseSchema(query_type="simple", domain=None)  # type: ignore[arg-type]
        details.query_type = "unknown"  # type: ignore[assignment]
        cfg = get_config(details)

        assert cfg["retrieval_type"] == "RETRIEVAL_TYPE_UNSPECIFIED"
        assert cfg["top_k"] == 3
        assert cfg["rerank"] is False
        assert cfg["decompose"] is False

    def test_unknown_query_type_with_low_confidence(self) -> None:
        """Budget override still applies, but query_type conversion fails."""
        details = ResponseSchema(query_type="simple", domain=None)
        details.query_type = "unknown"  # type: ignore[assignment]

        # QueryType("unknown") raises ValueError → propagate
        with pytest.raises(ValueError):
            get_config(details, confidence=0.30)
