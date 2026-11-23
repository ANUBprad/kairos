# KAIROS — Phase 07 staging validation report

Classification: **C. READY FOR STAGING DEPLOYMENT** (strongest independently
verifiable result; deployment credentials were unavailable).

Independent licensing classification: **E. PUBLIC REDISTRIBUTION BLOCKED —
LICENSING EVIDENCE INSUFFICIENT**. This does not change the engineering staging
classification and does not grant public redistribution rights. Kairos is **not
production-ready**.

## 1. Identity and scope

| Item | Value |
| --- | --- |
| Repository | `ANUBprad/kairos` (private; `origin https://github.com/ANUBprad/kairos.git` only) |
| Branch | `main` |
| Baseline commit | `eb5df27baa236563e3f32c81ec41d3e6a2c227d7` (confirmed locally and via `git ls-remote origin refs/heads/main`) |
| Final commit | `8d7c2c16471d99cfb34774fcf73352facf3ae561` (the commit containing this report) |
| Staging service names | `kairos-server-staging`, `kairos-client-staging` (only services in `render.staging.yaml`) |
| Deployment IDs | **None — BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED**. No Render account/API key/owner ID available. |
| Staging URLs | **None recorded** — no deployment occurred; no URL was invented. |
| Deployment timestamps | **None** — no Render deployment, restart or redeploy was performed. |
| Production service | `openbook-server` remains in the untouched `render.yaml` only; absent from the staging blueprint. It was not created, updated, restarted or redeployed. |
| Upstream | Original `swamiabhishek45/OpenBook` and its author were never contacted. `ATTRIBUTION.md` is unchanged. |

No real Razorpay/live key, real payment/refund, customer data, real email,
production database/service, fake credential, force-push, reset, history rewrite
or public release was used. All data used locally was synthetic.

## 2. Staging-only deployment configuration — FIXED AND VERIFIED

- `render.staging.yaml` contains exactly two web services:
  `kairos-server-staging` and `kairos-client-staging`. The production service
  name is absent.
- Every credential is `sync: false`; no inline secret, live Razorpay key or
  production URL is present. The backend uses `/healthz` (liveness only).
- `node scripts/check-staging-blueprint.mjs render.staging.yaml` returns
  `STAGING BLUEPRINT GUARD: PASS (2 staging services, no production service)`.
  The guard runs in CI as `staging-blueprint-guard`.
- Client staging isolation: with `DEPLOYMENT_ENV=staging`,
  `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL` and
  `BACKEND_INTERNAL_URL` must be HTTPS/credential-free/staging-marked and not
  production-like. Positive build passed; a production-looking rewrite target
  correctly failed with `BACKEND_INTERNAL_URL looks like production; refusing
  staging rewrite`.
- Server staging isolation: `CLIENT_URL` and `SERVER_URL` must be HTTPS,
  credential-free, staging-owned and non-production-like. Combined with the
  existing `STAGING_DATABASE_ID`, `STAGING_RESOURCE_PREFIX`, OAuth-state-secret
  distinctness, Cloudinary ownership and Razorpay test-key gates, missing or
  wrong identity fails startup closed.
- A production-labelled deployment can no longer run with
  `NODE_ENV=development`; `BETTER_AUTH_URL` and `SERVER_URL` are mandatory and
  validated in production. One production predicate is shared by CORS, Better
  Auth, OAuth cookies and env validation.

Owner action: deploy **only** `render.staging.yaml` from private `origin/main`
via the Render dashboard, supply all `sync: false` values there, then record IDs,
URLs and timestamps in this report. Do not deploy the full `render.yaml`.

## 3. Database, migration and integrity evidence

All checks below ran only against locally created, disposable PostgreSQL
containers. No staging or production database existed in this environment.

| Item | Evidence |
| --- | --- |
| Disposable source DB | `kairos-phase07-pg-20261123`, host port 55447, DB `kairos_phase07`; local-only throwaway credentials (not recorded here) |
| Identity confirmation | `prisma migrate deploy`/`status` datasource line reported database `kairos_phase07` at `127.0.0.1:55447`; never production |
| Migrations | 13/13 applied; `Database schema is up to date!`; `prisma validate` and `generate` exit 0 |
| Schema audit | 19 tables, 166 columns, 10 enums, 54 indexes, 13 FKs, 19 PKs; legacy `Test` table intentionally present |
| `prisma db push` | Not used |
| Orphan/invariant audit | `orphan_workspaces/sources/artifacts/conversations/messages/payments/ledger = 0`; `invalid_refunds = 0`; `stale_processing_jobs = 0`; `premature_dead_jobs = 0` |
| Live staging DB identity gates | Startup gates are unit-tested with synthetic values; actual `STAGING_DATABASE_ID` on Render remains **BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED** |

## 4. Backup and restore drill

- Synthetic fixture inserted into the disposable source DB: 1 user, 1 workspace,
  1 source, 1 conversation, 1 message, 1 artifact, 1 payment record, 1 `PURCHASE`
  ledger row and 1 `DELIVERED` job.
- `pg_dump -Fc`: exit 0; 45,614 bytes;
  SHA-256 `5F22FFF4633C79663EEAC7DFC8C322583F250D93FD03027D446C036E46A78BA8`.
- Restored into a **separate** disposable container/database
  `kairos-phase07-restore-20261123` / `kairos_phase07_restore` (host port 55448),
  never over the source. `pg_restore` exit 0; duration **1,385 ms**.
- Restored `prisma migrate status`: 13 migrations, up to date.
- Restored fixture counts matched the source for all nine entities; all orphan
  and job/financial invariant counters were zero. No production data was used.

## 5. Local verification results

| Check | Result |
| --- | --- |
| `npm ci` server | Exit 0; lockfile byte-identical |
| `npm ci` client | In-place reinstall blocked by a OneDrive OS lock on one source-map; clean temporary-directory `npm ci` with committed manifest/lockfile exit 0; lockfile byte-identical; restored tree built successfully |
| TypeScript typecheck + server build | Exit 0 |
| Unit tests | **148/148 pass** |
| PostgreSQL integration tests (real Express routes) | **47/47 pass**: auth/IDOR/CSRF/OAuth-state/HTTP security, provider-mocked payments, job recovery and concurrency |
| Client staging build | Pass |
| Client negative staging build | Correctly failed closed |
| Playwright (Chromium) | **3/3 pass** after fixing an explicit-port collision in `playwright.config.ts` |
| Secret scan | No real credential; only documented local/synthetic fixtures |
| Git whitespace check | Clean |
| Dependency audit | Server 0 critical / 0 high / 7 moderate / 0 low; client 0 / 0 / 10 / 4; root 0 |

## 6. Security review and fixes

Two independent read-only audits covered auth/session, IDOR, CSRF/CORS, OAuth,
payment settlement, ledger/refund idempotency, durable jobs, SSRF/DNS rebinding,
IPv4/IPv6, upload/path handling, provider secrets, logging, proxy trust, health,
error hygiene and unbounded queries. **No confirmed P0 or P1 findings.** Safe
P2/P3 items fixed with regression tests:

- Cloudinary private download URLs now carry a real one-hour `expires_at` and
  signature; Cloudinary 403 returns a generic client error with internal detail
  logged only.
- Logger redacts free-form messages, session/OTP/card keys and provider key
  patterns; provider fetch combines caller abort with the hard timeout;
  redirect sockets are released immediately.
- `TRUST_PROXY` accepts only IP/CIDR tokens (numeric hop counts remain
  development-only); production identity cannot be downgraded.
- Client rewrite and server origin gates fail closed for staging.

Residual dependency advisories remain **ACCEPTED RISK — OWNER APPROVAL
REQUIRED**; no blind upgrade or audit suppression was used.

## 7. Live validation status — BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED

The following were **not** performed and must not be inferred from local tests:

- Render deployment IDs, service URLs, timestamps or real `/healthz`/`/health`
  checks.
- TLS certificate, HTTP→HTTPS redirect, HSTS, Secure/HttpOnly/SameSite cookies,
  mixed content, CORS/CSRF, origin/referer, proxy/forwarded-IP, rate limits,
  CSP and security headers on a real staging host.
- Live registration/login/session/cross-user ownership checks on deployed
  services.
- Live Google/GitHub/Notion OAuth round-trips with staging callbacks and state
  replay tests.
- Live Razorpay **test-mode** checkout (credit pack, PRO, PRO_PLUS), success/
  failure/cancellation, valid/invalid/duplicate/concurrent/out-of-order webhooks,
  refund lifecycle and financial invariants in a staging DB.
- Live provider calls and Zod 4 smoke tests for Inngest and Mem0; Firecrawl
  redirect limits inside the provider's own infrastructure remain a documented
  third-party limitation.
- Worker restart/crash, DB interruption, provider outage, lease recovery beyond
  the 50-job tick bound and outbox recovery on a deployed worker.
- Live log streaming, dashboards, alerts, request IDs and email delivery.

## 8. Outstanding owner actions

1. Supply Render access and deploy only `render.staging.yaml`; record deployment
   IDs, staging URLs, commit SHA and timestamps here.
2. Configure every `sync: false` value in the private dashboard; use a separate
   staging database, staging OAuth apps/callbacks, test-mode Razorpay keys,
   staging-owned Cloudinary resources, distinct signing secrets and synthetic
   data only.
3. Run `prisma migrate deploy`/`status` against the staging database only, then
   execute the live checks in `STAGING_SECURITY_TESTS.md`.
4. Exercise Razorpay test-mode payment/webhook/refund and Inngest/Mem0 Zod 4
   smoke tests; configure alerts from `MONITORING_AND_ALERTING.md`.
5. Take a staging backup and rehearse restore into a separate disposable DB
   before any production discussion.
6. Resolve the licensing conflict in `LICENSING_REVIEW.md` before any public
   redistribution; keep the repository private until then.

No production deployment or production promotion is authorized by this phase.