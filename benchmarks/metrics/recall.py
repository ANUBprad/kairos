"""Retrieval Recall metric.

.. math::

    \\text{Recall@k} = \\frac{|\\text{relevant} \\cap \\text{retrieved}_{:k}|}
                              {|\\text{relevant}|}

Usage::

    >>> relevant = {"chunk_a", "chunk_b", "chunk_c"}
    >>> retrieved = ["chunk_a", "chunk_d", "chunk_e", "chunk_b"]
    >>> recall_at_k(relevant, retrieved)  # doctest: +ELLIPSIS
    0.666...
    >>> recall_at_k(relevant, retrieved, k=2)  # doctest: +ELLIPSIS
    0.333...
"""

from __future__ import annotations

from typing import List, Optional, Set


def recall_at_k(
    relevant: Set[str],
    retrieved: List[str],
    k: Optional[int] = None,
) -> float:
    """Compute Retrieval Recall@k.

    The fraction of relevant documents that appear in the first *k* retrieved
    results.  When *k* is ``None`` all retrieved results are considered.

    Parameters
    ----------
    relevant:
        Ground-truth set of relevant chunk/document identifiers.
    retrieved:
        Ordered list of chunk/document identifiers returned by the retriever.
    k:
        Cut-off rank (default: ``None``, meaning all results are used).

    Returns
    -------
    float
        A value in ``[0.0, 1.0]``.  Returns ``0.0`` when *relevant* is empty
        (the metric is undefined in that case; we default to 0.0).

    Examples
    --------
    >>> recall_at_k({"a", "b"}, ["a", "c", "b"])
    1.0
    >>> recall_at_k({"a", "b"}, ["a", "c", "b"], k=1)
    0.5
    >>> recall_at_k(set(), ["a", "b"])
    0.0
    """
    if not relevant:
        return 0.0

    if k is not None:
        retrieved = retrieved[:k]

    hits = len(set(retrieved) & relevant)
    return hits / len(relevant)
