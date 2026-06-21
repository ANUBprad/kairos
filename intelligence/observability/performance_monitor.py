from __future__ import annotations

import math
import threading
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Callable, Dict, List, Optional


@dataclass
class LatencySnapshot:
    p50: float = 0.0
    p95: float = 0.0
    p99: float = 0.0
    mean: float = 0.0
    min: float = 0.0
    max: float = 0.0
    count: int = 0


@dataclass
class PerformanceSnapshot:
    success_rate: float = 0.0
    failure_rate: float = 0.0
    total_requests: int = 0
    latency: LatencySnapshot = field(default_factory=LatencySnapshot)
    throughput_rps: float = 0.0


class PerformanceMonitor:
    """Tracks latency distributions, success/failure rates, and throughput.

    Thread-safe. Maintains a sliding window of observations.
    """

    def __init__(self, window_size: int = 1000) -> None:
        self._window_size = window_size
        self._lock = threading.Lock()
        self._latencies: List[float] = []
        self._successes: int = 0
        self._failures: int = 0
        self._total: int = 0
        self._timestamps: deque = deque(maxlen=window_size)

    def record_request(self, latency_ms: float, success: bool) -> None:
        with self._lock:
            self._latencies.append(latency_ms)
            if len(self._latencies) > self._window_size:
                self._latencies = self._latencies[-self._window_size:]
            if success:
                self._successes += 1
            else:
                self._failures += 1
            self._total += 1
            self._timestamps.append(time.time())

    def record_latency(self, latency_ms: float) -> None:
        with self._lock:
            self._latencies.append(latency_ms)
            if len(self._latencies) > self._window_size:
                self._latencies = self._latencies[-self._window_size:]

    def record_success(self) -> None:
        with self._lock:
            self._successes += 1
            self._total += 1

    def record_failure(self) -> None:
        with self._lock:
            self._failures += 1
            self._total += 1

    def snapshot(self) -> PerformanceSnapshot:
        with self._lock:
            total = self._total
            successes = self._successes
            failures = self._failures
            latencies = list(self._latencies)
            timestamps = list(self._timestamps)

        success_rate = successes / total if total > 0 else 0.0
        failure_rate = failures / total if total > 0 else 0.0

        ls = self._compute_latency_stats(latencies)

        # Throughput (requests per second over window)
        throughput = 0.0
        if len(timestamps) >= 2:
            span = timestamps[-1] - timestamps[0]
            if span > 0:
                throughput = len(timestamps) / span

        return PerformanceSnapshot(
            success_rate=success_rate,
            failure_rate=failure_rate,
            total_requests=total,
            latency=ls,
            throughput_rps=throughput,
        )

    def _compute_latency_stats(self, latencies: List[float]) -> LatencySnapshot:
        if not latencies:
            return LatencySnapshot()
        sorted_lats = sorted(latencies)
        n = len(sorted_lats)
        return LatencySnapshot(
            p50=self._percentile(sorted_lats, 50),
            p95=self._percentile(sorted_lats, 95),
            p99=self._percentile(sorted_lats, 99),
            mean=sum(sorted_lats) / n,
            min=sorted_lats[0],
            max=sorted_lats[-1],
            count=n,
        )

    @staticmethod
    def _percentile(sorted_data: List[float], percentile: float) -> float:
        if not sorted_data:
            return 0.0
        k = (percentile / 100.0) * (len(sorted_data) - 1)
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return sorted_data[int(k)]
        return sorted_data[f] * (c - k) + sorted_data[c] * (k - f)


_default_monitor = PerformanceMonitor()


def get_monitor() -> PerformanceMonitor:
    return _default_monitor
