# KAIROS — Phase 08 controlled staging deployment and live validation report

## 1. Engineering classification

**C. READY FOR STAGING DEPLOYMENT** — strongest independently verifiable result.

No Render credentials, API key, OAuth token, deployment MCP resource or other
authorized deployment access was available. Therefore no staging deployment,
live endpoint, real provider call or live validation exists. A/B cannot be
claimed; no unresolved critical defect was found, so D is not warranted.

## 2. Independent licensing classification

**E. PUBLIC REDISTRIBUTION BLOCKED — LICENSING EVIDENCE INSUFFICIENT.**

This remains independent of the engineering classification. Phase 08 grants no
public redistribution rights. The repository stays private and the upstream
author/repository were never contacted. `ATTRIBUTION.md` is unchanged.

## 3. Identity and scope

| Item | Value |
| --- | --- |
| Repository | `ANUBprad/kairos` (private; only `origin https://github.com/ANUBprad/kairos.git`) |
| Branch | `main` |
| Baseline verified before edits | `07c387ded18f560839dc81686ffc36a7ee863273` |
| Final commit | The commit containing this report; the pushed SHA is recorded in the final Phase 08 response. No SHA is invented here. |
| Canonical staging blueprint | `render.staging.yaml` only |
| Staging services | `kairos-server-staging`, `kairos-client-staging` |
| Production service | `openbook-server` remains only in the untouched full `render.yaml`; it was not deployed, restarted or reconfigured |
| Deployment IDs / service IDs | **None — BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED** |
| Deployment URLs / timestamps / build logs | **None — BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED** |

No production database/service, production promotion, live Razorpay key, real
payment/refund, customer data, real email, public release, force-push, reset or
history rewrite occurred. All local data was synthetic. Ambient
`DATABASE_URL`/`OPENAI_API_KEY` values were treated as unrelated to this project
and were not used.

## 4. Staging-only deployment isolation — verified

- `render.staging.yaml` contains exactly two services and no `openbook-server`.
- Every credential is `sync: false`; no secret is committed inline.
- Backend health check remains `/healthz` (liveness only).
- `node scripts/check-staging-blueprint.mjs render.staging.yaml` passes with
  `STAGING BLUEPRINT GUARD: PASS (2 staging services, no production service)`.
- Legacy `render.yaml` staging frontend now declares `DEPLOYMENT_ENV: staging`;
  `node scripts/check-staging-blueprint.mjs render.yaml --legacy` passes.
- Free-plan-compatible migrations were added to the backend `buildCommand`:
  `npm install --include=dev && npx prisma migrate deploy && npx prisma migrate status && npm run build`.
  Render's paid-only `preDeployCommand` was not used. `DATABASE_URL` must be
  available at build time so the app cannot boot against a stale schema.
- Client staging build rejects a production-looking rewrite target:
  `BACKEND_INTERNAL_URL looks like production; refusing staging rewrite`.

## 5. Confirmed P0/P1 findings — fixed locally

Four independently confirmed P1 reliability defects were fixed (three in the
initial review, plus one found by the final read-only diff review):

1. **Source reprocess could rewind a live job.** `requeueDurableJob()` now only
   rewinds `PENDING`/`DEAD` rows; `PROCESSING`/`DELIVERED` are immutable. Single
   and bulk source reprocess paths refuse to rewind `PROCESSING`/`READY` sources,
   and source claiming is an atomic `PENDING|FAILED -> PROCESSING` transition.
   Its boolean result is now honored: a refused requeue fails the request and is
   not counted as a successful bulk reprocess.
2. **Durable jobs had no attempt lease or heartbeat.** A unique lease token is
   issued at claim, renewed by an unref'd heartbeat during worker execution, and
   required for completion/release/recovery. Stale workers cannot complete or
   release a job reissued to a new holder. Legacy lease-less `PROCESSING` rows
   remain recoverable via `updatedAt`. The artifact heartbeat now wraps the full
   worker execution, including the initial artifact claim.
3. **Migrations were absent from the staging deploy path.** Migrations now run
   fail-closed during the staging backend build, before `npm run build`, and
   `prisma migrate status` must succeed.
4. **Hard crash mid-source-processing could not recover.** The strict
   `PENDING|FAILED -> PROCESSING` claim left an orphaned `PROCESSING` source after
   a crash; recovery reissued the job without resetting that claim, and the
   Inngest `mark-processing` step sat outside `try`, so the job burned through
   lease cycles to `DEAD` and was refunded. Recovery now atomically releases a
   stale `PROCESSING` claim with the job, settles an already-`READY`
   source/artifact as `DELIVERED` instead of rebuilding or refunding it, and
   `mark-processing` is inside the guarded `try/catch`.

No P0 finding was confirmed. All P1 fixes are covered by unit and integration
regressions (including six new crash-recovery cases); live staging validation
remains blocked.

## 6. P2/P3 findings — fixed or documented

| ID | Finding | Disposition |
| --- | --- | --- |
| F2 | Post-auth open redirect via attacker-controlled `callbackUrl` | **FIXED**: `safeRedirectPath()` accepts only same-origin absolute paths and rejects protocol-relative, backslash, control-character, encoded-separator, `javascript:` and overlong values; 15-case CI guard added |
| F3 | Legacy staging frontend lacked explicit `DEPLOYMENT_ENV` | **FIXED**: `render.yaml` staging client declares `DEPLOYMENT_ENV: staging`; CI legacy guard added |
| F4 | Two retry owners (Inngest retries plus outbox sweeper) | **MITIGATED**: Inngest retries set to `0`, outbox is the single retry owner, event IDs are derived from the per-claim lease UUID (not the attempt number, which an explicit requeue resets), and lease tokens guard worker callbacks. Live validation still required |
| F5 | Compensation race around terminal failure/refund | **DOCUMENTED RISK**: guarded by refund/idempotency checks and terminal-state guards; no live payment validation occurred |
| F6 | No request correlation IDs | **PARTIALLY FIXED**: early `X-Request-Id` middleware, CORS exposure and error payload/log propagation added. Propagation into Inngest/worker log lines is still outstanding |
| F7 | Backup/restore not automated | **DOCUMENTED RISK**: manual disposable drill repeated successfully; owner should automate scheduled staging backups and separate-target restore rehearsals |
| P3 | Pre-existing client lint debt | **DOCUMENTED**: 27 errors / 62 warnings in unchanged files (for example `use-workspaces.ts`, `use-mobile.ts`, `workspace-layout.tsx`); `tsc` and production build pass, but this debt needs owner triage |

No validation was weakened to make tests pass.

## 7. Database, migration and integrity evidence

All checks used only disposable local containers.

| Item | Evidence |
| --- | --- |
| Source DB | `kairos-phase08-pg-20261124`, host port 55451, DB `kairos_phase08` |
| Migration ledger | 14 migrations applied; `Database schema is up to date!` |
| New migration | `20261124100000_durable_job_lease_heartbeat` — additive `leaseToken`, `leaseExpiresAt`, `heartbeatAt` and one index; no historical/payment/legacy rows rewritten |
| `prisma validate` / `generate` | Exit 0 / exit 0 |
| `prisma migrate deploy` / `status` | Exit 0 / exit 0 |
| Schema audit | 19 tables, 169 columns, 10 enums, 55 indexes, 13 FKs, 19 PKs; legacy `Test` table preserved |
| Orphan/invariant counters | 0 for orphan sources/artifacts/conversations/messages/payments/ledger, refunds without purchase, stale `PROCESSING` jobs and `DEAD` jobs |
| `prisma db push` | Not used |

## 8. Backup and restore drill

- Synthetic fixture inserted into the Phase 08 source DB: 1 user, 1 workspace,
  1 source, 1 conversation, 1 message, 1 artifact, 1 payment record, 1 `PURCHASE`
  ledger row and 1 `DELIVERED` durable job.
- `pg_dump -Fc` exit 0; 46,249 bytes; SHA-256
  `809BBFD6A273002750ED0F38A46783D59D096FDF44A680794C4F5F21A828855D`.
- Restored into a **separate** disposable container/database
  `kairos-phase08-restore-20261124` / `kairos_phase08_restore` (host port 55452),
  never over the source. `pg_restore` exit 0; duration 1,050 ms.
- Restored `prisma migrate status`: 14 migrations, up to date.
- Source and restored fixture counts matched for all nine entities; all orphan
  and job/financial invariant counters were zero.
- The synthetic fixture was then deleted from the source DB; a final query
  confirmed zero rows and zero invariants before the final integration rerun.

## 9. Full local verification matrix (after final code edits)

| Check | Result |
| --- | --- |
| Baseline branch / remote / visibility | `main`; local HEAD matched baseline; only `origin`; `visibility=PRIVATE` |
| Server `npm ci` | Exit 0; `server/package-lock.json` unchanged |
| Client dependency install | In-place reinstall still blocked by OneDrive `EBUSY` on `client/node_modules/property-information/lib/hast-to-react.d.ts.map`; clean temp `npm ci` with committed manifest/lockfile exit 0; hashes matched committed files |
| `npx prisma validate` / `generate` | Exit 0 / exit 0 |
| `npx prisma migrate deploy` / `status` | Exit 0 / exit 0; 14 migrations, up to date |
| `npm run typecheck` (server) | Exit 0 |
| `npm run test:unit` (server) | **156/156 pass**, 0 fail, exit 0 |
| `npm run test:integration` with `TEST_DATABASE_URL` | **49/49 pass**, 0 fail, exit 0 |
| `npm run build` (server) | Exit 0 |
| Client `npx tsc --noEmit` | Exit 0 (clean temp dependency tree) |
| Client staging build | Exit 0 with staging-marked HTTPS rewrite targets |
| Client negative staging build | Exit 1 as expected; failed closed with production-looking `BACKEND_INTERNAL_URL` |
| Playwright Chromium | **3/3 pass**; client dev served from the clean temp dependency tree because the in-place tree is OS-locked |
| Dependency audit | Server 0 critical / 0 high / 7 moderate / 0 low; client 0 / 0 / 10 / 4; root 0; high-level gates exit 0 |
| Secret scan | 35 regex hits reviewed; all were documented placeholders, local synthetic fixtures, or detection patterns. No real credential found |
| `git diff --check` | Exit 0 (only CRLF normalization warnings) |
| Blueprint / legacy / redirect guards | All exit 0 |
| `ATTRIBUTION.md` and all lockfiles | Unchanged |

Evidence is deliberately separated: **local** means disposable DB/container and
local processes; **mocked** means provider-mocked integration tests; **live**
means a real Render-deployed service. No live evidence exists for Phase 08.

## 10. Security review coverage

Three independent read-only audits covered auth/session, IDOR, CSRF/CORS,
OAuth state/nonce, payment settlement, ledger/refund idempotency, SSRF/DNS
rebinding, IPv4/IPv6 handling, upload/path handling, provider secret handling,
logging, proxy trust, health endpoints, error hygiene, durable jobs, artifact
leases, source processing and infrastructure isolation. Auth/payment/OAuth
found no concrete finding; rejected candidates (`requestKey` collision and
`/api/auth/*` CSRF exemption) are not vulnerabilities. All four P1 findings
above were fixed and retested.

## 11. Live validation status — BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED

The following were **not** performed and must not be inferred:

- Render service IDs, deployment IDs, staging URLs, timestamps, build logs or
  runtime status.
- Real `/healthz` and `/health` checks, TLS certificate, HTTP→HTTPS redirect,
  HSTS, Secure/HttpOnly/SameSite cookies, mixed content, CORS/CSRF, origin and
  referer checks, proxy/forwarded-IP behavior, rate limits, CSP and headers.
- Live registration/login/session and cross-user ownership checks.
- Live Google/GitHub/Notion OAuth round-trips and state replay tests.
- Live Razorpay **test-mode** checkout, success/failure/cancellation,
  valid/invalid/duplicate/concurrent/out-of-order webhooks, refund lifecycle and
  financial invariants in a staging DB.
- Live provider calls and Zod 4 smoke tests for Inngest and Mem0.
- Live worker crash/restart, DB interruption, provider outage, lease recovery and
  outbox recovery on a deployed worker.
- Live log streaming, dashboards, alerts, request-ID propagation and email.
- Real `STAGING_DATABASE_ID`, staging OAuth callbacks and Cloudinary ownership
  on Render.

## 12. Outstanding owner actions

1. Supply authorized Render access. Deploy **only** `render.staging.yaml` from
   private `origin/main`; record deployment IDs, service URLs, commit SHA,
   timestamps and build logs. Do not deploy `render.yaml`.
2. Configure every `sync: false` value in the private dashboard. Use a separate
   staging database, staging OAuth apps/callbacks, Razorpay **test-mode** keys,
   staging-owned Cloudinary resources, signing secrets distinct from production
   and synthetic data only. Ensure `DATABASE_URL` is available at build time.
3. Confirm `prisma migrate deploy`/`status` succeeded in the build, then execute
   the live checks in `STAGING_SECURITY_TESTS.md`.
4. Exercise Razorpay test-mode payment/webhook/refund, Inngest/Mem0 Zod 4 smoke
   tests, worker restart and monitoring/alerts from `MONITORING_AND_ALERTING.md`.
5. Take a staging backup and rehearse restore into a separate disposable DB;
   automate this before routine operation.
6. Triage the pre-existing client lint debt and finish request-ID propagation
   into Inngest/worker logs.
7. Resolve the licensing conflict in `LICENSING_REVIEW.md` before any public
   redistribution; keep the repository private until then.

## 13. Residual risks

- Live staging behavior remains unverified; local/mocked evidence is not a
  substitute for a deployed service.
- F5 compensation race, F7 backup automation and P3 lint/request-ID propagation
  remain documented owner work.
- Residual moderate/low dependency advisories remain **ACCEPTED RISK — OWNER
  APPROVAL REQUIRED**; no blind upgrade or audit suppression was used.
- Firecrawl redirect limits inside the provider's own infrastructure remain a
  third-party limitation.

## 14. Boundaries

No production deployment, production database/service, live Razorpay key, real
payment/refund, customer data or real email was used. No upstream contact,
force-push, reset, history rewrite or public release occurred. Only Phase 08
labelled disposable containers were created for this work; unrelated containers
were left untouched.

## 15. Final decision

**C. READY FOR STAGING DEPLOYMENT** is retained: all confirmed P0/P1 findings are
fixed locally and the full local/mocked matrix is green, but no deployment
occurred. A/B would require real Render deployment and live validation evidence.
Independently, licensing remains **E. PUBLIC REDISTRIBUTION BLOCKED — LICENSING
EVIDENCE INSUFFICIENT**.
