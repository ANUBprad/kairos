from __future__ import annotations

import time
from collections import OrderedDict
from dataclasses import dataclass, field
from threading import RLock
from typing import Callable, Optional


@dataclass
class CacheStats:
    hits: int = 0
    misses: int = 0
    size: int = 0
    maxsize: int = 0


@dataclass
class EmbeddingCache:
    maxsize: int = 4096
    ttl_seconds: int = 300

    _cache: OrderedDict[str, tuple[float, list[float]]] = field(
        default_factory=OrderedDict, repr=False
    )
    _lock: RLock = field(default_factory=RLock, repr=False)
    _hits: int = 0
    _misses: int = 0
    on_hit: Optional[Callable[[], None]] = field(
        default=None, compare=False, repr=False
    )
    on_miss: Optional[Callable[[], None]] = field(
        default=None, compare=False, repr=False
    )

    def get(self, key: str) -> list[float] | None:
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                if self.on_miss:
                    self.on_miss()
                return None
            timestamp, value = self._cache[key]
            if self.ttl_seconds > 0 and time.monotonic() - timestamp > self.ttl_seconds:
                del self._cache[key]
                self._misses += 1
                if self.on_miss:
                    self.on_miss()
                return None
            self._cache.move_to_end(key)
            self._hits += 1
            if self.on_hit:
                self.on_hit()
            return value

    def set(self, key: str, value: list[float]) -> None:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
            elif len(self._cache) >= self.maxsize:
                self._cache.popitem(last=False)
            self._cache[key] = (time.monotonic(), value)

    @property
    def stats(self) -> CacheStats:
        with self._lock:
            return CacheStats(
                hits=self._hits,
                misses=self._misses,
                size=len(self._cache),
                maxsize=self.maxsize,
            )

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0

    @property
    def hit_rate(self) -> float:
        s = self.stats
        total = s.hits + s.misses
        if total == 0:
            return 0.0
        return s.hits / total
