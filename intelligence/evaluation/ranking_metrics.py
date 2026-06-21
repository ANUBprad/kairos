from __future__ import annotations

import math
from typing import List, Optional, Set, Sequence


def reciprocal_rank(relevant: Set[str], retrieved: Sequence[str]) -> float:
    """Reciprocal rank of the first relevant document in retrieved list.

    Returns 0.0 if no relevant document is found.
    """
    for i, doc in enumerate(retrieved):
        if doc in relevant:
            return 1.0 / (i + 1)
    return 0.0


def mean_reciprocal_rank(
    queries: Sequence[Sequence[str]],
    relevants: Sequence[Set[str]],
) -> float:
    """Mean Reciprocal Rank (MRR) across multiple queries.

    Args:
        queries:    List of retrieved document lists (one per query).
        relevants:  List of relevant document sets (one per query).

    Returns:
        MRR score (0.0 to 1.0).
    """
    if not queries or not relevants:
        return 0.0
    total = sum(
        reciprocal_rank(rel, ret)
        for ret, rel in zip(queries, relevants)
    )
    return total / len(queries)


def average_precision(relevant: Set[str], retrieved: Sequence[str]) -> float:
    """Average Precision (AP) for a single query.

    AP = sum of precision@k at each position where a relevant doc is found,
    divided by total number of relevant docs.
    """
    if not relevant:
        return 0.0
    score = 0.0
    hits = 0
    for i, doc in enumerate(retrieved):
        if doc in relevant:
            hits += 1
            score += hits / (i + 1)
    return score / len(relevant)


def mean_average_precision(
    queries: Sequence[Sequence[str]],
    relevants: Sequence[Set[str]],
) -> float:
    """Mean Average Precision (MAP) across multiple queries."""
    if not queries or not relevants:
        return 0.0
    return sum(
        average_precision(rel, ret)
        for ret, rel in zip(queries, relevants)
    ) / len(queries)


def discounted_cumulative_gain(
    relevances: Sequence[float],
    k: Optional[int] = None,
) -> float:
    """Discounted Cumulative Gain (DCG).

    Args:
        relevances: Relevance scores for each retrieved position.
        k:          Truncation point (default: len(relevances)).

    Returns:
        DCG score.
    """
    if k is not None:
        relevances = relevances[:k]
    if not relevances:
        return 0.0
    dcg = float(relevances[0])
    for i, r in enumerate(relevances[1:], start=2):
        dcg += r / math.log2(i)
    return dcg


def normalized_dcg(
    relevances: Sequence[float],
    k: Optional[int] = None,
) -> float:
    """Normalized Discounted Cumulative Gain (NDCG).

    NDCG = DCG / IDCG (ideal DCG), where IDCG is DCG of
    relevance scores sorted in descending order.

    Returns 0.0 when ideal DCG is zero.
    """
    dcg = discounted_cumulative_gain(relevances, k)
    ideal = discounted_cumulative_gain(
        sorted(relevances, reverse=True), k,
    )
    if ideal == 0.0:
        return 0.0
    return dcg / ideal


def hit_rate(
    queries: Sequence[Sequence[str]],
    relevants: Sequence[Set[str]],
    k: Optional[int] = None,
) -> float:
    """Hit Rate (HR@k): fraction of queries with at least one relevant doc in top-k.

    Args:
        queries:    List of retrieved document lists (one per query).
        relevants:  List of relevant document sets (one per query).
        k:          Truncation point (default: use all retrieved docs).

    Returns:
        Hit rate (0.0 to 1.0).
    """
    if not queries or not relevants:
        return 0.0
    hits = 0
    for ret, rel in zip(queries, relevants):
        truncated = ret[:k] if k is not None else ret
        if any(doc in rel for doc in truncated):
            hits += 1
    return hits / len(queries)
