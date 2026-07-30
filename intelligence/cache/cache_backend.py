"""Cache abstraction interface for pluggable cache backends.

Provides a unified interface for cache operations with support for:
- MemoryCacheBackend: In-memory LRU cache (default, no external dependencies)
- RedisCacheBackend: Redis-backed cache (requires redis package, graceful degradation)

Usage:
    from intelligence.cache.cache_backend import CacheBackend, get_cache_backend

    cache = get_cache_backend()  # Returns configured backend
    cache.set("key", value, ttl=300)
    result = cache.get("key")
"""

from __future__ import annotations

import json
import logging
import time
from abc import ABC, abstractmethod
from collections import OrderedDict
from dataclasses import dataclass
from threading import RLock
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class CacheStats:
    """Cache statistics for monitoring."""
    hits: int = 0
    misses: int = 0
    size: int = 0
    maxsize: int = 0
    backend: str = "unknown"


class CacheBackend(ABC):
    """Abstract cache backend interface.

    All cache backends must implement these methods. The interface supports
    both simple key-value operations and typed operations for common use cases.
    """

    @abstractmethod
    def get(self, key: str) -> Any | None:
        """Get a value from cache.

        Args:
            key: Cache key

        Returns:
            Cached value or None if not found/expired
        """
        ...

    @abstractmethod
    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """Set a value in cache.

        Args:
            key: Cache key
            value: Value to cache
            ttl: Time-to-live in seconds (None = use default)
        """
        ...

    @abstractmethod
    def delete(self, key: str) -> bool:
        """Delete a key from cache.

        Args:
            key: Cache key

        Returns:
            True if key was deleted, False if not found
        """
        ...

    @abstractmethod
    def exists(self, key: str) -> bool:
        """Check if a key exists in cache.

        Args:
            key: Cache key

        Returns:
            True if key exists and is not expired
        """
        ...

    @abstractmethod
    def clear(self) -> None:
        """Clear all entries from cache."""
        ...

    @abstractmethod
    def get_many(self, keys: list[str]) -> dict[str, Any]:
        """Get multiple values from cache.

        Args:
            keys: List of cache keys

        Returns:
            Dict of key -> value for found entries
        """
        ...

    @abstractmethod
    def set_many(self, mapping: dict[str, Any], ttl: Optional[int] = None) -> None:
        """Set multiple values in cache.

        Args:
            mapping: Dict of key -> value to cache
            ttl: Time-to-live in seconds (None = use default)
        """
        ...

    @property
    @abstractmethod
    def stats(self) -> CacheStats:
        """Get cache statistics."""
        ...

    @property
    @abstractmethod
    def hit_rate(self) -> float:
        """Get cache hit rate (0.0 - 1.0)."""
        ...


class MemoryCacheBackend(CacheBackend):
    """In-memory LRU cache with TTL support.

    Thread-safe implementation using OrderedDict and RLock.
    This is the default backend with no external dependencies.
    """

    def __init__(self, maxsize: int = 4096, ttl_seconds: int = 300):
        self._maxsize = maxsize
        self._ttl_seconds = ttl_seconds
        self._cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = RLock()
        self._hits = 0
        self._misses = 0

    def get(self, key: str) -> Any | None:
        with self._lock:
            if key not in self._cache:
                self._misses += 1
                return None
            timestamp, value = self._cache[key]
            if self._ttl_seconds > 0 and time.monotonic() - timestamp > self._ttl_seconds:
                del self._cache[key]
                self._misses += 1
                return None
            self._cache.move_to_end(key)
            self._hits += 1
            return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
            elif len(self._cache) >= self._maxsize:
                self._cache.popitem(last=False)
            self._cache[key] = (time.monotonic(), value)

    def delete(self, key: str) -> bool:
        with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    def exists(self, key: str) -> bool:
        with self._lock:
            if key not in self._cache:
                return False
            timestamp, _ = self._cache[key]
            if self._ttl_seconds > 0 and time.monotonic() - timestamp > self._ttl_seconds:
                del self._cache[key]
                return False
            return True

    def clear(self) -> None:
        with self._lock:
            self._cache.clear()
            self._hits = 0
            self._misses = 0

    def get_many(self, keys: list[str]) -> dict[str, Any]:
        result = {}
        for key in keys:
            value = self.get(key)
            if value is not None:
                result[key] = value
        return result

    def set_many(self, mapping: dict[str, Any], ttl: Optional[int] = None) -> None:
        for key, value in mapping.items():
            self.set(key, value, ttl)

    @property
    def stats(self) -> CacheStats:
        with self._lock:
            return CacheStats(
                hits=self._hits,
                misses=self._misses,
                size=len(self._cache),
                maxsize=self._maxsize,
                backend="memory",
            )

    @property
    def hit_rate(self) -> float:
        total = self._hits + self._misses
        if total == 0:
            return 0.0
        return self._hits / total


class RedisCacheBackend(CacheBackend):
    """Redis-backed cache with TTL support.

    Requires the redis package. Falls back gracefully if Redis is unavailable.
    """

    def __init__(self, url: str = "redis://localhost:6379", prefix: str = "kairos:", default_ttl: int = 300):
        self._url = url
        self._prefix = prefix
        self._default_ttl = default_ttl
        self._client = None
        self._available = False
        self._hits = 0
        self._misses = 0

        try:
            import redis
            self._client = redis.from_url(url, decode_responses=True, socket_timeout=5)
            # Test connection
            self._client.ping()
            self._available = True
            logger.info("Redis cache backend connected: %s", url)
        except ImportError:
            logger.warning("redis package not installed, RedisCacheBackend unavailable")
        except Exception as e:
            logger.warning("Redis connection failed: %s, falling back to memory", e)

    def _key(self, key: str) -> str:
        return f"{self._prefix}{key}"

    def get(self, key: str) -> Any | None:
        if not self._available:
            self._misses += 1
            return None
        try:
            data = self._client.get(self._key(key))
            if data is None:
                self._misses += 1
                return None
            self._hits += 1
            return json.loads(data)
        except Exception as e:
            logger.warning("Redis get failed: %s", e)
            self._misses += 1
            return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        if not self._available:
            return
        try:
            ttl = ttl or self._default_ttl
            data = json.dumps(value)
            self._client.setex(self._key(key), ttl, data)
        except Exception as e:
            logger.warning("Redis set failed: %s", e)

    def delete(self, key: str) -> bool:
        if not self._available:
            return False
        try:
            return bool(self._client.delete(self._key(key)))
        except Exception as e:
            logger.warning("Redis delete failed: %s", e)
            return False

    def exists(self, key: str) -> bool:
        if not self._available:
            return False
        try:
            return bool(self._client.exists(self._key(key)))
        except Exception as e:
            logger.warning("Redis exists failed: %s", e)
            return False

    def clear(self) -> None:
        if not self._available:
            return
        try:
            keys = self._client.keys(f"{self._prefix}*")
            if keys:
                self._client.delete(*keys)
            self._hits = 0
            self._misses = 0
        except Exception as e:
            logger.warning("Redis clear failed: %s", e)

    def get_many(self, keys: list[str]) -> dict[str, Any]:
        if not self._available:
            return {}
        try:
            redis_keys = [self._key(k) for k in keys]
            values = self._client.mget(redis_keys)
            result = {}
            for key, value in zip(keys, values):
                if value is not None:
                    result[key] = json.loads(value)
                    self._hits += 1
                else:
                    self._misses += 1
            return result
        except Exception as e:
            logger.warning("Redis get_many failed: %s", e)
            return {}

    def set_many(self, mapping: dict[str, Any], ttl: Optional[int] = None) -> None:
        if not self._available:
            return
        try:
            ttl = ttl or self._default_ttl
            pipe = self._client.pipeline()
            for key, value in mapping.items():
                pipe.setex(self._key(key), ttl, json.dumps(value))
            pipe.execute()
        except Exception as e:
            logger.warning("Redis set_many failed: %s", e)

    @property
    def stats(self) -> CacheStats:
        return CacheStats(
            hits=self._hits,
            misses=self._misses,
            size=0,  # Redis doesn't easily expose this
            maxsize=0,
            backend="redis" if self._available else "redis_unavailable",
        )

    @property
    def hit_rate(self) -> float:
        total = self._hits + self._misses
        if total == 0:
            return 0.0
        return self._hits / total


# Global cache instance
_cache_backend: Optional[CacheBackend] = None


def get_cache_backend(backend: Optional[str] = None, **kwargs) -> CacheBackend:
    """Get or create the cache backend singleton.

    Args:
        backend: Backend type ("memory", "redis", or None for auto)
        **kwargs: Backend-specific configuration

    Returns:
        Configured cache backend
    """
    global _cache_backend

    if _cache_backend is not None:
        return _cache_backend

    if backend == "redis":
        url = kwargs.get("url", "redis://localhost:6379")
        prefix = kwargs.get("prefix", "kairos:")
        default_ttl = kwargs.get("default_ttl", 300)
        _cache_backend = RedisCacheBackend(url=url, prefix=prefix, default_ttl=default_ttl)
    else:
        maxsize = kwargs.get("maxsize", 4096)
        ttl_seconds = kwargs.get("ttl_seconds", 300)
        _cache_backend = MemoryCacheBackend(maxsize=maxsize, ttl_seconds=ttl_seconds)

    logger.info("Cache backend initialized: %s", type(_cache_backend).__name__)
    return _cache_backend


def reset_cache_backend() -> None:
    """Reset the cache backend singleton (for testing)."""
    global _cache_backend
    if _cache_backend is not None:
        _cache_backend.clear()
    _cache_backend = None
