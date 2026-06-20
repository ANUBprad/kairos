from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from enum import Enum
from threading import RLock
from typing import Callable, Optional

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF_OPEN = "HALF_OPEN"


@dataclass
class CircuitBreakerStats:
    state: str = "CLOSED"
    failure_count: int = 0
    success_count: int = 0
    total_calls: int = 0
    open_count: int = 0
    half_open_count: int = 0


class CircuitBreaker:
    """Simple circuit breaker for provider calls.

    State machine:
      CLOSED → OPEN (after failure_threshold consecutive failures)
      OPEN   → HALF_OPEN (after recovery_timeout seconds)
      HALF_OPEN → CLOSED (on success)
      HALF_OPEN → OPEN (on failure)
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        name: str = "default",
        on_state_change: Optional[Callable[[CircuitState], None]] = None,
    ):
        self._failure_threshold = failure_threshold
        self._recovery_timeout = recovery_timeout
        self._name = name
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._total_calls = 0
        self._open_count = 0
        self._half_open_count = 0
        self._last_failure_time: float = 0.0
        self._lock = RLock()
        self._on_state_change = on_state_change

    def _transition_to(self, new_state: CircuitState) -> None:
        old_state = self._state
        if old_state != new_state:
            logger.info(
                "Circuit breaker '%s' state: %s -> %s",
                self._name, old_state.value, new_state.value,
            )
            self._state = new_state
            if self._on_state_change is not None:
                self._on_state_change(new_state)

    @property
    def state(self) -> CircuitState:
        with self._lock:
            if self._state == CircuitState.OPEN:
                if time.monotonic() - self._last_failure_time >= self._recovery_timeout:
                    self._half_open_count += 1
                    self._transition_to(CircuitState.HALF_OPEN)
            return self._state

    @property
    def name(self) -> str:
        return self._name

    def call(self, fn: Callable, *args, **kwargs):
        state = self.state
        if state == CircuitState.OPEN:
            raise CircuitBreakerOpenError(
                f"Circuit breaker '{self._name}' is OPEN. "
                f"Failure threshold: {self._failure_threshold}, "
                f"recovery timeout: {self._recovery_timeout}s"
            )
        try:
            result = fn(*args, **kwargs)
            self._on_success()
            return result
        except Exception as e:
            self._on_failure()
            raise

    def _on_success(self) -> None:
        with self._lock:
            self._total_calls += 1
            self._success_count += 1
            if self._state == CircuitState.HALF_OPEN:
                self._transition_to(CircuitState.CLOSED)
                self._failure_count = 0

    def _on_failure(self) -> None:
        with self._lock:
            self._total_calls += 1
            self._failure_count += 1
            self._last_failure_time = time.monotonic()
            if self._state == CircuitState.HALF_OPEN:
                self._transition_to(CircuitState.OPEN)
                self._open_count += 1
            elif self._state == CircuitState.CLOSED:
                if self._failure_count >= self._failure_threshold:
                    self._transition_to(CircuitState.OPEN)
                    self._open_count += 1

    @property
    def stats(self) -> CircuitBreakerStats:
        with self._lock:
            return CircuitBreakerStats(
                state=self._state.value,
                failure_count=self._failure_count,
                success_count=self._success_count,
                total_calls=self._total_calls,
                open_count=self._open_count,
                half_open_count=self._half_open_count,
            )

    def reset(self) -> None:
        with self._lock:
            self._state = CircuitState.CLOSED
            self._failure_count = 0
            self._success_count = 0
            self._total_calls = 0
            self._last_failure_time = 0.0


class CircuitBreakerOpenError(Exception):
    pass
