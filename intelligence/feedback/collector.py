from __future__ import annotations

import logging
from threading import RLock
from typing import Callable, Dict, List, Optional

from intelligence.feedback.models import FeedbackRecord
from intelligence.feedback.storage import FeedbackStorage
from intelligence.feedback.validator import FeedbackValidator

logger = logging.getLogger(__name__)


class FeedbackCollector:
    """Thread-safe collector that records user feedback on retrieval outcomes.

    The collector validates all records before storing them, and forwards
    validated records to an optional :class:`FeedbackStorage` backend.

    Usage::

        collector = FeedbackCollector(storage=FeedbackStorage())
        collector.record_feedback(query_id="q001", ..., answer_accepted=True)
        collector.export_dataset()
    """

    def __init__(
        self,
        storage: Optional[FeedbackStorage] = None,
        on_feedback: Optional[Callable[[FeedbackRecord], None]] = None,
    ):
        self._storage = storage
        self._on_feedback = on_feedback
        self._lock = RLock()
        self._pending: List[FeedbackRecord] = []

    # ------------------------------------------------------------------
    # Public record methods
    # ------------------------------------------------------------------

    def record_feedback(
        self,
        query_id: str,
        query: str,
        query_type: str,
        retrieval_type: str,
        confidence: float,
        calibrated_confidence: float,
        top_k: int,
        rerank: bool,
        decompose: bool,
        answer_accepted: bool,
        answer_rating: Optional[int] = None,
        fallback_triggered: bool = False,
        retrieval_success: bool = True,
        latency_ms: float = 0.0,
    ) -> None:
        """Record user feedback for a retrieval outcome.

        Args:
            query_id:              Unique query identifier.
            query:                 The user's query string.
            query_type:            Classified query type.
            retrieval_type:        The retrieval strategy used.
            confidence:            Raw classifier confidence.
            calibrated_confidence: Post-calibration confidence.
            top_k:                 Number of chunks requested.
            rerank:                Whether reranking was applied.
            decompose:             Whether decomposition was applied.
            answer_accepted:       Whether the user accepted the answer.
            answer_rating:         Optional user rating in ``[1, 5]``.
            fallback_triggered:    Whether a fallback escalation occurred.
            retrieval_success:     Whether retrieval completed without error.
            latency_ms:            Total retrieval latency.
        """
        record = FeedbackRecord(
            query_id=query_id,
            query=query,
            query_type=query_type,
            retrieval_type=retrieval_type,
            confidence=confidence,
            calibrated_confidence=calibrated_confidence,
            top_k=top_k,
            rerank=rerank,
            decompose=decompose,
            answer_accepted=answer_accepted,
            answer_rating=answer_rating,
            fallback_triggered=fallback_triggered,
            retrieval_success=retrieval_success,
            latency_ms=latency_ms,
        )
        self._emit(record)

    # ------------------------------------------------------------------
    # Dataset export
    # ------------------------------------------------------------------

    def export_dataset(self) -> List[Dict]:
        """Return pending + stored records as a list of dicts for training.

        This drains the pending buffer but does **not** flush to storage.
        """
        with self._lock:
            pending = list(self._pending)
        stored: List[FeedbackRecord] = []
        if self._storage:
            try:
                stored = list(self._storage.load())
            except FileNotFoundError:
                pass
        combined = stored + pending
        return [
            {
                "query_id": r.query_id,
                "query_type": r.query_type,
                "confidence": r.confidence,
                "calibrated_confidence": r.calibrated_confidence,
                "retrieval_type": r.retrieval_type,
                "top_k": r.top_k,
                "rerank": r.rerank,
                "decompose": r.decompose,
                "latency_ms": r.latency_ms,
                "fallback_triggered": r.fallback_triggered,
                "accepted": r.answer_accepted,
                "rating": r.answer_rating,
                "retrieval_success": r.retrieval_success,
            }
            for r in combined
        ]

    # ------------------------------------------------------------------
    # Aggregation
    # ------------------------------------------------------------------

    def aggregate_metrics(self) -> Dict[str, float]:
        """Compute aggregate metrics over all available feedback."""
        from intelligence.feedback.analytics import (
            compute_acceptance_rate,
            compute_avg_rating,
        )

        with self._lock:
            pending = list(self._pending)
        stored: List[FeedbackRecord] = []
        if self._storage:
            try:
                stored = list(self._storage.load())
            except FileNotFoundError:
                pass
        all_records = stored + pending
        if not all_records:
            return {}
        return {
            "total_records": len(all_records),
            "acceptance_rate": compute_acceptance_rate(all_records),
            "avg_rating": compute_avg_rating(all_records),
            "success_rate": sum(1 for r in all_records if r.retrieval_success) / len(all_records),
            "fallback_rate": sum(1 for r in all_records if r.fallback_triggered) / len(all_records),
        }

    # ------------------------------------------------------------------
    # Internal
    # ------------------------------------------------------------------

    def _emit(self, record: FeedbackRecord) -> None:
        """Validate, buffer, and optionally forward the record."""
        raw = {
            "query_id": record.query_id,
            "query": record.query,
            "query_type": record.query_type,
            "retrieval_type": record.retrieval_type,
            "confidence": record.confidence,
            "calibrated_confidence": record.calibrated_confidence,
            "top_k": record.top_k,
            "answer_accepted": record.answer_accepted,
            "answer_rating": record.answer_rating,
        }
        err = FeedbackValidator.validate_record(raw)
        if err:
            logger.warning("Feedback validation failed: %s — record dropped", err)
            raise ValueError(f"Invalid feedback record: {err}")

        with self._lock:
            self._pending.append(record)

        if self._on_feedback:
            try:
                self._on_feedback(record)
            except Exception:
                logger.exception("Feedback on_feedback callback failed")

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    @property
    def pending_count(self) -> int:
        with self._lock:
            return len(self._pending)

    def flush(self) -> None:
        """Write all pending records to storage (if configured)."""
        with self._lock:
            batch = list(self._pending)
            self._pending.clear()
        if self._storage and batch:
            try:
                self._storage.append_batch(batch)
            except Exception:
                logger.exception("Feedback flush failed")

    def close(self) -> None:
        """Flush pending records and release resources."""
        self.flush()
