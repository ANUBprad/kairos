"""Unit tests for FallbackManager — pure decision layer.

Covers:
- Sufficient chunks — should_fallback=False
- Insufficient chunks — escalated_tier is set correctly
- Multi-hop at max tier — no escalation possible
- All four retrieval_type values map to correct escalation targets
- Edge cases: missing top_k, zero chunks, exact threshold
- Return type is FallbackDecision
"""

from __future__ import annotations

import pytest

from intelligence.planner import FallbackManager, FallbackDecision


# ======================================================================
# Sufficient chunks — no fallback
# ======================================================================


class TestNoFallback:
    """When chunk_count >= threshold the decision is to not fall back."""

    @staticmethod
    def _evaluate(
        chunk_count: int, top_k: int = 4, retrieval_type: str = "HYBRID"
    ) -> FallbackDecision:
        return FallbackManager.evaluate(
            config={"retrieval_type": retrieval_type, "top_k": top_k},
            chunk_count=chunk_count,
        )

    def test_exactly_at_threshold(self) -> None:
        """top_k=4, threshold=2, chunks=2 — exactly at threshold."""
        fb = self._evaluate(chunk_count=2)
        assert fb.should_fallback is False
        assert fb.reason == "sufficient"

    def test_above_threshold(self) -> None:
        """top_k=3, threshold=1, chunks=3 — well above."""
        fb = self._evaluate(chunk_count=3, top_k=3)
        assert fb.should_fallback is False

    def test_minimum_top_k(self) -> None:
        """top_k=1, threshold=1, chunks=1 — at threshold."""
        fb = self._evaluate(chunk_count=1, top_k=1)
        assert fb.should_fallback is False

    def test_escalated_tier_is_none_when_sufficient(self) -> None:
        fb = self._evaluate(chunk_count=5)
        assert fb.escalated_tier is None


# ======================================================================
# Fallback triggered
# ======================================================================


class TestFallbackEscalation:
    """When chunk_count < threshold the decision must include the target tier."""

    @staticmethod
    def _evaluate(
        chunk_count: int,
        top_k: int = 6,
        retrieval_type: str = "HYBRID",
    ) -> FallbackDecision:
        return FallbackManager.evaluate(
            config={"retrieval_type": retrieval_type, "top_k": top_k},
            chunk_count=chunk_count,
        )

    def test_simple_escalates_to_complex(self) -> None:
        fb = self._evaluate(chunk_count=1)
        assert fb.should_fallback is True
        assert fb.escalated_tier == "complex"
        assert fb.reason == "insufficient_chunks"

    def test_complex_escalates_to_multihop(self) -> None:
        fb = self._evaluate(chunk_count=1, retrieval_type="MULTI_VECTOR")
        assert fb.should_fallback is True
        assert fb.escalated_tier == "multi_hop"

    def test_multihop_at_max_tier(self) -> None:
        """Multi-hop has no higher tier — escalated_tier is None."""
        fb = self._evaluate(chunk_count=1, retrieval_type="SELF_QUERYING")
        assert fb.should_fallback is True
        assert fb.escalated_tier is None
        assert fb.reason == "at_max_tier"

    def test_zero_chunks_triggers_fallback(self) -> None:
        fb = self._evaluate(chunk_count=0)
        assert fb.should_fallback is True
        assert fb.escalated_tier == "complex"


# ======================================================================
# Retrieval type → tier mapping
# ======================================================================


class TestRetrievalTypeMapping:
    """All four retrieval_type values escalate to the correct tier."""

    @pytest.mark.parametrize(
        ("retrieval_type", "expected_tier", "expected_reason"),
        [
            ("RETRIEVAL_TYPE_UNSPECIFIED", "complex", "insufficient_chunks"),
            ("HYBRID", "complex", "insufficient_chunks"),
            ("MULTI_VECTOR", "multi_hop", "insufficient_chunks"),
            ("SELF_QUERYING", None, "at_max_tier"),
        ],
    )
    def test_escalation_target(
        self,
        retrieval_type: str,
        expected_tier: str | None,
        expected_reason: str,
    ) -> None:
        fb = FallbackManager.evaluate(
            config={"retrieval_type": retrieval_type, "top_k": 6},
            chunk_count=1,
        )
        assert fb.should_fallback is True
        assert fb.escalated_tier == expected_tier
        assert fb.reason == expected_reason

    def test_unknown_retrieval_type_defaults_to_simple(self) -> None:
        """An unrecognised retrieval_type is treated as 'simple' → escalates to 'complex'."""
        fb = FallbackManager.evaluate(
            config={"retrieval_type": "BOGUS", "top_k": 6},
            chunk_count=1,
        )
        assert fb.should_fallback is True
        assert fb.escalated_tier == "complex"


# ======================================================================
# Edge cases
# ======================================================================


class TestEdgeCases:
    """Boundary conditions and missing fields."""

    def test_missing_top_k_defaults_to_1(self) -> None:
        """When top_k is missing, threshold = max(1, int(1 * 0.5)) = 1."""
        fb = FallbackManager.evaluate(
            config={"retrieval_type": "HYBRID"},
            chunk_count=1,
        )
        assert fb.should_fallback is False

    def test_missing_top_k_with_zero_chunks(self) -> None:
        fb = FallbackManager.evaluate(
            config={"retrieval_type": "HYBRID"},
            chunk_count=0,
        )
        assert fb.should_fallback is True

    def test_missing_retrieval_type_defaults_hybrid(self) -> None:
        fb = FallbackManager.evaluate(
            config={"top_k": 6},
            chunk_count=1,
        )
        # "HYBRID" is not in the config, so _resolve_tier gets None → defaults to "simple"
        # But wait: config.get("retrieval_type", "HYBRID") — so it gets "HYBRID"
        # _resolve_tier("HYBRID") → "simple"
        # STRATEGY_ESCALATION_MAP[simple] → complex
        assert fb.escalated_tier == "complex"

    def test_return_type(self) -> None:
        fb = FallbackManager.evaluate(
            config={"retrieval_type": "HYBRID", "top_k": 4},
            chunk_count=3,
        )
        assert isinstance(fb, FallbackDecision)

    def test_confidence_param_accepted(self) -> None:
        """The confidence parameter is accepted (reserved for future use)."""
        fb = FallbackManager.evaluate(
            config={"retrieval_type": "HYBRID", "top_k": 4},
            chunk_count=3,
            confidence=0.95,
        )
        assert fb.should_fallback is False


# ======================================================================
# Decision immutability
# ======================================================================


class TestDecisionImmutability:
    """FallbackDecision is a frozen dataclass."""

    def test_cannot_mutate(self) -> None:
        fb = FallbackManager.evaluate(
            config={"retrieval_type": "HYBRID", "top_k": 4},
            chunk_count=3,
        )
        with pytest.raises(AttributeError):
            fb.should_fallback = True  # type: ignore[misc]
