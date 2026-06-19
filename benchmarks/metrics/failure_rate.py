"""Failure-event tracking and rate computation.

Tracks four failure categories across benchmark runs:

* **Empty retrieval** — retriever returned zero chunks.
* **Timeout** — a pipeline phase exceeded its time budget.
* **Planner fallback** — the :class:`FallbackManager` decided to escalate.
* **Generation failure** — the LLM failed to produce an answer.

Usage::

    record = FailureRecord(
        empty_retrieval=2,
        timeout=1,
        planner_fallback=5,
        generation_failure=0,
        total_queries=100,
    )

    rates = compute_failure_rates(record)
    print(f"Overall failure rate: {rates['overall_failure_rate']:.1%}")

    # Merge multiple partial records
    merged = merge_records([record, another_record])
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List


@dataclass(frozen=True)
class FailureRecord:
    """Counts of failure events observed during a benchmark run.

    Parameters
    ----------
    empty_retrieval:
        Number of queries where the retriever returned zero chunks.
    timeout:
        Number of queries that exceeded the allowed time budget.
    planner_fallback:
        Number of queries where the planner triggered a strategy
        escalation through :class:`FallbackManager`.
    generation_failure:
        Number of queries where the LLM failed to produce an answer.
    total_queries:
        Total number of queries executed.
    """

    empty_retrieval: int = 0
    timeout: int = 0
    planner_fallback: int = 0
    generation_failure: int = 0
    total_queries: int = 0


def compute_failure_rates(record: FailureRecord) -> Dict[str, float]:
    """Convert a :class:`FailureRecord` into per-category rates.

    Each rate is ``count / total_queries``.  Returns ``0.0`` for all
    rates when *total_queries* is zero.

    Returns
    -------
    dict
        Keys:

        * ``empty_retrieval_rate``
        * ``timeout_rate``
        * ``planner_fallback_rate``
        * ``generation_failure_rate``
        * ``overall_failure_rate``

    Examples
    --------
    >>> record = FailureRecord(
    ...     empty_retrieval=1, timeout=0, planner_fallback=2,
    ...     generation_failure=0, total_queries=10,
    ... )
    >>> rates = compute_failure_rates(record)
    >>> rates["empty_retrieval_rate"]
    0.1
    >>> rates["planner_fallback_rate"]
    0.2
    >>> rates["overall_failure_rate"]
    0.3
    >>> compute_failure_rates(FailureRecord())["overall_failure_rate"]
    0.0
    """
    total = record.total_queries
    if total <= 0:
        return {
            "empty_retrieval_rate": 0.0,
            "timeout_rate": 0.0,
            "planner_fallback_rate": 0.0,
            "generation_failure_rate": 0.0,
            "overall_failure_rate": 0.0,
        }

    failures = (
        record.empty_retrieval
        + record.timeout
        + record.planner_fallback
        + record.generation_failure
    )

    return {
        "empty_retrieval_rate": record.empty_retrieval / total,
        "timeout_rate": record.timeout / total,
        "planner_fallback_rate": record.planner_fallback / total,
        "generation_failure_rate": record.generation_failure / total,
        "overall_failure_rate": failures / total,
    }


def merge_records(records: List[FailureRecord]) -> FailureRecord:
    """Combine multiple :class:`FailureRecord`\\ s by summing counts.

    Parameters
    ----------
    records:
        Records to merge (e.g. per-query or per-batch records).

    Returns
    -------
    FailureRecord
        A single record whose fields are the sum of all inputs.

    Examples
    --------
    >>> r1 = FailureRecord(empty_retrieval=1, total_queries=5)
    >>> r2 = FailureRecord(timeout=2, total_queries=5)
    >>> merged = merge_records([r1, r2])
    >>> merged.empty_retrieval
    1
    >>> merged.timeout
    2
    >>> merged.total_queries
    10
    >>> merge_records([])
    FailureRecord(empty_retrieval=0, timeout=0, planner_fallback=0, generation_failure=0, total_queries=0)
    """
    return FailureRecord(
        empty_retrieval=sum(r.empty_retrieval for r in records),
        timeout=sum(r.timeout for r in records),
        planner_fallback=sum(r.planner_fallback for r in records),
        generation_failure=sum(r.generation_failure for r in records),
        total_queries=sum(r.total_queries for r in records),
    )
