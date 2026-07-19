"""OpenTelemetry tracing integration for the intelligence engine."""

from __future__ import annotations

import logging
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from typing import Any, Generator

logger = logging.getLogger(__name__)


@dataclass
class Span:
    name: str
    start_time: float
    end_time: float = 0.0
    attributes: dict[str, Any] = field(default_factory=dict)
    status: str = "OK"
    events: list[dict[str, Any]] = field(default_factory=list)

    @property
    def duration_ms(self) -> float:
        return (self.end_time - self.start_time) * 1000


class Tracer:
    """Lightweight tracer that produces structured span records.

    When OpenTelemetry is available, bridges to OTLP spans.
    Otherwise, falls back to structured logging.
    """

    def __init__(self, service_name: str = "kairos-intelligence"):
        self._service_name = service_name
        self._spans: list[Span] = []
        self._otel_available = False
        self._tracer = None

        try:
            from opentelemetry import trace
            from opentelemetry.sdk.trace import TracerProvider

            provider = TracerProvider()
            trace.set_tracer_provider(provider)
            self._tracer = trace.get_tracer(service_name)
            self._otel_available = True
            logger.info("OpenTelemetry tracing initialized")
        except ImportError:
            logger.info("OpenTelemetry not available, using structured logging tracer")
        except Exception as e:
            logger.warning("OpenTelemetry init failed: %s, using fallback", e)

    @contextmanager
    def start_span(
        self, name: str, attributes: dict[str, Any] | None = None
    ) -> Generator[Span, None, None]:
        span = Span(
            name=name,
            start_time=time.monotonic(),
            attributes=attributes or {},
        )

        if self._otel_available and self._tracer:
            with self._tracer.start_as_current_span(name) as otel_span:
                for k, v in (attributes or {}).items():
                    otel_span.set_attribute(k, str(v))
                try:
                    yield span
                except Exception as e:
                    span.status = "ERROR"
                    span.events.append({"name": "exception", "message": str(e)})
                    otel_span.record_exception(e)
                    raise
                finally:
                    span.end_time = time.monotonic()
                    self._spans.append(span)
        else:
            try:
                yield span
            except Exception as e:
                span.status = "ERROR"
                span.events.append({"name": "exception", "message": str(e)})
                raise
            finally:
                span.end_time = time.monotonic()
                self._spans.append(span)
                logger.info(
                    "Span completed",
                    extra={
                        "span_name": name,
                        "duration_ms": span.duration_ms,
                        "status": span.status,
                        "attributes": span.attributes,
                    },
                )

    def get_spans(self) -> list[Span]:
        return list(self._spans)

    def get_stats(self) -> dict:
        if not self._spans:
            return {"total_spans": 0}

        durations = [s.duration_ms for s in self._spans]
        errors = sum(1 for s in self._spans if s.status == "ERROR")

        return {
            "total_spans": len(self._spans),
            "error_spans": errors,
            "avg_duration_ms": sum(durations) / len(durations),
            "max_duration_ms": max(durations),
            "min_duration_ms": min(durations),
        }


_tracer: Tracer | None = None


def get_tracer() -> Tracer:
    global _tracer
    if _tracer is None:
        _tracer = Tracer()
    return _tracer
