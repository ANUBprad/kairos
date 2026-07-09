"""Retrieval planner configuration — thresholds, budget tables, and fallback constants.

This module is the single source of truth for all tunable parameters
used by the retrieval planner, budget allocator, and fallback manager.
All magic numbers live here so they can be adjusted without touching logic.
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Final

# ---------------------------------------------------------------------------
# Core data types
# ---------------------------------------------------------------------------


class QueryType(str, Enum):
    """The three retrieval tiers supported by Kairos."""

    SIMPLE = "simple"
    COMPLEX = "complex"
    MULTI_HOP = "multi_hop"


class ConfidenceBand(str, Enum):
    """Discrete bands that a continuous confidence score maps into."""

    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass(frozen=True)
class RetrievalBudget:
    """Immutable retrieval parameters for a single query.

    Attributes:
        top_k:    Maximum number of document chunks to retrieve.
        rerank:   Whether to apply cross-encoder reranking to results.
        decompose: Whether to decompose the query into sub-queries.
    """

    top_k: int
    rerank: bool
    decompose: bool

    def __post_init__(self) -> None:
        """Validate budget invariants."""
        if self.top_k < 1:
            raise ValueError(f"top_k must be >= 1, got {self.top_k}")


# ---------------------------------------------------------------------------
# Confidence thresholds
# ---------------------------------------------------------------------------

CONFIDENCE_HIGH: Final[float] = 0.8
"""Minimum confidence to be considered high-confidence."""

CONFIDENCE_MEDIUM: Final[float] = 0.5
"""Minimum confidence to be considered medium-confidence."""

# ---------------------------------------------------------------------------
# Budget table — query_type × confidence_band → RetrievalBudget
# ---------------------------------------------------------------------------

BUDGET_TABLE: Final[Dict[QueryType, Dict[ConfidenceBand, RetrievalBudget]]] = {
    QueryType.SIMPLE: {
        ConfidenceBand.HIGH: RetrievalBudget(top_k=3, rerank=False, decompose=False),
        ConfidenceBand.MEDIUM: RetrievalBudget(top_k=5, rerank=True, decompose=False),
        ConfidenceBand.LOW: RetrievalBudget(top_k=8, rerank=True, decompose=False),
    },
    QueryType.COMPLEX: {
        ConfidenceBand.HIGH: RetrievalBudget(top_k=8, rerank=True, decompose=False),
        ConfidenceBand.MEDIUM: RetrievalBudget(top_k=10, rerank=True, decompose=False),
        ConfidenceBand.LOW: RetrievalBudget(top_k=12, rerank=True, decompose=True),
    },
    QueryType.MULTI_HOP: {
        ConfidenceBand.HIGH: RetrievalBudget(top_k=3, rerank=False, decompose=True),
        ConfidenceBand.MEDIUM: RetrievalBudget(top_k=5, rerank=True, decompose=True),
        ConfidenceBand.LOW: RetrievalBudget(top_k=8, rerank=True, decompose=True),
    },
}

# ---------------------------------------------------------------------------
# Fallback constants
# ---------------------------------------------------------------------------

FALLBACK_THRESHOLD_FACTOR: Final[float] = 0.5
"""If retrieved chunk count < top_k * this factor, trigger fallback."""

STRATEGY_ESCALATION_MAP: Final[Dict[QueryType, QueryType]] = {
    QueryType.SIMPLE: QueryType.COMPLEX,
    QueryType.COMPLEX: QueryType.MULTI_HOP,
    QueryType.MULTI_HOP: QueryType.MULTI_HOP,
}
"""When a fallback is triggered, escalate to the next tier.

``multi_hop → multi_hop`` means there is no higher tier to escalate to.
"""
