from __future__ import annotations

import json
import os
from datetime import date
from pathlib import Path
from threading import RLock
from typing import Iterator, List

from intelligence.telemetry.models import RetrievalTelemetry


class TelemetryStorage:
    """Append-only JSONL storage for retrieval telemetry events.

    Events are written to ``telemetry/retrieval_YYYY-MM-DD.jsonl``,
    one JSON object per line.  Thread-safe.

    Usage::

        storage = TelemetryStorage(base_dir="telemetry")
        storage.store(event)
        records = list(storage.read("2026-06-20"))
    """

    def __init__(self, base_dir: os.PathLike[str] | str = "telemetry"):
        self._base = Path(base_dir)
        self._base.mkdir(parents=True, exist_ok=True)
        self._lock = RLock()
        self._handles: dict[str, object] = {}  # filename -> file object

    # ------------------------------------------------------------------
    # Writing
    # ------------------------------------------------------------------

    def _path_for(self, d: date | None = None) -> Path:
        d = d or date.today()
        return self._base / f"retrieval_{d.isoformat()}.jsonl"

    def store(self, event: RetrievalTelemetry) -> None:
        """Append a single telemetry event to today's JSONL file."""
        self.store_batch([event])

    def store_batch(self, events: List[RetrievalTelemetry]) -> None:
        """Append multiple events atomically to the correct daily file.

        All events are written to the file corresponding to today's date.
        """
        if not events:
            return
        path = self._path_for()
        with self._lock:
            with path.open("a", encoding="utf-8") as f:
                for event in events:
                    f.write(_event_to_jsonl(event))
                    f.write("\n")

    # ------------------------------------------------------------------
    # Reading
    # ------------------------------------------------------------------

    def read(self, date_str: str) -> Iterator[RetrievalTelemetry]:
        """Yield all events recorded on a given date (ISO format).

        Args:
            date_str: ISO date string e.g. ``"2026-06-20"``.

        Yields:
            :class:`RetrievalTelemetry` objects in insertion order.

        Raises:
            FileNotFoundError: No data file exists for the given date.
        """
        path = self._path_for(date.fromisoformat(date_str))
        with path.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    yield _jsonl_to_event(line)

    def list_dates(self) -> List[str]:
        """Return sorted list of ISO dates for which data files exist."""
        files = sorted(self._base.glob("retrieval_*.jsonl"))
        return [f.stem.replace("retrieval_", "") for f in files]

    @property
    def event_count(self) -> int:
        """Approximate total event count across all files (expensive)."""
        total = 0
        for f in self._base.glob("retrieval_*.jsonl"):
            with f.open("r", encoding="utf-8") as fh:
                for line in fh:
                    if line.strip():
                        total += 1
        return total

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Release any open resources (currently a no-op)."""
        pass


# ---------------------------------------------------------------------------
# Serialisation helpers
# ---------------------------------------------------------------------------


def _event_to_jsonl(event: RetrievalTelemetry) -> str:
    """Serialize a RetrievalTelemetry to a single JSON line."""
    d = {
        "timestamp": event.timestamp,
        "query_id": event.query_id,
        "event_type": event.event_type,
        "query": event.query,
        "query_type": event.query_type,
        "confidence": event.confidence,
        "retrieval_type": event.retrieval_type,
        "top_k": event.top_k,
        "rerank": event.rerank,
        "decompose": event.decompose,
        "retrieved_chunks": event.retrieved_chunks,
        "retrieval_latency_ms": event.retrieval_latency_ms,
        "fallback_triggered": event.fallback_triggered,
        "fallback_reason": event.fallback_reason,
        "success": event.success,
    }
    return json.dumps(d, ensure_ascii=False, default=str)


def _jsonl_to_event(line: str) -> RetrievalTelemetry:
    """Deserialize a JSON line to a RetrievalTelemetry."""
    d = json.loads(line)
    return RetrievalTelemetry(
        timestamp=d["timestamp"],
        query_id=d.get("query_id"),
        event_type=d.get("event_type", "retrieval"),
        query=d["query"],
        query_type=d["query_type"],
        confidence=d["confidence"],
        retrieval_type=d["retrieval_type"],
        top_k=d["top_k"],
        rerank=d["rerank"],
        decompose=d["decompose"],
        retrieved_chunks=d["retrieved_chunks"],
        retrieval_latency_ms=d["retrieval_latency_ms"],
        fallback_triggered=d["fallback_triggered"],
        fallback_reason=d.get("fallback_reason"),
        success=d["success"],
    )
