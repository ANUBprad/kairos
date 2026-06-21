# Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Git
- 4 GB RAM minimum (8 GB recommended)
- Python 3.11+ (for local development)

## Quick Start

```bash
git clone https://github.com/yourusername/keiro.git
cd keiro
cp .env.example .env
# edit .env -- set KEIRO_SECRET at minimum
docker compose up
```

This starts the full stack:

| Service | Port | Description |
|---------|------|-------------|
| Go Gateway | 8080 | API gateway, auth, rate limiting |
| Intelligence | 28080 | gRPC intelligence service |
| Management API | 8000 | FastAPI management endpoints |
| Dashboard | 8501 | Streamlit research dashboard |
| ChromaDB | 7777 | Vector store |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3000 | Dashboards |
| Worker | - | Background task processor |

## Environment Profiles

Set `KEIRO_ENVIRONMENT` to one of:

- `development` (default) -- DEBUG logging, relaxed rate limits, docs enabled
- `staging` -- INFO logging, moderate rate limits, docs enabled
- `production` -- WARNING logging, strict rate limits, docs disabled

## Configuration

All configuration is via environment variables prefixed with `KEIRO_`.
See `intelligence/config/settings.py` for the full list.

## Building for Production

```bash
# Validate configuration
python scripts/validate.py

# Run tests
python scripts/release.py --execute

# Build Docker images
docker compose build
```

## Production Considerations

1. Set `KEIRO_ENVIRONMENT=production` and `KEIRO_DEPLOYMENT=True`
2. Use a secrets manager for API keys (not plain env vars)
3. Configure PostgreSQL or S3 for ChromaDB persistence
4. Set up reverse proxy (nginx/traefik) with TLS termination
5. Configure Prometheus alertmanager for production alerting
6. Use tagged Docker images with semantic versions
7. Enable health checks on all services
