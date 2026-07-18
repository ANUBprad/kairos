"""Request context middleware for correlation IDs across the intelligence engine."""

from __future__ import annotations

import uuid
from contextvars import ContextVar

_trace_id_var: ContextVar[str] = ContextVar("trace_id", default="")
_namespace_var: ContextVar[str] = ContextVar("namespace", default="")
_user_agent_var: ContextVar[str] = ContextVar("user_agent", default="")


def set_trace_id(trace_id: str | None = None) -> str:
    if trace_id is None:
        trace_id = uuid.uuid4().hex[:16]
    _trace_id_var.set(trace_id)
    return trace_id


def get_trace_id() -> str:
    return _trace_id_var.get("")


def set_namespace(namespace: str) -> None:
    _namespace_var.set(namespace)


def get_namespace() -> str:
    return _namespace_var.get("")


def set_user_agent(user_agent: str) -> None:
    _user_agent_var.set(user_agent)


def get_user_agent() -> str:
    return _user_agent_var.get("")


def get_context() -> dict[str, str]:
    return {
        "trace_id": get_trace_id(),
        "namespace": get_namespace(),
        "user_agent": get_user_agent(),
    }
