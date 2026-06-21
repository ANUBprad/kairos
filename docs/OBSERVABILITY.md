# Observability

## Components

### Tracing (`intelligence/observability/tracing.py`)

Lightweight distributed tracer supporting nested spans with correlation IDs.

```python
from intelligence.observability.tracing import Tracer

tracer = Tracer()
with tracer.trace("query.retrieve") as span:
    with tracer.trace("embedding.compute"):
        pass
```

### Event Logger (`intelligence/observability/event_logger.py`)

Structured event logging with configurable sinks (console, file).

```python
from intelligence.observability.event_logger import EventLogger, console_sink

logger = EventLogger()
logger.add_sink(console_sink)
logger.info("query.processed", query_id="abc-123", latency_ms=45.2)
```

### Performance Monitor (`intelligence/observability/performance_monitor.py`)

Latency histograms with p50/p95/p99, throughput tracking, success/failure rates.

```python
from intelligence.observability.performance_monitor import PerformanceMonitor

monitor = PerformanceMonitor()
monitor.record_request(latency_ms=120.5, success=True)
snapshot = monitor.snapshot()
print(f"p95: {snapshot.latency_snapshot.p95_ms}ms")
```

### Alerting (`intelligence/observability/alerting.py`)

Rule-based alerting with cooldown periods to prevent storms.

Rules: `LatencyAlertRule`, `FailureRateAlertRule`, `DegradedRecallAlertRule`

```python
from intelligence.observability.alerting import AlertManager, LatencyAlertRule

manager = AlertManager()
manager.add_rule(LatencyAlertRule(threshold_ms=500.0))
```

### Metrics Registry (`intelligence/observability/metrics_registry.py`)

In-memory labeled metric point registry for custom application metrics.

### Dashboard Metrics (`intelligence/observability/dashboard_metrics.py`)

Aggregates data from all observability components into dashboard-ready snapshots.

## Management API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/observability/metrics` | List all metrics |
| GET | `/api/v1/observability/metrics/{name}` | Get specific metric |
| GET | `/api/v1/observability/performance` | Performance snapshot |
| GET | `/api/v1/observability/alerts` | List active alerts |
| GET | `/api/v1/observability/dashboard` | Dashboard aggregate |

## External Monitoring

- Prometheus: metrics at `:9090`
- Grafana: dashboards at `:3000`
- Management API health: `GET /health`
