# Kairos — Production Hardening Report

**Status:** Hardening complete and verified in-repo; deployment gated on one manual DB migration.
**Date:** 2026-08-05
**Scope:** Remediation of the 7 production blockers raised by `FINAL_ENGINEERING_AUDIT.md`, followed by a security re-audit and full release validation. No features, no UX changes, no API renames, no breaking changes.

---

## 1. Blockers Remediated

### P1 — Fail-closed REST API authentication

The FastAPI management API previously ran unauthenticated when `KAIROS_API_SECRET` was unset, even in production. It is now impossible to start in production without a secret.

- `intelligence/api/app.py::create_app` raises `RuntimeError` ("Refusing to start Kairos Intelligence REST API: KAIROS_API_SECRET is required when KAIROS_ENVIRONMENT=production...") when the production profile is active and `api_secret` is empty.
- The guard lives in `create_app`, which is the actual production entrypoint (`docker/api.Dockerfile` runs `uvicorn intelligence.api.app:create_app()`); `intelligence/main.py` only runs gRPC.
- `AuthMiddleware` still only mounts when a secret is set (development convenience), but production can no longer reach that state.
- Test added: `tests/test_config_platform.py::TestAPIApp::test_create_app_fails_closed_in_production_without_secret`.

### P2 — Upload size hardening (ingest endpoint)

The Go gateway's multipart upload parsed the body before any hard cap and trusted attacker-supplied `header.Size`.

- `gateway/api/ingest_handler.go` now wraps `r.Body` with `http.MaxBytesReader(w, r.Body, maxBytes + multipartOverheadBytes)` (1 MiB framing allowance) **before** `r.FormFile`, and maps `*http.MaxBytesError` to `413`.
- Actual bytes read are still enforced via `io.LimitReader(file, maxBytes+1)` + a post-read length check, so a lying client cannot bypass the limit.
- `header.Size` is no longer used for enforcement.
- Tests added: `gateway/api/ingest_handler_test.go` (valid upload `200`, oversized `413`, unsupported type `400`).
- Audit confirmed the query endpoint already capped bodies at 1 MiB (`query_handler.go`); no other multipart handlers exist.

### P3 — Hot-path database indexes

Four indexes added to `apps/portal/prisma/schema.prisma` for the queries the audit flagged:

| Table | Index | Rationale |
|---|---|---|
| `ApiKey` | `@@index([keyPrefix])` | Looked up on every API call |
| `ExperimentRun` | `@@index([knowledgeBaseId, createdAt])` | Org-scoped run listing |
| `BenchmarkRun` | `@@index([status])` | Status-filtered queries |
| `ProviderHealth` | `@@index([organizationId, date])` | Org health history |

- Migration created: `apps/portal/prisma/migrations/20260805000000_add_hotpath_indexes/migration.sql`.
- `npx prisma validate` and `npx prisma generate` both pass (Prisma Client v5.22.0).
- **Not applied to the live Neon database** — see §4.

### P4 — Go toolchain validation

Go code was previously static-analysis-only (no toolchain). Now fully verified:

- Go 1.26.5 installed; `protoc` 28.3 + `protoc-gen-go`/`protoc-gen-go-grpc` installed.
- Missing generated protos regenerated (`generated/go/proto/rag.pb.go`, `rag_grpc.pb.go`).
- Fixed a latent compile error in `gateway/api/job_handler.go` (`Failed` → `queue.Failed` + missing import).
- `go build ./...`, `go vet ./...`, `go test ./...` all pass.

### P5 — Python test suite triage + configuration bug fix

The audit's 17 "pre-existing" failures were investigated and all 17 fixed. Root causes were real configuration defects, not just stale tests:

1. **Missing `metrics_enabled` field** (`intelligence/config/settings.py`): `ServerConfig.from_env()` read `settings.metrics_enabled`, which did not exist → every `from_env()` call (including `serve()` startup) crashed with `AttributeError`. Added the field with default `True`.
2. **Cached-singleton env override bug** (`intelligence/server/config.py`): `from_env()` used the cached `get_settings()` singleton, which ignored env overrides after first construction. Now builds a fresh `Settings()` per call.
3. **Env-var prefix regression from refactor 2a1235d3**: the Settings refactor applied the `KAIROS_` prefix to all fields, silently breaking the documented unprefixed names that deployment uses. Added `AliasChoices` so both forms work (unprefixed wins; prefixed is a fallback): `INTELLIGENCE_PORT`, `CHROMA_STORE_HOST/PORT`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `GROQ_API_KEY`, `GROQ_BASE_URL`.
4. **Empty-string bool parsing**: legacy `_parse_bool("")` returned `False`; pydantic strict bool parsing rejected `KAIROS_DEPLOYMENT=""`. Added a `mode="before"` validator matching legacy behavior for the bool fields.
5. Made the `TestValidation` suite hermetic (clears ambient provider env vars).

**Result:** `pytest tests -q` → **1795 passed, 15 skipped, 0 failed** (was 1776/18/15).

### P6 — Security re-audit

Re-audited authN/authZ, CORS, CSRF, cookies, rate limiting, headers, secrets, SSE, gRPC, and the portal API surface against current code. Three actionable defects fixed; the rest verified or documented.

**Fixed:**
- **Cross-tenant dataset read (HIGH)** — `apps/portal/src/app/api/experiments/stream/route.ts` accepted an arbitrary `datasetId` and streamed benchmark questions back with no org scope (`runExperimentDataset` fetches questions by `datasetId` only). Now resolves the dataset with an org-membership check (own-org KB or global dataset) before running.
- **No rate limit on expensive LLM-eval endpoint (HIGH)** — the same stream route ran unbounded experiment evaluations per user. Added `rateLimit("evaluation:<userId>", RATE_LIMITS.evaluation)`.
- **Demo-mode auth bypass risk (MEDIUM)** — `getDemoSession()` returned the hardcoded demo ADMIN for every anonymous request whenever `KAIROS_DEMO_MODE=true`, with no production guard. `isDemoModeEnabled()` now returns `false` when `NODE_ENV=production`, so demo mode can never silently disable auth in a deployed environment.

**Verified / documented (no change):**
- Gateway `/metrics` and intelligence `:8001` metrics are unauthenticated by design (scraped by Prometheus) — ensure these ports are not internet-exposed (compose maps them to host ports; see §4).
- Gateway↔intelligence gRPC is plaintext on the private Docker network (`insecure.NewCredentials`, `add_insecure_port`) — acceptable inside the compose network; do not expose port 28080 publicly.
- `knowledgeBaseId: null` "global" datasets are intentionally visible across tenants (shared Golden Datasets); `POST /api/v1/datasets` creating org-less datasets by omission is consistent with that design but should be revisited when multi-tenant dataset ownership lands.
- CORS: gateway and REST API both default to deny-all (no wildcard fallback). CSRF: middleware origin check present; no cookie-based auth yet, so no cookie-CSRF vector today.
- API keys: `kai_` keys stored as unsalted SHA-256 (acceptable for 256-bit entropy; PBKDF2/argon2 noted as future improvement).
- Rate-limit store is in-memory `Map` (per-instance) — fine for single-node deployments, not shared across serverless replicas.

### P7 — Release validation matrix

| Check | Command | Result |
|---|---|---|
| TypeScript | `npx tsc --noEmit` | PASS |
| Lint | `next lint` (changed files) | 0 errors |
| Production build | `npx next build` | PASS |
| Prisma schema | `npx prisma validate` | PASS |
| Prisma client | `npx prisma generate` | PASS |
| Compose | `docker compose config --quiet` | PASS |
| Go build | `go build ./...` | PASS |
| Go vet | `go vet ./...` | PASS |
| Go tests | `go test ./...` | PASS |
| Python tests | `python -m pytest tests -q` | 1795 passed, 15 skipped, 0 failed |

---

## 2. Net Change Summary

- Files touched this remediation: `intelligence/api/app.py`, `intelligence/config/settings.py`, `intelligence/server/config.py`, `gateway/api/ingest_handler.go` (+ test), `gateway/api/job_handler.go`, `apps/portal/prisma/schema.prisma`, `apps/portal/src/app/api/experiments/stream/route.ts`, `apps/portal/src/lib/server/demo-user.ts`, `tests/test_config_platform.py`.
- New artifacts: index migration, `gateway/api/ingest_handler_test.go`, regenerated Go protos (gitignored build artifacts).
- 0 breaking changes; all fixes verified by typecheck, build, and the full test matrix.

---

## 3. Readiness Verdict

**Codebase: production-ready with respect to the audited blockers.** The five blocking defects (fail-open auth, unbounded upload, missing indexes, unverified Go path, crash/regression-causing config bugs) are fixed and verified. The security re-audit surfaced and closed one cross-tenant data-leak and one auth-bypass risk.

**Deployment: not yet go — one manual gate remains (DB migration).**

---

## 4. Deployment Gate (must do before production traffic)

### G1 — Live database migration is NOT applied

The live Neon database (`apps/portal/.env` → neon.tech) is heavily drifted:

- `npx prisma migrate status` reports the baseline `20260628115210_init` as **NOT applied**, while the DB already contains many tables — indicating the schema was applied out-of-band.
- A DB→schema diff shows tables/FKs present in the DB that are missing from the schema and vice versa.

Consequence: a naive `prisma migrate deploy` of only the new index migration is unsafe. **Recommended procedure (outside this repo scope):**
1. Introspect the live DB and reconcile drift (or baseline it with `prisma migrate diff --from-empty`), under a maintenance window with a backup.
2. Only then apply `20260805000000_add_hotpath_indexes` (4 `CREATE INDEX` — safe to run manually as `CREATE INDEX CONCURRENTLY` if supported).
3. Re-run `prisma migrate status` until clean.

Until this gate is cleared, the index work is schema-authored and validated but **not effective in production**.

### G2 — Operational checks for the deployed stack

- Replace placeholder secrets in `.env` (`KAIROS_SECRET`, `KAIROS_API_SECRET`, `GRAFANA_PASSWORD=admin`, `DATABASE_URL`) with generated values; the gateway logs a warning when `KAIROS_SECRET` is empty.
- Do not expose ports `28080` (gRPC), `8001` (intelligence metrics), `9090` (Prometheus), or `3000` (Grafana) to the public internet; the gateway `8080` and portal `3000` are the intended ingress. If the portal is public, ensure `KAIROS_DEMO_MODE` is unset (it is now inert in production regardless).
- Confirm `KAIROS_ENVIRONMENT=production` on the REST API container so the fail-closed auth guard is active.

---

## 5. Remaining Technical Debt (documented, not blocking)

1. Better Auth integration: `getServerSession()` returns a demo user; real session/cookie auth is not wired. All session-based routes return 401 in production today (dead until wired).
2. Auth boilerplate consolidation (`requireSession()` across server-action files) and V1-route `withApiHandler` wrapper — deferred to avoid churn on 89 call sites.
3. API keys hashed with unsalted SHA-256; PBKDF2/argon2 preferred for defense-in-depth.
4. In-memory rate-limit store; replace with a shared store if the portal scales horizontally.
5. `BenchmarkDataset`/`Experiment` lack a direct `organizationId`; the current KB→Project→Organization chain works but is N+1-friendly.
6. Unused Prisma models (`Session`, `Account`, `VerificationToken`, `MessageCitation`, `ActivityLog`) — removal requires a migration.
7. Semantic-cache namespace pruning in the Go gateway (`namespaceIndex` never pruned on LRU eviction).
8. 84 files > 300 lines (large feature clients) — deferred feature splits.
