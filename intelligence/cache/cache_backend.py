"""Cache statistics for monitoring."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class CacheStats:
    """Cache statistics for monitoring."""

    hits: int = 0
    misses: int = 0
    size: int = 0
    maxsize: int = 0
    backend: str = "unknown"
