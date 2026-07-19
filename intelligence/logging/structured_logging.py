"""Structured JSON logging with correlation IDs and OpenTelemetry integration."""

from __future__ import annotations

import json
import logging
import sys
import time
import uuid
from contextvars import ContextVar
from typing import Any

correlation_id_var: ContextVar[str] = ContextVar("correlation_id", default="")


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter with correlation ID support."""

    def format(self, record: logging.LogRecord) -> str:
        log_entry: dict[str, Any] = {
            "timestamp": time.strftime(
                "%Y-%m-%dT%H:%M:%S.", time.gmtime(record.created)
            )
            + f"{record.created % 1:.3f}Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        correlation_id = correlation_id_var.get("")
        if correlation_id:
            log_entry["correlation_id"] = correlation_id

        if record.exc_info and record.exc_info[1]:
            log_entry["exception"] = {
                "type": type(record.exc_info[1]).__name__,
                "message": str(record.exc_info[1]),
            }

        for key in ("method", "status", "duration", "path", "namespace",
                     "retrieval_type", "top_k", "chunk_count", "error"):
            val = getattr(record, key, None)
            if val is not None:
                log_entry[key] = val

        return json.dumps(log_entry, default=str)


class CorrelationFilter(logging.Filter):
    """Inject correlation ID into all log records."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id_var.get("")
        return True


def setup_structured_logging(
    level: str = "INFO",
    json_output: bool = True,
) -> None:
    """Configure structured JSON logging for the intelligence engine."""
    root = logging.getLogger()
    root.setLevel(getattr(logging, level.upper(), logging.INFO))

    for handler in root.handlers[:]:
        root.removeHandler(handler)

    if json_output:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
    else:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )

    handler.addFilter(CorrelationFilter())
    root.addHandler(handler)


def generate_correlation_id() -> str:
    return uuid.uuid4().hex[:16]


def set_correlation_id(cid: str | None = None) -> str:
    if cid is None:
        cid = generate_correlation_id()
    correlation_id_var.set(cid)
    return cid
