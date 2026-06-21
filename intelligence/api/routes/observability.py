from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException

from intelligence.observability.metrics_registry import MetricsRegistry
from intelligence.observability.performance_monitor import PerformanceMonitor, LatencySnapshot
from intelligence.observability.alerting import AlertManager
from intelligence.observability.dashboard_metrics import DashboardMetricsCollector

router = APIRouter()


@router.get("/metrics")
async def list_metrics() -> List[Dict[str, object]]:
    registry = MetricsRegistry.get_instance()
    return [m.to_dict() for m in registry.list_metrics()]


@router.get("/metrics/{name}")
async def get_metric(name: str) -> Dict[str, object]:
    registry = MetricsRegistry.get_instance()
    metric = registry.get_metric(name)
    if metric is None:
        raise HTTPException(status_code=404, detail=f"Metric '{name}' not found")
    return metric.to_dict()


@router.get("/performance")
async def get_performance() -> Dict[str, object]:
    monitor = PerformanceMonitor.get_instance()
    snapshot = monitor.snapshot()
    return {
        "total_requests": snapshot.total_requests,
        "success_count": int(snapshot.total_requests * snapshot.success_rate),
        "failure_count": int(snapshot.total_requests * snapshot.failure_rate),
        "latency_p50_ms": snapshot.latency.p50,
        "latency_p95_ms": snapshot.latency.p95,
        "latency_p99_ms": snapshot.latency.p99,
        "throughput_rps": snapshot.throughput_rps,
    }


@router.get("/alerts")
async def list_alerts() -> list[Dict[str, object]]:
    manager = AlertManager.get_instance()
    return [a.to_dict() for a in manager.alerts]


@router.get("/dashboard")
async def get_dashboard_snapshot() -> Dict[str, object]:
    collector = DashboardMetricsCollector.get_instance()
    overview = collector.collect_system_overview()
    return {
        "performance": overview,
        "healthy": True,
    }
