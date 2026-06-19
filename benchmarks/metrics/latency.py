"""Wall-clock latency tracking for each pipeline phase.

Records elapsed time for classifier, planner, retriever, generator, and the
overall query.  Uses :func:`time.perf_counter` for sub-millisecond precision.

Usage::

    tracker = LatencyTracker()

    with tracker.measure("classify"):
        result = classifier.classify(query)

    with tracker.measure("planning"):
        decision = planner.plan(query)

    with tracker.measure("retrieval"):
        chunks = retriever.retrieve(query)

    with tracker.measure("generation"):
        answer = llm.generate(query, chunks)

    record = tracker.record()
    print(f"Total: {record.total:.3f}s  "
          f"Retrieval: {record.retrieval:.3f}s")
"""

from __future__ import annotations

import time
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Dict, Iterator, Optional


@dataclass(frozen=True)
class LatencyRecord:
    """Latency breakdown for a single query execution.

    All durations are in seconds as returned by :func:`time.perf_counter`.
    """

    classify: float = 0.0
    planning: float = 0.0
    retrieval: float = 0.0
    generation: float = 0.0
    total: float = 0.0


class LatencyTracker:
    """Record wall-clock time for each phase of a single query.

    Thread-safe only within a single-threaded pipeline — no locks are held.

    Examples
    --------
    >>> import time
    >>> tracker = LatencyTracker()
    >>> with tracker.measure("classify"):
    ...     time.sleep(0.01)
    >>> with tracker.measure("retrieval"):
    ...     time.sleep(0.02)
    >>> r = tracker.record()
    >>> r.classify >= 0.01
    True
    >>> r.retrieval >= 0.02
    True
    >>> r.total >= r.classify + r.retrieval
    True
    """

    def __init__(self) -> None:
        self._phases: Dict[str, float] = {}
        self._start_time: Optional[float] = None

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Begin the overall query timer.

        Must be called before :meth:`record`.  Calling it again resets
        the timer.
        """
        self._start_time = time.perf_counter()

    @contextmanager
    def measure(self, name: str) -> Iterator[None]:
        """Context manager that records elapsed time for *name*.

        Parameters
        ----------
        name:
            Phase name (e.g. ``"classify"``, ``"planning"``,
            ``"retrieval"``, ``"generation"``).

        Examples
        --------
        >>> tracker = LatencyTracker()
        >>> with tracker.measure("classify"):
        ...     result = 1 + 1
        """
        start = time.perf_counter()
        try:
            yield
        finally:
            elapsed = time.perf_counter() - start
            self._phases[name] = elapsed

    def record(self) -> LatencyRecord:
        """Return a :class:`LatencyRecord` with all measured phases.

        Returns
        -------
        LatencyRecord
            Phase durations.  Phases that were never measured default to
            ``0.0``.  *total* is computed from the overall start time if
            :meth:`start` was called, otherwise it falls back to the sum
            of all measured phases.
        """
        current = time.perf_counter()
        phase_sum = sum(self._phases.values())
        total = (
            (current - self._start_time)
            if self._start_time is not None
            else phase_sum
        )
        return LatencyRecord(
            classify=self._phases.get("classify", 0.0),
            planning=self._phases.get("planning", 0.0),
            retrieval=self._phases.get("retrieval", 0.0),
            generation=self._phases.get("generation", 0.0),
            total=total,
        )

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def reset(self) -> None:
        """Clear all accumulated measurements."""
        self._phases.clear()
        self._start_time = None

    @property
    def phase_names(self) -> tuple[str, ...]:
        """Return names of all phases that have been measured so far."""
        return tuple(sorted(self._phases.keys()))
