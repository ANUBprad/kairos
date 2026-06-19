"""Retriever interface and mock implementation for benchmarking.

The :class:`Retriever` protocol defines the minimal contract the benchmark
runner expects from any retriever.  :class:`MockRetriever` is a test double
that returns pre-configured results based on query identity.
"""

from __future__ import annotations

from typing import Dict, List, Optional, Protocol


class Retriever(Protocol):
    """Minimal retriever interface expected by :class:`BenchmarkRunner`.

    Implementations must provide a ``retrieve`` method that takes a query
    string, a config dict, and an optional query ID, and returns an ordered
    list of chunk identifiers.
    """

    def retrieve(
        self,
        query: str,
        config: Dict[str, object],
        query_id: Optional[str] = None,
    ) -> List[str]:
        """Execute retrieval for a single query.

        Parameters
        ----------
        query:
            The user's query string.
        config:
            Retrieval configuration dict produced by the planner.
        query_id:
            Optional dataset entry ID (``QueryEntry.id``) for lookup in
            mock/deterministic retrievers.

        Returns
        -------
        list[str]
            Ordered list of chunk identifiers.
        """


class MockRetriever:
    """Test double that returns pre-configured chunks based on query ID.

    Parameters
    ----------
    chunk_map:
        Mapping from *query_id* to the list of chunks the retriever should
        return.  Queries not in the map receive a single default chunk.
    empty_ids:
        Set of query IDs for which the retriever should return an empty
        list (simulating empty retrieval failure).

    Examples
    --------
    >>> r = MockRetriever({"Q1": ["a", "b"]}, empty_ids={"Q2"})
    >>> r.retrieve("?", {}, "Q1")
    ['a', 'b']
    >>> r.retrieve("?", {}, "Q2")
    []
    """

    def __init__(
        self,
        chunk_map: Optional[Dict[str, List[str]]] = None,
        empty_ids: Optional[set[str]] = None,
    ) -> None:
        self._chunk_map: Dict[str, List[str]] = chunk_map or {}
        self._empty_ids: set[str] = empty_ids or set()

    def retrieve(
        self,
        query: str,
        config: Dict[str, object],
        query_id: Optional[str] = None,
    ) -> List[str]:
        if query_id and query_id in self._empty_ids:
            return []
        if query_id and query_id in self._chunk_map:
            return list(self._chunk_map[query_id])
        return [f"{query_id or 'unknown'}_chunk_1"]
