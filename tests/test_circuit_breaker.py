from __future__ import annotations

import time
from unittest.mock import MagicMock

import pytest

from intelligence.circuit_breaker.circuit_breaker import (
    CircuitBreaker,
    CircuitBreakerOpenError,
    CircuitState,
)


def _wait_for_state(
    cb: CircuitBreaker,
    expected: CircuitState,
    timeout: float = 0.2,
    pause: float = 0.01,
) -> None:
    """Poll *cb.state* until it reaches *expected*.

    Replaces a fixed ``sleep`` + single assertion pattern that is flaky
    on Windows where ``time.sleep`` granularity is ~15.6 ms.
    """
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if cb.state == expected:
            return
        time.sleep(pause)
    assert cb.state == expected


class TestCircuitBreakerInitialState:
    def test_initial_state_is_closed(self) -> None:
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED

    def test_initial_stats(self) -> None:
        cb = CircuitBreaker()
        s = cb.stats
        assert s.state == "CLOSED"
        assert s.failure_count == 0
        assert s.success_count == 0
        assert s.total_calls == 0

    def test_custom_threshold_and_timeout(self) -> None:
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=10.0, name="test")
        assert cb.name == "test"
        assert cb._failure_threshold == 3
        assert cb._recovery_timeout == 10.0


class TestCircuitBreakerCall:
    def test_successful_call_returns_result(self) -> None:
        cb = CircuitBreaker()
        result = cb.call(lambda: 42)
        assert result == 42

    def test_successful_call_increments_success(self) -> None:
        cb = CircuitBreaker()
        cb.call(lambda: 1)
        assert cb.stats.success_count == 1
        assert cb.stats.total_calls == 1

    def test_failed_call_raises(self) -> None:
        cb = CircuitBreaker()
        with pytest.raises(ValueError):
            cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")))

    def test_failed_call_increments_failure(self) -> None:
        cb = CircuitBreaker()
        try:
            cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")))
        except ValueError:
            pass
        assert cb.stats.failure_count == 1
        assert cb.stats.total_calls == 1

    def test_opens_after_threshold(self) -> None:
        cb = CircuitBreaker(failure_threshold=3, recovery_timeout=60.0)
        for _ in range(3):
            try:
                cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")))
            except ValueError:
                pass
        assert cb.state == CircuitState.OPEN
        assert cb.stats.open_count == 1

    def test_open_state_fails_fast(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60.0)
        try:
            cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")))
        except ValueError:
            pass
        with pytest.raises(CircuitBreakerOpenError):
            cb.call(lambda: "should not reach")

    def test_half_open_on_success_becomes_closed(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.05)
        try:
            cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")))
        except ValueError:
            pass
        assert cb.state == CircuitState.OPEN
        _wait_for_state(cb, CircuitState.HALF_OPEN)
        result = cb.call(lambda: "ok")
        assert result == "ok"
        assert cb.state == CircuitState.CLOSED
        assert cb._failure_count == 0

    def test_half_open_on_failure_reopens(self) -> None:
        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=0.05)
        try:
            cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")))
        except ValueError:
            pass
        try:
            cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")))
        except ValueError:
            pass
        assert cb.state == CircuitState.OPEN
        _wait_for_state(cb, CircuitState.HALF_OPEN)
        with pytest.raises(ValueError):
            cb.call(lambda: (_ for _ in ()).throw(ValueError("fail still")))
        assert cb.state == CircuitState.OPEN

    def test_reset_clears_state(self) -> None:
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=60.0)
        try:
            cb.call(lambda: (_ for _ in ()).throw(ValueError("fail")))
        except ValueError:
            pass
        assert cb.state == CircuitState.OPEN
        cb.reset()
        assert cb.state == CircuitState.CLOSED
        assert cb.stats.failure_count == 0
        assert cb.stats.total_calls == 0

    def test_concurrent_calls(self) -> None:
        import threading

        cb = CircuitBreaker(failure_threshold=2, recovery_timeout=60.0)
        errors: list[Exception] = []

        def worker() -> None:
            try:
                cb.call(lambda: 1)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        assert len(errors) == 0
        assert cb.stats.success_count == 10


class TestCircuitBreakerConfig:
    def test_timeout_config_default(self) -> None:
        from intelligence.server.config import ServerConfig

        cfg = ServerConfig.from_env()
        assert cfg.provider_timeout_seconds == 30.0
        assert cfg.circuit_breaker_failure_threshold == 5
        assert cfg.circuit_breaker_recovery_timeout == 30.0

    def test_timeout_config_from_env(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("KAIROS_PROVIDER_TIMEOUT_SECONDS", "15.0")
        monkeypatch.setenv("KAIROS_CIRCUIT_BREAKER_FAILURE_THRESHOLD", "3")
        monkeypatch.setenv("KAIROS_CIRCUIT_BREAKER_RECOVERY_TIMEOUT", "10.0")
        from intelligence.server.config import ServerConfig

        cfg = ServerConfig.from_env()
        assert cfg.provider_timeout_seconds == 15.0
        assert cfg.circuit_breaker_failure_threshold == 3
        assert cfg.circuit_breaker_recovery_timeout == 10.0

    def test_circuit_breaker_with_mock_function(self) -> None:
        cb = CircuitBreaker(failure_threshold=2)
        fn = MagicMock(return_value="ok")
        result = cb.call(fn)
        assert result == "ok"
        fn.assert_called_once()
