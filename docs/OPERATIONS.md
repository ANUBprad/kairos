# Operations Guide

## Service Health

All services expose health endpoints:

| Service | Endpoint | Type |
|---------|----------|------|
| Go Gateway | `GET /health` | HTTP |
| Intelligence | gRPC Health Protocol | gRPC |
| Management API | `GET /health` `/health/ready` `/health/live` | HTTP |

## Logging

- Default level: INFO (configurable via `KEIRO_LOG_LEVEL`)
- Structured JSON logs in production
- Log rotation handled by Docker

## Monitoring

### Prometheus Metrics

Available at `:9090` when running via docker-compose.

Key metrics:
- Request latency (p50/p95/p99)
- Throughput (requests/sec)
- Cache hit/miss rates
- Circuit breaker state
- Service health status

### Grafana

Pre-configured dashboards at `:3000`.
Default credentials: admin / admin.

## Alerting

Built-in alert rules:
- **LatencyAlertRule**: fires when request latency exceeds threshold
- **FailureRateAlertRule**: fires when failure rate exceeds threshold
- **DegradedRecallAlertRule**: fires when recall drops below threshold

Alerts have configurable cooldown periods to prevent notification storms.

## Backup

Key directories to back up:
- `./chroma_data/` -- Vector store data
- `./models/` -- Model registry
- `./experiments/` -- Experiment registry
- `./reports/` -- Generated reports

## Scaling

- Intelligence service uses gRPC with configurable thread pool
- API service supports multiple workers (`KEIRO_API_WORKERS`)
- ChromaDB runs as a separate container for independent scaling
- Gateway is stateless and can be horizontally scaled

## Troubleshooting

### Service won't start
Run `python scripts/validate.py` to check configuration.

### Tests failing
Ensure all dependencies are installed: `pip install -r requirements.txt`

### Docker build fails
Check Docker version and available resources. Run `docker compose build --no-cache` for a clean build.
