from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


@dataclass
class MetricPoint:
    name: str
    value: float
    labels: Dict[str, str] = field(default_factory=dict)
    timestamp: Optional[float] = None


class MetricsRegistry:
    """In-memory registry for custom application metrics.

    Provides a simple interface for recording named metrics with labels,
    separate from the Prometheus instrumentation layer.
    """

    def __init__(self) -> None:
        self._points: List[MetricPoint] = []

    def record(self, name: str, value: float, labels: Optional[Dict[str, str]] = None) -> None:
        import time
        self._points.append(MetricPoint(
            name=name, value=value,
            labels=labels or {},
            timestamp=time.time(),
        ))

    def increment(self, name: str, labels: Optional[Dict[str, str]] = None) -> None:
        self.record(name, 1.0, labels)

    def query(
        self,
        name: Optional[str] = None,
        labels: Optional[Dict[str, str]] = None,
        limit: int = 1000,
    ) -> List[MetricPoint]:
        result = self._points
        if name:
            result = [p for p in result if p.name == name]
        if labels:
            for k, v in labels.items():
                result = [p for p in result if p.labels.get(k) == v]
        return result[-limit:]

    @property
    def point_count(self) -> int:
        return len(self._points)

    def clear(self) -> None:
        self._points.clear()

    def list_metrics(self) -> List[MetricPoint]:
        return list(self._points)

    def get_metric(self, name: str) -> Optional[MetricPoint]:
        for p in reversed(self._points):
            if p.name == name:
                return p
        return None

    @staticmethod
    def get_instance() -> MetricsRegistry:
        if not hasattr(MetricsRegistry, "_singleton"):
            MetricsRegistry._singleton = MetricsRegistry()
        return MetricsRegistry._singleton


_default_registry = MetricsRegistry()


def get_metrics_registry() -> MetricsRegistry:
    return _default_registry
