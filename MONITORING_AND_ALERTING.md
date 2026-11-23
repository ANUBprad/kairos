# Monitoring and alerting (Kairos / Phase 06)

Status: **IMPLEMENTED — LIVE VALIDATION REQUIRED** for owner-configured
dashboards/alerts. The in-application signals listed below were verified
locally; no Render dashboard, external log sink, pager, production service or
real customer telemetry was accessed.

## 1. Signals that already exist in the application

| Signal | Source | Meaning / limit |
| --- | --- | --- |
| `GET /healthz` | `server/src/app.ts` | Pure liveness (`{ status, uptime }`). No DB/provider query. This is the correct Render health check. |
| `GET /health` | `server/src/app.ts` + `services/health.services.ts` | Readiness/diagnostics: `SELECT 1` on PostgreSQL (5 s timeout) and optional Pinecone `describeIndex`; returns 503 when degraded. Throttled to 30 requests/minute per client key so it cannot be used as a dependency-probe amplifier. |
| Structured JSON logs | `server/src/lib/logger.ts` | `info`/`warn`/`error` records with timestamp and recursive redaction of secrets, tokens, cookies, signatures and stack traces. No provider secret should ever be logged. |
| `chat_request_metrics` logs | `chat.services.ts`, `lib/observability/request-metrics.ts` | Per-request stage timings (embed, Pinecone, rerank, Mem0, Tavily, LLM stream, total), token counts, rerank calls and embedding-cache hit flag. Also persisted in `message_metrics` where applicable. |
| Durable job state | `durable_job` table, `lib/outbox.ts`, `lib/job-sweeper.ts` | `PENDING → PROCESSING → DELIVERED | DEAD`, bounded 50-job sweeps, stale lease recovery and exactly-one-compensating-refund on terminal `DEAD`. |
| Payment/credit ledger | `payment_record`, `credit_transaction` | Settlement idempotency and server-owned pricing; suitable for duplicate-charge/refund anomaly checks. |
| Rate-limit headers | `express-rate-limit` | `RateLimit-*` headers on JSON/auth endpoints; useful for detecting spoofed-proxy or abuse patterns. |
| Dependency gate | `.github/workflows/ci.yml` | `dependency-security` job runs `npm ci` + `npm audit --audit-level=high` in both workspaces and asserts lockfiles are unchanged. Critical/high regressions fail CI. |

No new telemetry vendor, SDK or external endpoint was introduced. No metric
contains customer content or credentials by design; keep dashboards private.

## 2. Owner-configured alerts recommended for staging

These are instructions only; none was provisioned here.

1. **Process liveness** — page after 3 consecutive `GET /healthz` failures or
   a restart loop. Do **not** use `/health` as the deployment health check: a
   degraded optional dependency must not cause needless restarts.
2. **Dependency readiness** — warn/page when `/health` returns 503 for more
   than two consecutive checks; identify `checks.database` vs `checks.pinecone`.
3. **Application errors** — alert on a sustained rise in `level:"error"` JSON
   log lines, especially `Unhandled request error`, `Inngest send failed`,
   `Durable job sweep failed`, `Durable job dispatch failed`, or provider
   failures. Redaction must remain enabled; never widen log payloads with raw
   request bodies or credentials.
4. **Job health** — alert when `durable_job` has `PROCESSING` rows older than
   the lease window, a growing `PENDING` backlog, or any `DEAD` row. `DEAD`
   must have exactly one compensating refund; investigate before re-enqueueing
   with a new idempotency key.
5. **Payment integrity** — alert on repeated webhook HMAC rejections, orders
   stuck between `PENDING` and settlement, more than one `PURCHASE`
   `credit_transaction` per settlement, or a refund without a matching eligible
   debit. Use only Razorpay **test-mode** data in staging.
6. **Security/abuse** — alert on `429` spikes, cross-origin CSRF rejections,
   repeated invalid OAuth state, or a sudden change in `req.ip` distribution.
   `TRUST_PROXY` must be an explicit allowlist in staging/production; the
   patched `proxy-addr` plus `server/src/config/proxy-trust.test.ts` prevent
   `X-Forwarded-For` spoofing from moving rate-limit buckets.
7. **Dependency security** — treat a failing CI `dependency-security` job as a
   release blocker. Any exception must be a narrow, time-bounded entry in
   `DEPENDENCY_SECURITY_REMEDIATION.md` with owner approval; never disable the
   audit globally.

## 3. Privacy and boundary rules

- Keep dashboards, log sinks and alert routing private to the owner's staging
  environment. Do not forward staging logs to a public service.
- Never alert on or export real customer data, production payment data or live
  credentials. Staging must use synthetic accounts and Razorpay test mode.
- If a secret appears in a log despite redaction, rotate it in the provider
  dashboard and in the private Render environment, then add a redaction test;
  do not paste the secret into a ticket, chat or commit.
- No production monitoring configuration or access was created or validated in
  this work.

## 4. What remains live-validation blocked

**BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED**: Render log/dashboard access,
alert routing, real `/health` behaviour against a deployed staging database,
real 429/OAuth/webhook event rates, and any pager/on-call integration. Local
unit, integration and HTTP evidence is documented in
`RELEASE_READINESS_REPORT.md`; it must not be reported as live monitoring
coverage.
