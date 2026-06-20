from __future__ import annotations

import json
import os
from pathlib import Path
from threading import RLock
from typing import Iterator, List, Optional

from intelligence.feedback.models import FeedbackRecord


class FeedbackStorage:
    """Append-only, atomic, recovery-safe JSONL storage for feedback records.

    Records are stored in ``data/feedback/feedback.jsonl``, one JSON object
    per line.  Thread-safe.

    Usage::

        storage = FeedbackStorage()
        storage.append(record)
        records = list(storage.load())
    """

    def __init__(self, path: os.PathLike[str] | str = "data/feedback/feedback.jsonl"):
        self._path = Path(path)
        self._path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()

    # ------------------------------------------------------------------
    # Writing
    # ------------------------------------------------------------------

    def append(self, record: FeedbackRecord) -> None:
        """Append a single feedback record atomically."""
        self.append_batch([record])

    def append_batch(self, records: List[FeedbackRecord]) -> None:
        """Append multiple records atomically."""
        if not records:
            return
        with self._lock:
            with self._path.open("a", encoding="utf-8") as f:
                for r in records:
                    f.write(_record_to_jsonl(r))
                    f.write("\n")

    # ------------------------------------------------------------------
    # Reading
    # ------------------------------------------------------------------

    def load(self) -> Iterator[FeedbackRecord]:
        """Yield all stored feedback records in insertion order.

        Raises:
            FileNotFoundError: No feedback file exists.
        """
        if not self._path.exists():
            raise FileNotFoundError(f"Feedback file not found: {self._path}")
        with self._path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield _jsonl_to_record(line)

    def count(self) -> int:
        """Return the total number of stored records (expensive for large files)."""
        if not self._path.exists():
            return 0
        with self._path.open("r", encoding="utf-8") as f:
            return sum(1 for line in f if line.strip())

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def save(self, records: List[FeedbackRecord]) -> None:
        """Overwrite the storage file with the given records.

        This is a recovery-safe write: data is written to a temporary
        file first, then renamed atomically.
        """
        tmp = self._path.with_suffix(".jsonl.tmp")
        with self._lock:
            with tmp.open("w", encoding="utf-8") as f:
                for r in records:
                    f.write(_record_to_jsonl(r))
                    f.write("\n")
            tmp.replace(self._path)

    def clear(self) -> None:
        """Delete all stored feedback records."""
        with self._lock:
            if self._path.exists():
                self._path.unlink()


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------


def _record_to_jsonl(record: FeedbackRecord) -> str:
    d = {
        "query_id": record.query_id,
        "query": record.query,
        "timestamp": record.timestamp,
        "query_type": record.query_type,
        "retrieval_type": record.retrieval_type,
        "confidence": record.confidence,
        "calibrated_confidence": record.calibrated_confidence,
        "top_k": record.top_k,
        "rerank": record.rerank,
        "decompose": record.decompose,
        "answer_accepted": record.answer_accepted,
        "answer_rating": record.answer_rating,
        "fallback_triggered": record.fallback_triggered,
        "retrieval_success": record.retrieval_success,
        "latency_ms": record.latency_ms,
    }
    return json.dumps(d, ensure_ascii=False, default=str)


def _jsonl_to_record(line: str) -> FeedbackRecord:
    d = json.loads(line)
    return FeedbackRecord(
        query_id=d["query_id"],
        query=d["query"],
        timestamp=d["timestamp"],
        query_type=d["query_type"],
        retrieval_type=d["retrieval_type"],
        confidence=d["confidence"],
        calibrated_confidence=d["calibrated_confidence"],
        top_k=d["top_k"],
        rerank=d["rerank"],
        decompose=d["decompose"],
        answer_accepted=d["answer_accepted"],
        answer_rating=d.get("answer_rating"),
        fallback_triggered=d.get("fallback_triggered", False),
        retrieval_success=d.get("retrieval_success", True),
        latency_ms=d.get("latency_ms", 0.0),
    )
