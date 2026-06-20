from __future__ import annotations

import logging
import time
from threading import RLock
from typing import Callable, Optional

from intelligence.telemetry.models import RetrievalTelemetry
from intelligence.telemetry.storage import TelemetryStorage

logger = logging.getLogger(__name__)


class TelemetryCollector:
    """Thread-safe collector that records retrieval telemetry events.

    The collector accepts events via the ``record_*`` methods, enriches
    them with timing information, and forwards the final
    :class:`RetrievalTelemetry` to an optional
    :class:`TelemetryStorage` backend.

    Usage::

        collector = TelemetryCollector(storage=TelemetryStorage())
        collector.record_retrieval(query="...", chunks=[...], ...)
        collector.flush()
    """

    def __init__(
        self,
        storage: Optional[TelemetryStorage] = None,
        on_event: Optional[Callable[[RetrievalTelemetry], None]] = None,
    ):
        self._storage = storage
        self._on_event = on_event
        self._lock = RLock()
        self._pending: list[RetrievalTelemetry] = []

    # ------------------------------------------------------------------
    # Public record methods
    # ------------------------------------------------------------------

    def record_retrieval(
        self,
        query: str,
        query_type: str,
        confidence: float,
        retrieval_type: str,
        top_k: int,
        query_id: Optional[str] = None,
        event_type: str = "retrieval",
        rerank: bool = False,
        decompose: bool = False,
        retrieved_chunks: int = 0,
        retrieval_latency_ms: float = 0.0,
        fallback_triggered: bool = False,
        fallback_reason: Optional[str] = None,
        success: bool = True,
    ) -> None:
        """Record a completed retrieval operation.

        Args:
            query:              The user's query string.
            query_type:         Classified query type
                                (``"SIMPLE"``/``"COMPLEX"``/``"MULTI_HOP"``).
            confidence:         Classifier confidence score.
            retrieval_type:     The retrieval strategy used.
            top_k:              Requested chunk count.
            query_id:           Optional caller-supplied correlation id.
            event_type:         ``"classification"``, ``"retrieval"``, or
                                ``"failure"``.
            rerank:             Whether reranking was applied.
            decompose:          Whether query decomposition was applied.
            retrieved_chunks:   Number of chunks returned.
            retrieval_latency_ms: Total retrieval latency in milliseconds.
            fallback_triggered: ``True`` if fallback was activated.
            fallback_reason:    Reason for fallback or ``None``.
            success:            ``True`` if retrieval completed without error.
        """
        event = RetrievalTelemetry(
            query=query,
            query_type=query_type,
            confidence=confidence,
            retrieval_type=retrieval_type,
            top_k=top_k,
            query_id=query_id,
            event_type=event_type,
            rerank=rerank,
            decompose=decompose,
            retrieved_chunks=retrieved_chunks,
            retrieval_latency_ms=retrieval_latency_ms,
            fallback_triggered=fallback_triggered,
            fallback_reason=fallback_reason,
            success=success,
        )
        self._emit(event)

    def record_failure(
        self,
        query: str,
        query_type: str = "UNKNOWN",
        confidence: float = 0.0,
        retrieval_type: str = "UNKNOWN",
        top_k: int = 0,
        query_id: Optional[str] = None,
        fallback_reason: Optional[str] = None,
    ) -> None:
        """Record a failed retrieval operation.

        Args:
            query:           The user's query string.
            query_type:      Classified query type (if available).
            confidence:      Classifier confidence (if available).
            retrieval_type:  The attempted retrieval strategy.
            top_k:           Requested chunk count.
            query_id:        Optional caller-supplied correlation id.
            fallback_reason: Reason for failure or ``None``.
        """
        event = RetrievalTelemetry(
            query=query,
            query_type=query_type,
            confidence=confidence,
            retrieval_type=retrieval_type,
            top_k=top_k,
            query_id=query_id,
            event_type="failure",
            success=False,
            fallback_reason=fallback_reason,
        )
        self._emit(event)

    def record_fallback(
        self,
        query: str,
        query_type: str,
        confidence: float,
        retrieval_type: str,
        top_k: int,
        reason: str,
        query_id: Optional[str] = None,
    ) -> None:
        """Record a fallback escalation event.

        This is a convenience wrapper around a successful retrieval
        that was escalated.  The caller should also call
        :meth:`record_retrieval` for the initial attempt; this method
        marks the fallback with ``success=True`` and the fallback reason.
        """
        event = RetrievalTelemetry(
            query=query,
            query_type=query_type,
            confidence=confidence,
            retrieval_type=retrieval_type,
            top_k=top_k,
            query_id=query_id,
            event_type="retrieval",
            success=True,
            fallback_triggered=True,
            fallback_reason=reason,
        )
        self._emit(event)

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _emit(self, event: RetrievalTelemetry) -> None:
        """Store the event and invoke the optional callback."""
        with self._lock:
            self._pending.append(event)
        if self._on_event:
            try:
                self._on_event(event)
            except Exception:
                logger.exception("Telemetry on_event callback failed")

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @property
    def pending_count(self) -> int:
        """Number of events buffered since last flush."""
        with self._lock:
            return len(self._pending)

    def flush(self) -> None:
        """Write all pending events to storage (if configured).

        Events are flushed in bulk and the pending buffer is cleared.
        """
        with self._lock:
            batch = list(self._pending)
            self._pending.clear()

        if self._storage and batch:
            try:
                self._storage.store_batch(batch)
            except Exception:
                logger.exception("Telemetry flush failed")

    def close(self) -> None:
        """Flush pending events and release resources."""
        self.flush()
