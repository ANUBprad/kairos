from __future__ import annotations

import json
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional


@dataclass
class Span:
    name: str
    trace_id: str
    span_id: str
    parent_span_id: Optional[str] = None
    start_time: float = 0.0
    end_time: Optional[float] = None
    attributes: Dict[str, Any] = field(default_factory=dict)
    status: str = "ok"

    @property
    def duration_ms(self) -> float:
        end = self.end_time if self.end_time is not None else time.monotonic()
        return (end - self.start_time) * 1000.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "name": self.name,
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration_ms": self.duration_ms,
            "attributes": self.attributes,
            "status": self.status,
        }


class Tracer:
    """Lightweight distributed tracer with trace/span correlation.

    Usage::

        tracer = Tracer()
        with tracer.trace("planner.plan", query_id="abc") as span:
            span.attributes["query_type"] = "complex"
    """

    def __init__(self) -> None:
        self._local = threading.local()
        self._on_span_finish: List[Callable[[Span], None]] = []

    def on_span_finish(self, callback: Callable[[Span], None]) -> None:
        self._on_span_finish.append(callback)

    def start_trace(self, name: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
        trace_id = uuid.uuid4().hex[:16]
        span = Span(
            name=name,
            trace_id=trace_id,
            span_id=uuid.uuid4().hex[:12],
            start_time=time.monotonic(),
            attributes=attributes or {},
        )
        self._local.current_span = span
        return span

    def start_span(self, name: str, attributes: Optional[Dict[str, Any]] = None) -> Span:
        parent = getattr(self._local, "current_span", None)
        trace_id = parent.trace_id if parent else uuid.uuid4().hex[:16]
        span = Span(
            name=name,
            trace_id=trace_id,
            span_id=uuid.uuid4().hex[:12],
            parent_span_id=parent.span_id if parent else None,
            start_time=time.monotonic(),
            attributes=attributes or {},
        )
        self._local.current_span = span
        return span

    def end_span(self, span: Span, status: str = "ok") -> None:
        span.end_time = time.monotonic()
        span.status = status
        for cb in self._on_span_finish:
            try:
                cb(span)
            except Exception as exc:
                logger.warning("Span callback failed", extra={"callback": cb.__name__, "error": str(exc)})
        # Restore parent
        if span.parent_span_id is not None:
            self._local.current_span = Span(
                name="parent", trace_id=span.trace_id,
                span_id=span.parent_span_id,
            )

    def trace(self, name: str, attributes: Optional[Dict[str, Any]] = None):
        return _SpanContext(self, name, attributes)


class _SpanContext:
    def __init__(self, tracer: Tracer, name: str, attributes: Optional[Dict[str, Any]] = None):
        self._tracer = tracer
        self._name = name
        self._attributes = attributes
        self.span: Optional[Span] = None

    def __enter__(self) -> Span:
        if getattr(self._tracer._local, "current_span", None) is None:
            self.span = self._tracer.start_trace(self._name, self._attributes)
        else:
            self.span = self._tracer.start_span(self._name, self._attributes)
        return self.span

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.span is not None:
            status = "error" if exc_type is not None else "ok"
            self._tracer.end_span(self.span, status=status)


_default_tracer = Tracer()


def get_tracer() -> Tracer:
    return _default_tracer
