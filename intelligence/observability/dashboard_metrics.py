from __future__ import annotations

from typing import Dict, List, Optional

from intelligence.observability.alerting import AlertManager
from intelligence.observability.event_logger import Event, EventLogger
from intelligence.observability.metrics_registry import MetricsRegistry
from intelligence.observability.performance_monitor import PerformanceMonitor, PerformanceSnapshot


class DashboardMetricsCollector:
    _instance: DashboardMetricsCollector | None = None

    @staticmethod
    def get_instance() -> DashboardMetricsCollector:
        if DashboardMetricsCollector._instance is None:
            DashboardMetricsCollector._instance = DashboardMetricsCollector(
                monitor=PerformanceMonitor.get_instance(),
                registry=MetricsRegistry.get_instance(),
                alert_manager=AlertManager.get_instance(),
            )
        return DashboardMetricsCollector._instance

    def __init__(
        self,
        monitor: Optional[PerformanceMonitor] = None,
        logger: Optional[EventLogger] = None,
        registry: Optional[MetricsRegistry] = None,
        alert_manager: Optional[AlertManager] = None,
    ):
        self._monitor = monitor
        self._logger = logger
        self._registry = registry
        self._alert_manager = alert_manager

    def collect_system_overview(self) -> Dict[str, object]:
        perf = self._monitor.snapshot() if self._monitor else None
        alerts = self._alert_manager.alerts if self._alert_manager else []

        result: Dict[str, object] = {
            "performance": {
                "total_requests": perf.total_requests if perf else 0,
                "success_rate": perf.success_rate if perf else 0.0,
                "failure_rate": perf.failure_rate if perf else 0.0,
                "throughput_rps": perf.throughput_rps if perf else 0.0,
            },
            "latency": {
                "p50_ms": perf.latency.p50 if perf else 0.0,
                "p95_ms": perf.latency.p95 if perf else 0.0,
                "p99_ms": perf.latency.p99 if perf else 0.0,
                "mean_ms": perf.latency.mean if perf else 0.0,
            },
            "events": {
                "pending": self._logger.pending_count if self._logger else 0,
            },
            "metrics": {
                "points": self._registry.point_count if self._registry else 0,
            },
            "alerts": {
                "total": len(alerts),
                "critical": sum(1 for a in alerts if a.severity == "critical"),
                "warning": sum(1 for a in alerts if a.severity == "warning"),
                "recent": [a.to_dict() for a in alerts[-10:]],
            },
        }
        return result

    def collect_latency_distribution(self) -> Dict[str, object]:
        if not self._monitor:
            return {}
        snap = self._monitor.snapshot()
        return {
            "p50": snap.latency.p50,
            "p95": snap.latency.p95,
            "p99": snap.latency.p99,
            "mean": snap.latency.mean,
            "min": snap.latency.min,
            "max": snap.latency.max,
            "count": snap.latency.count,
        }

    def collect_event_summary(self) -> Dict[str, object]:
        if not self._logger:
            return {}
        events = self._logger.flush()
        by_type: Dict[str, int] = {}
        for ev in events:
            by_type[ev.event_type] = by_type.get(ev.event_type, 0) + 1
        return {
            "total": len(events),
            "by_type": by_type,
        }
