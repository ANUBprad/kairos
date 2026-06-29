from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class Event:
    event_type: str
    source: str
    timestamp: str = ""
    attributes: Dict[str, Any] = field(default_factory=dict)
    trace_id: Optional[str] = None
    span_id: Optional[str] = None

    def __post_init__(self) -> None:
        if not self.timestamp:
            self.timestamp = datetime.now(timezone.utc).isoformat()

    def to_dict(self) -> Dict[str, Any]:
        return {
            "event_type": self.event_type,
            "source": self.source,
            "timestamp": self.timestamp,
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "attributes": self.attributes,
        }


class EventLogger:
    """Structured event logger for all intelligence module events.

    Supports multiple sinks (console, file, callbacks).
    """

    def __init__(self) -> None:
        self._sinks: List[Callable[[Event], None]] = []
        self._pending: List[Event] = []

    def add_sink(self, sink: Callable[[Event], None]) -> None:
        self._sinks.append(sink)

    def log(
        self,
        event_type: str,
        source: str,
        attributes: Optional[Dict[str, Any]] = None,
        trace_id: Optional[str] = None,
        span_id: Optional[str] = None,
    ) -> Event:
        event = Event(
            event_type=event_type,
            source=source,
            attributes=attributes or {},
            trace_id=trace_id,
            span_id=span_id,
        )
        self._pending.append(event)
        for sink in self._sinks:
            try:
                sink(event)
            except Exception as exc:
                logger.warning("Event sink failed", extra={"sink": sink.__name__, "error": str(exc)})
        return event

    def flush(self) -> List[Event]:
        pending = list(self._pending)
        self._pending.clear()
        return pending

    @property
    def pending_count(self) -> int:
        return len(self._pending)


_default_logger = EventLogger()


def get_logger() -> EventLogger:
    return _default_logger


def console_sink(event: Event) -> None:
    """Print event as JSON to stdout."""
    print(json.dumps(event.to_dict(), default=str))


def file_sink(path: str) -> Callable[[Event], None]:
    """Return a sink that appends events as JSON lines to a file."""
    def _sink(event: Event) -> None:
        import os
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "a", encoding="utf-8") as f:
            f.write(json.dumps(event.to_dict(), default=str) + "\n")
    return _sink
