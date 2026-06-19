"""Fallback manager — pure evaluation of retrieval outcomes.

The fallback manager is a **decision layer only**.  It evaluates whether a
retrieval result contains enough chunks to proceed and, when it does not,
determines which strategy tier to escalate to.  It **never calls retrievers**.

The caller is responsible for acting on the :class:`FallbackDecision`:
executing the escalated retriever, re-attempting, etc.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional

from .planner_config import FALLBACK_THRESHOLD_FACTOR, STRATEGY_ESCALATION_MAP, QueryType

# ---------------------------------------------------------------------------
# Return type
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class FallbackDecision:
    """What the caller should do after evaluating retrieval quality.

    Attributes:
        should_fallback: Whether to re-retrieve with an escalated strategy.
        escalated_tier:  The tier name to escalate to, or ``None`` when
                         no escalation is possible (already at max tier)
                         or when no fallback is needed.
        reason:          Human-readable explanation of the decision.
    """

    should_fallback: bool
    escalated_tier: Optional[str] = None
    reason: str = "sufficient"


# ---------------------------------------------------------------------------
# Internal lookup
# ---------------------------------------------------------------------------

_RETRIEVAL_TYPE_TO_TIER: Dict[str, str] = {
    "RETRIEVAL_TYPE_UNSPECIFIED": "simple",
    "HYBRID": "simple",
    "MULTI_VECTOR": "complex",
    "SELF_QUERYING": "multi_hop",
}


# ---------------------------------------------------------------------------
# FallbackManager
# ---------------------------------------------------------------------------


class FallbackManager:
    """Pure evaluation of retrieval outcomes.

    Stateless — a single instance can be reused across many queries.
    """

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @staticmethod
    def evaluate(
        config: dict,
        chunk_count: int,
        confidence: float = 0.0,
    ) -> FallbackDecision:
        """Decide whether a fallback is needed based on retrieval quality.

        The evaluation compares *chunk_count* against a threshold derived
        from ``config["top_k"]`` and :data:`FALLBACK_THRESHOLD_FACTOR`.

        When the count is below threshold the strategy tier is escalated
        via :data:`STRATEGY_ESCALATION_MAP`.  If already at the highest
        tier the decision indicates that no escalation is possible.

        Args:
            config:      The retrieval config dict that was used
                         (must contain ``"retrieval_type"`` and
                         ``"top_k"``).
            chunk_count: Number of chunks returned by the initial
                         retrieval.
            confidence:  Classifier confidence (reserved for future
                         calibrated thresholds).

        Returns:
            A :class:`FallbackDecision` with the recommended action.

        Examples:
            # Sufficient chunks — no fallback
            >>> fb = FallbackManager.evaluate(
            ...     {"retrieval_type": "HYBRID", "top_k": 4}, 5)
            >>> fb.should_fallback
            False
            >>> fb.reason
            'sufficient'

            # Insufficient chunks — escalate to complex
            >>> fb = FallbackManager.evaluate(
            ...     {"retrieval_type": "HYBRID", "top_k": 6}, 1)
            >>> fb.should_fallback
            True
            >>> fb.escalated_tier
            'complex'
            >>> fb.reason
            'insufficient_chunks'

            # At max tier — cannot escalate further
            >>> fb = FallbackManager.evaluate(
            ...     {"retrieval_type": "SELF_QUERYING", "top_k": 5}, 1)
            >>> fb.should_fallback
            True
            >>> fb.escalated_tier is None
            True
            >>> fb.reason
            'at_max_tier'
        """
        top_k = config.get("top_k", 1)
        threshold = max(1, int(top_k * FALLBACK_THRESHOLD_FACTOR))

        if chunk_count >= threshold:
            return FallbackDecision(
                should_fallback=False,
                escalated_tier=None,
                reason="sufficient",
            )

        current_tier = _resolve_tier(config.get("retrieval_type", "HYBRID"))
        escalated_tier = STRATEGY_ESCALATION_MAP[QueryType(current_tier)]

        if escalated_tier.value == current_tier:
            return FallbackDecision(
                should_fallback=True,
                escalated_tier=None,
                reason="at_max_tier",
            )

        return FallbackDecision(
            should_fallback=True,
            escalated_tier=escalated_tier.value,
            reason="insufficient_chunks",
        )


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _resolve_tier(retrieval_type: str) -> str:
    """Convert a config ``retrieval_type`` string to a tier name."""
    return _RETRIEVAL_TYPE_TO_TIER.get(retrieval_type, "simple")
