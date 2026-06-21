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

    def consume(self, key: str = "") -> bool:
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
    def __init__(self, capacity: int, refill_rate: float) -> None:
        self._capacity = capacity
        self._refill_rate = refill_rate
        self._buckets: Dict[str, TokenBucket] = {}
        self._lock = Lock()

    def get_or_create(self, key: str) -> TokenBucket:
        with self._lock:
            if key not in self._buckets:
                self._buckets[key] = TokenBucket(self._capacity, self._refill_rate)
            return self._buckets[key]

    def consume(self, key: str) -> bool:
        return self.get_or_create(key).consume()

    def clear(self) -> None:
        with self._lock:
            self._buckets.clear()
