"""Confidence-aware retrieval budget allocation.

Resolves a classifier confidence score into a discrete band and looks
up the corresponding :class:`RetrievalBudget` from the budget table.
"""

from __future__ import annotations

from .planner_config import (
    BUDGET_TABLE,
    CONFIDENCE_HIGH,
    CONFIDENCE_MEDIUM,
    ConfidenceBand,
    QueryType,
    RetrievalBudget,
)


def resolve_confidence_band(confidence: float) -> ConfidenceBand:
    """Map a continuous confidence score to a discrete band.

    The mapping uses the thresholds defined in :mod:`planner_config`:

        ``[HIGH_THRESHOLD, 1.0]`` → :attr:`ConfidenceBand.HIGH`
        ``[MEDIUM_THRESHOLD, HIGH_THRESHOLD)`` → :attr:`ConfidenceBand.MEDIUM`
        ``[0.0, MEDIUM_THRESHOLD)`` → :attr:`ConfidenceBand.LOW`

    Args:
        confidence: Classifier certainty in ``[0.0, 1.0]``.

    Returns:
        The corresponding :class:`ConfidenceBand`.

    Raises:
        ValueError: If *confidence* is outside ``[0.0, 1.0]``.

    Examples:
        >>> resolve_confidence_band(0.92)
        <ConfidenceBand.HIGH: 'high'>
        >>> resolve_confidence_band(0.65)
        <ConfidenceBand.MEDIUM: 'medium'>
        >>> resolve_confidence_band(0.30)
        <ConfidenceBand.LOW: 'low'>
        >>> resolve_confidence_band(0.0)
        <ConfidenceBand.LOW: 'low'>
        >>> resolve_confidence_band(1.0)
        <ConfidenceBand.HIGH: 'high'>
    """
    if not 0.0 <= confidence <= 1.0:
        raise ValueError(f"Confidence must be in [0.0, 1.0], got {confidence}")

    if confidence >= CONFIDENCE_HIGH:
        return ConfidenceBand.HIGH
    if confidence >= CONFIDENCE_MEDIUM:
        return ConfidenceBand.MEDIUM
    return ConfidenceBand.LOW


def allocate_budget(query_type: QueryType, confidence: float) -> RetrievalBudget:
    """Allocate a retrieval budget for a given query type and confidence.

    The budget controls how many chunks to retrieve, whether to rerank,
    and whether to decompose the query — and is read from
    :data:`BUDGET_TABLE` based on the resolved confidence band.

    Args:
        query_type: The classified retrieval tier.
        confidence:  The classifier's confidence score ``[0.0, 1.0]``.

    Returns:
        A frozen :class:`RetrievalBudget` instance.

    Raises:
        ValueError: If *confidence* is outside ``[0.0, 1.0]``.
        ValueError: If *query_type* is not present in the budget table.

    Examples:
        >>> budget = allocate_budget(QueryType.SIMPLE, 0.92)
        >>> budget.top_k
        3
        >>> budget.rerank
        False
        >>> budget.decompose
        False

        >>> budget = allocate_budget(QueryType.SIMPLE, 0.55)
        >>> budget.top_k
        5
        >>> budget.rerank
        True

        >>> budget = allocate_budget(QueryType.COMPLEX, 0.30)
        >>> budget.top_k
        12
        >>> budget.decompose
        True
    """
    band = resolve_confidence_band(confidence)

    try:
        return BUDGET_TABLE[query_type][band]
    except KeyError:
        raise ValueError(
            f"No budget configured for query_type={query_type!r}, "
            f"band={band!r}. "
            f"Available types: {[q.value for q in BUDGET_TABLE]}"
        ) from None
