"""Production-grade LRU retrieval cache with automatic invalidation and metrics."""

from __future__ import annotations

import hashlib
import json
import logging
import time
from collections import OrderedDict
from dataclasses import dataclass, field
from threading import RLock
from typing import Callable, Optional

logger = logging.getLogger(__name__)


@dataclass
class CacheMetrics:
    hits: int = 0
    misses: int = 0
    evictions: int = 0
    invalidations: int = 0

    @property
    def total(self) -> int:
        return self.hits + self.misses

    @property
    def hit_ratio(self) -> float:
        return self.hits / self.total if self.total > 0 else 0.0

    def to_dict(self) -> dict:
        return {
            "hits": self.hits,
            "misses": self.misses,
            "evictions": self.evictions,
            "invalidations": self.invalidations,
            "hit_ratio": round(self.hit_ratio, 4),
            "total": self.total,
        }


class RetrievalCache:
    """LRU cache for retrieval results with TTL, namespace isolation, and metrics."""

    def __init__(
        self,
        maxsize: int = 256,
        ttl_seconds: int = 300,
        on_hit: Optional[Callable[[], None]] = None,
        on_miss: Optional[Callable[[], None]] = None,
    ):
        self._maxsize = maxsize
        self._ttl = ttl_seconds
        self._cache: OrderedDict[str, tuple[list[str], float, str]] = OrderedDict()
        self._lock = RLock()
        self._metrics = CacheMetrics()
        self._on_hit = on_hit
        self._on_miss = on_miss
        self._version_map: dict[str, int] = {}

    def _make_key(
        self,
        namespace: str,
        query: str,
        top_k: int,
        retrieval_type: int,
        rerank: bool,
        decompose: bool,
    ) -> str:
        raw = f"{namespace}:{query}:{top_k}:{retrieval_type}:{rerank}:{decompose}"
        return hashlib.sha256(raw.encode()).hexdigest()[:32]

    def get(
        self,
        namespace: str,
        query: str,
        top_k: int,
        retrieval_type: int,
        rerank: bool,
        decompose: bool,
    ) -> list[str] | None:
        key = self._make_key(namespace, query, top_k, retrieval_type, rerank, decompose)

        with self._lock:
            if key in self._cache:
                chunks, ts, _ = self._cache[key]
                if time.monotonic() - ts < self._ttl:
                    self._cache.move_to_end(key)
                    self._metrics.hits += 1
                    if self._on_hit:
                        self._on_hit()
                    logger.debug("Cache hit key=%s", key)
                    return chunks
                else:
                    del self._cache[key]
                    self._metrics.evictions += 1

            self._metrics.misses += 1
            if self._on_miss:
                self._on_miss()
            return None

    def put(
        self,
        namespace: str,
        query: str,
        top_k: int,
        retrieval_type: int,
        rerank: bool,
        decompose: bool,
        chunks: list[str],
    ) -> None:
        key = self._make_key(namespace, query, top_k, retrieval_type, rerank, decompose)

        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)

            self._cache[key] = (chunks, time.monotonic(), namespace)

            while len(self._cache) > self._maxsize:
                self._cache.popitem(last=False)
                self._metrics.evictions += 1

    def invalidate_namespace(self, namespace: str) -> int:
        """Invalidate all cached entries for a namespace."""
        count = 0

        with self._lock:
            keys_to_remove = [
                k for k, v in self._cache.items()
                if v[2] == namespace
            ]
            for key in keys_to_remove:
                del self._cache[key]
                count += 1
                self._metrics.invalidations += 1

        if count > 0:
            logger.info("Invalidated %d cache entries for namespace=%s", count, namespace)
        return count

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self._metrics = CacheMetrics()

    def stats(self) -> dict:
        with self._lock:
            return {
                "size": len(self._cache),
                "maxsize": self._maxsize,
                "ttl_seconds": self._ttl,
                **self._metrics.to_dict(),
            }
