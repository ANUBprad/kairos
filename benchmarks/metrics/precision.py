"""Retrieval Precision metric.

.. math::

    \\text{Precision@k} = \\frac{|\\text{relevant} \\cap \\text{retrieved}_{:k}|}
                                 {k}

Usage::

    >>> relevant = {"chunk_a", "chunk_d"}
    >>> retrieved = ["chunk_a", "chunk_b", "chunk_c"]
    >>> precision_at_k(relevant, retrieved)  # doctest: +ELLIPSIS
    0.333...
    >>> precision_at_k(relevant, retrieved, k=1)
    1.0
"""

from __future__ import annotations

from typing import List, Optional, Set


def precision_at_k(
    relevant: Set[str],
    retrieved: List[str],
    k: Optional[int] = None,
) -> float:
    """Compute Retrieval Precision@k.

    The fraction of the first *k* retrieved documents that are relevant.
    When *k* is ``None`` it defaults to ``len(retrieved)`` (unqualified
    precision).

    Parameters
    ----------
    relevant:
        Ground-truth set of relevant chunk/document identifiers.
    retrieved:
        Ordered list of chunk/document identifiers returned by the retriever.
    k:
        Cut-off rank (default: ``None``, meaning ``len(retrieved)``).

    Returns
    -------
    float
        A value in ``[0.0, 1.0]``.  Returns ``0.0`` when *k* is ``0`` or when
        *retrieved* is empty.

    Examples
    --------
    >>> precision_at_k({"a", "b"}, ["a", "c", "d"])  # doctest: +ELLIPSIS
    0.333...
    >>> precision_at_k({"a", "b"}, ["a", "c", "d"], k=1)
    1.0
    >>> precision_at_k({"a"}, [])
    0.0
    >>> precision_at_k({"a"}, ["x", "y"], k=0)
    0.0
    """
    k_actual = k if k is not None else len(retrieved)

    if k_actual <= 0:
        return 0.0

    hits = sum(1 for r in retrieved[:k_actual] if r in relevant)
    return hits / k_actual
