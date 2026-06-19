"""Kairos Retrieval Planner — confidence-aware retrieval planning.

The planner module is a **pure decision layer**.  It determines the optimal
retrieval strategy, budget, and fallback behaviour for each query based on
its classified type and the classifier's confidence score — but it **never
calls retrievers**.  Actual I/O is the caller's responsibility.

Public API
----------
Constants
    CONFIDENCE_HIGH, CONFIDENCE_MEDIUM
        Thresholds that map a continuous confidence score to a discrete band.
    FALLBACK_THRESHOLD_FACTOR
        Minimum retrieved-chunk ratio before fallback is triggered.
    STRATEGY_ESCALATION_MAP
        How to escalate the retrieval tier during a fallback.
    BUDGET_TABLE
        Pre-configured retrieval budgets per (query_type, band) pair.

Types
    ConfidenceBand
        Enum: ``HIGH``, ``MEDIUM``, ``LOW``.
    QueryType
        Enum: ``SIMPLE``, ``COMPLEX``, ``MULTI_HOP``.
    RetrievalBudget
        Frozen dataclass with ``top_k``, ``rerank``, ``decompose`` fields.
    FallbackDecision
        Frozen dataclass: whether to fall back, which tier to use, why.
    PlannerDecision
        Frozen dataclass: config, confidence, query_type, optional
        fallback_decision.

Functions
    resolve_confidence_band(confidence) → ConfidenceBand
        Map a float to a discrete band.
    allocate_budget(query_type, confidence) → RetrievalBudget
        Look up the budget for a (query_type, band) pair.

Classes
    FallbackManager (stateless)
        Evaluate retrieval quality and produce a FallbackDecision.
    RetrievalPlanner
        Wire classifier → budget → strategy selector into a
        PlannerDecision.
"""

from .planner_config import (
    BUDGET_TABLE,
    CONFIDENCE_HIGH,
    CONFIDENCE_MEDIUM,
    FALLBACK_THRESHOLD_FACTOR,
    STRATEGY_ESCALATION_MAP,
    ConfidenceBand,
    QueryType,
    RetrievalBudget,
)
from .budget_allocator import resolve_confidence_band, allocate_budget
from .fallback_manager import FallbackManager, FallbackDecision
from .retrieval_planner import RetrievalPlanner, PlannerDecision

__all__ = [
    # Constants
    "CONFIDENCE_HIGH",
    "CONFIDENCE_MEDIUM",
    "FALLBACK_THRESHOLD_FACTOR",
    "STRATEGY_ESCALATION_MAP",
    "BUDGET_TABLE",
    # Types
    "ConfidenceBand",
    "QueryType",
    "RetrievalBudget",
    "FallbackDecision",
    "PlannerDecision",
    # Classes
    "FallbackManager",
    "RetrievalPlanner",
    # Functions
    "resolve_confidence_band",
    "allocate_budget",
]
