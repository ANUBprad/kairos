from __future__ import annotations

import time
from threading import Lock
from typing import Dict


class TokenBucket:
    def __init__(self, capacity: int, refill_rate: float) -> None:
        if capacity <= 0:
            raise ValueError("capacity must be positive")
        if refill_rate <= 0:
            raise ValueError("refill_rate must be positive")
        self._capacity = float(capacity)
        self._refill_rate = refill_rate
        self._tokens = self._capacity
        self._last_refill = time.monotonic()
        self._lock = Lock()

    def _refill(self) -> None:
        now = time.monotonic()
        elapsed = now - self._last_refill
        self._tokens = min(self._capacity, self._tokens + elapsed * self._refill_rate)
        self._last_refill = now

    def consume(self) -> bool:
        with self._lock:
            self._refill()
            if self._tokens >= 1.0:
                self._tokens -= 1.0
                return True
            return False

    @property
    def available_tokens(self) -> float:
        with self._lock:
            self._refill()
            return self._tokens

    @property
    def capacity(self) -> int:
        return int(self._capacity)


class TokenBucketStore:
    """Per-key token bucket store. Each unique key gets its own bucket."""

    def __init__(self, capacity: int, refill_rate: float) -> None:
        self._capacity = capacity
        self._refill_rate = refill_rate
        self._buckets: Dict[str, TokenBucket] = {}
        self._lock = Lock()
        self._last_cleanup = time.monotonic()
        self._cleanup_interval = 60.0  # Clean up stale buckets every 60 seconds

    def get_or_create(self, key: str) -> TokenBucket:
        with self._lock:
            self._maybe_cleanup()
            if key not in self._buckets:
                self._buckets[key] = TokenBucket(self._capacity, self._refill_rate)
            return self._buckets[key]

    def consume(self, key: str) -> bool:
        return self.get_or_create(key).consume()

    def _maybe_cleanup(self) -> None:
        """Remove stale buckets to prevent unbounded memory growth."""
        now = time.monotonic()
        if now - self._last_cleanup < self._cleanup_interval:
            return
        self._last_cleanup = now

        # Remove buckets that haven't been used in 5 minutes
        stale_threshold = now - 300.0
        stale_keys = [
            k for k, v in self._buckets.items()
            if v._last_refill < stale_threshold
        ]
        for k in stale_keys:
            del self._buckets[k]

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()
