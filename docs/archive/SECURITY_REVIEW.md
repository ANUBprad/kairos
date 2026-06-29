# Security Review

## Findings and Fixes

### Fixed Issues

| Issue | File | Fix |
|-------|------|-----|
| CORS allows `http://*` and `https://*` | `gateway/api/router.go` | Changed to `["*"]` with restricted header set |
| Grafana admin password hardcoded | `docker-compose.yml` | Now reads from `GRAFANA_PASSWORD` env var (default `admin`) |
| No `.env.example` file | Root | Created `.env.example` with all documented environment variables |
| Missing tracing header propagation | `gateway/middleware/tracing.go` | Implemented trace ID generation and propagation via `X-Trace-ID` header |

### Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| No TLS termination in docker-compose | High | All traffic in plaintext within Docker network. Add reverse proxy (nginx/Caddy) for production. |
| Insecure gRPC credentials | High | Uses `grpc.WithTransportCredentials(insecure.NewCredentials())`. Add TLS for production deployments. |
| `.env` not in `.gitignore` | Medium | Risk of accidental credential commit. Add `.env` to `.gitignore`. |
| Auth secret in environment variable | Medium | `KEIRO_SECRET` flows through env only. For higher security, integrate with a secrets manager (Vault, AWS Secrets Manager). |
| No input sanitization beyond namespace regex | Medium | Query strings and document content pass through unsanitized. Add content validation for production. |
| Health endpoint exposes internal state | Low | `GET /health` returns latency, cache size, hit rate. Acceptable for internal monitoring. |
| Error messages leaked in responses | Low | `RespondWithError` may leak internal details. Review for production hardening. |

## Authentication

| Layer | Method | Status |
|-------|--------|--------|
| API Gateway | `X-Secret` header with constant-time comparison | Implemented |
| FastAPI | `X-API-Key` header validation | Implemented |
| gRPC | No authentication (internal network) | Acceptable |

## Rate Limiting

| Layer | Algorithm | Status |
|-------|-----------|--------|
| Go Gateway | Token bucket per namespace | Implemented |
| FastAPI | Token bucket per IP | Implemented |
