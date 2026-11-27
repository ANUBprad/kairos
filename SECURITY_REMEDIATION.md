# Kairos — Round 3/4 remediation notes

This document describes the security and reliability behavior introduced by the
second, third and fourth remediation rounds. It is an engineering reference,
**not a production readiness claim**. Licensing and attribution remain a
separate owner decision; see `ATTRIBUTION.md`, which is intentionally unchanged.

## 1. DNS-pinned outbound fetches

`server/src/lib/safe-fetch.ts` validates and pins the resolved IP address for
every outbound HTTP(S) connection:

- The URL scheme must be `http:` or `https:`; credentials and non-standard
  ports are rejected on the initial URL and on every redirect hop.
- Hostnames are resolved once per hop with `dns.lookup(..., { all: true })`.
  Every returned address must be a permitted public address; mixed
  public/private answers fail closed.
- The validated address is supplied to the HTTP(S) client as the connection's
  lookup result. The original hostname is retained for the HTTP `Host` header
  and TLS SNI/certificate validation, and the connected socket's peer address
  is compared with the pinned address where the runtime exposes it.
- Redirects are handled manually (max 3), each hop is independently validated
  and resolved, and non-HTTP(S) redirect targets are rejected.
- A total request timeout, a streamed response-size cap, and content-type
  checks remain in force.

Round 3 replaced the previous "reject private IPv4" heuristic with a
**deny-by-default address policy**:

- Rejected: IPv4 private/loopback/link-local/multicast/reserved/CGNAT/
  benchmarking/documentation ranges; IPv4-compatible and SIIT translated
  forms; `fc00::/7` unique local, `fe80::/10` link-local, `fec0::/10` site
  local, multicast, `100::/64` discard-only, `2001:db8::/32` documentation,
  `2001::/32` Teredo, `2002::/16` 6to4, ORCHID ranges, IETF special-purpose
  ranges, NAT64 `64:ff9b::/96`, and NAT64 local-use `64:ff9b:1::/48`.
- Allowed: ordinary public IPv6 destinations and IPv4-mapped IPv6 addresses
  whose embedded IPv4 address is itself public.

Rationale: this process cannot predict which internal address a NAT64, 6to4 or
Teredo translator will choose, so translated layouts must never be pinned as if
they were ordinary public endpoints.

Tests in `server/src/lib/safe-fetch.test.ts` use injected lookups/request
factories to prove DNS pinning, rebinding rejection, hostile redirect rejection,
size/timeout limits, and the IPv6 transition/special ranges above.

`server/src/lib/sources/firecrawl.ts` validates the user-supplied URL with the
same helper, but the subsequent network request is performed by the external
Firecrawl service, which resolves and connects from its own network. Local IP
pinning cannot cover that third-party hop; it remains an external-service
limitation rather than a gap in the local fetch implementation.

## 2. Credit debit/refund lifecycle and durable work

Charged operations follow one rule: **a charge and the durable record of the
work it pays for are committed together, or neither is committed.**

- `server/src/lib/outbox.ts` implements a transactional outbox with unique,
  deterministic keys and `PENDING → PROCESSING → DELIVERED | DEAD` states.
- Artifact and source creation insert their record, debit credits, update
  counters and insert an outbox row inside one `prisma.$transaction`. Any
  failure rolls the whole unit back, so no charge is left without work.
- Dispatch is attempted after commit, but **Inngest/local fallback acceptance is
  not completion**. The committed outbox row is the source of truth. A
  `DELIVERED` job is never requeued.
- Failures release retryable jobs to `PENDING` with bounded exponential retries
  and **no refund**. Only a terminal `DEAD` job (or a legacy row with no job)
  triggers a compensating refund, and only if the work is not already `READY`.
- Refunds use stable keys (`artifact-refund:<id>`, `source-refund:<id>`) and
  only refund an existing debit, so retries cannot double-refund and records
  with no debit cannot be refunded.
- A refunded terminal artifact/source cannot be retried with its original
  no-new-charge key: artifact retry is rejected when `refundedAt` is set, and
  refunded sources are skipped by single and bulk reprocess (they must be
  re-imported so a new charge is recorded).
- `recoverAbandonedDurableJobs()` re-dispatches due `PENDING` jobs and returns
  stale `PROCESSING` jobs to `PENDING` after a bounded lease period.

Deterministic keys in use: `artifact-charge:<id>`, `artifact-refund:<id>`,
`source-charge:<id>`, `source-refund:<id>`, `signup-credit:<id>`, and the
caller-supplied chat `requestKey`.

Chat messages are synchronous. The authoritative quota check and the user
message insert happen in one transaction; failures before the stream is
successfully constructed refund once and remove the message. Charges are never
refunded after an assistant message has been successfully persisted.

## 3. Artifact state transitions and leases

Allowed transitions are enforced with conditional database updates in
`server/src/repository/artifact.repository.ts`:

- `PENDING | FAILED → PROCESSING` via an atomic claim that stores a lease token
  and expiry; only one worker can win the claim.
- `PROCESSING → READY` only while the caller holds the **matching, unexpired**
  lease. A stale worker cannot complete the artifact.
- `PROCESSING → PROCESSING` via `renewArtifactLease`, which also requires the
  matching unexpired lease. Long-running workers renew before continuing.
- `PENDING | PROCESSING → FAILED` only when eligible: a live lease blocks the
  stale sweep; `READY` artifacts are immutable and are never failed or
  refunded.
- `FAILED → PENDING` for an explicit retry, which is rejected if the failure
  was already refunded.

A stale sweep may only take over released, absent or expired leases. Recovery
of an expired `PROCESSING` row therefore goes through
`markArtifactFailedIfEligible(..., null, ...)` followed by an explicit retry,
after which another worker may claim it. Completion with a wrong or expired
token cannot overwrite a newer state. A refund happens only when the
conditional transition to `FAILED` succeeds **and** the durable job is terminal.

## 4. Payment entitlement validation

`server/src/services/payment-settlement.services.ts` classifies a payment
record from server-owned facts before granting anything:

- Currency must be INR and the amount must be a positive integer in paise.
- Subscription orders require `PRO`/`PRO_PLUS`, the exact server-configured
  price and the exact configured credit grant.
- Credit packs require an explicitly null plan, an allow-listed pack amount
  and the exact configured credit grant. Credit packs never grant a plan.
- Historical records with `plan='PRO'`, zero credits, or mismatched
  amount/plan/credit combinations are ambiguous and are rejected (fail closed).
- Duplicate settlements return a duplicate result derived from classification
  and never re-grant credits or report a legacy plan as applied.

Read-only owner queries live in
`server/prisma/reconciliation/001-read-only-reconciliation.sql`. They report
suspicious historical rows only; no payment, plan, credit or user record is
rewritten automatically.

## 5. Plan quota enforcement and chat idempotency

`server/src/services/usage.services.ts` keeps the authoritative `PLAN_LIMITS`
table (FREE allows 10 USER messages). Pre-checks in the API are advisory; the
authoritative check is a transactional re-check under a per-user PostgreSQL
advisory transaction lock (`pg_advisory_xact_lock`) that covers the count and
the subsequent record insert. Concurrent requests cannot both take the last
slot. Sources and artifacts use the same transactional re-check, with an
additional conditional counter update for artifacts.

Chat requests may optionally send `requestKey` (1–128 characters). It is
stored in a unique `Message.requestKey` column. Duplicate/retried requests are
detected before **and** after the advisory lock is acquired; the winner inserts
one USER message, and retries reuse the same message id. Because the charge key
is derived from that message id, a retry is charged only once. A retry is
accepted even when the user is at their quota boundary, because it does not
create a new billable message.

## 6. CSRF and request configuration

- Custom state-changing API routes are protected by explicit origin checks in
  `server/src/middleware/csrf.middleware.ts`. A matching `Origin` or
  `Sec-Fetch-Site: same-origin` passes; `Sec-Fetch-Site: none` (direct
  navigation), cross-site or disallowed origins, and missing `Origin` are
  rejected with 403. `none` no longer bypasses the `Origin` check.
- `/api/auth/*`, `/api/payment/webhook` (HMAC-verified) and `/api/inngest` are
  exempt by design and keep their own protections.
- Trusted origins come only from `CLIENT_URL` via `server/src/config/network.ts`.
  Localhost origins are added only outside production.
- `TRUST_PROXY` must be explicit. When a proxy hop count is configured, the
  production configuration fails closed instead of silently trusting arbitrary
  forwarded headers.
- Generic JSON and URL-encoded request bodies are capped at **2 MB**. File
  uploads keep their own magic-byte-checked Multer limits (25 MB PDF, 15 MB
  image); large generic bodies were only a memory-exhaustion surface.
- OAuth provider IDs are validated against a restrictive `[A-Za-z0-9_-]`
  pattern and URL-encoded before being placed in fixed-host provider URLs.
  Google Drive search terms escape backslashes and quotes and are length-bounded.
- Third-party/parser errors are routed through the redacting `logger` instead
  of raw `console.warn/error`, so tokens, headers and long strings are masked
  or truncated.

## 7. Signup credits

`User.credits` now defaults to **0**. A Better Auth `user.create.after` hook
grants 50 welcome credits and writes the matching `SIGNUP_BONUS` ledger row
(`signup-credit:<userId>`) **atomically** via `createMany({ skipDuplicates: true })`
and a conditional balance increment. Replayed hooks cannot grant a second
bonus. Existing users keep every credit they already have; there is no
backfill, refund or historical rewrite.

## 8. Source processing failure semantics

`server/src/services/source-processing.services.ts` and
`server/src/repository/source.repository.ts` use compare-and-swap transitions:

- A source can only move to `READY` from `PROCESSING`; a late or duplicate
  worker cannot overwrite a completed source.
- A late failure uses `status != READY` as its CAS condition, so a `READY`
  source is never overwritten and never refunded.
- State transition and refund are performed in one transaction; compensation
  only happens for terminal failures and only once via a stable refund key.

## 9. Round 4 audit disposition

| ID | Area | Disposition |
|---|---|---|
| F1 | Refunded artifact/source retried without re-charge | **Fixed**: terminal refund blocks retry; refunded sources skipped in bulk reprocess. |
| F2 | Deployment secret drift | **Fixed**: `render.yaml` declares `RAZORPAY_WEBHOOK_SECRET`, `OAUTH_STATE_SECRET`, `SERVER_URL`, `TRUST_PROXY` as `sync: false`. |
| F3 | 50 MB generic request bodies | **Fixed**: reduced to 2 MB. |
| F4 | Cloudinary signed URL never expired; hardcoded unsigned preset | **Fixed**: signed URLs expire after one hour; no third-party preset fallback; an operator-supplied preset is required for unsigned uploads. |
| F5 | Provider ID/query interpolation | **Fixed**: regex validation, `encodeURIComponent`, stricter Drive query escaping. |
| F6 | Unbounded DB reads | **Fixed** for API reads (artifacts 200, chunk API 2000; existing list caps retained). Internal indexing paths intentionally read all chunks. |
| F7 | Raw console logging | **Fixed** for third-party/parser errors; remaining `console` calls are startup/config diagnostics only. |
| F8 | Bounded job dispatch/recovery (50 per call), in-process local fallback | **Partially fixed — Round 5**: a bounded periodic sweeper now drains backlog automatically in repeated ticks with an overlap guard; the 50-per-call bound and in-process fallback remain by design. See `BACKGROUND_JOB_RECOVERY.md`. |
| F9 | Test coverage gaps | **Fixed — Round 5**: real HTTP suites now cover auth/session, IDOR, CSRF, upload boundaries, OAuth callbacks, payment HTTP and webhook boundaries, plus provider-mocked payments and PostgreSQL job recovery. See `STAGING_SECURITY_TESTS.md`. |

The Round 4 audit found no high-confidence IDOR, CSRF bypass, payment
signature bypass, or SSRF exploit chain beyond the items above.

## 10. Migrations, verification and parity

- Forward-only migration
  `server/prisma/migrations/20261123160000_round3_concurrency_guards/migration.sql`
  adds the unique `Message.requestKey` index and changes the `User.credits`
  default to 0. It contains DDL only: no `UPDATE`, `DELETE`, or `DROP COLUMN`,
  and no historical rows are rewritten.
- Fresh disposable PostgreSQL verification: 13 migrations applied, migrate
  status clean, and `prisma migrate diff --exit-code --from-migrations ...
  --to-config-datasource` reported **No difference detected**.
- The only difference between migration history and `schema.prisma` is the
  legacy `Test` table, which the schema intentionally does not model. It is
  preserved in the database and is not dropped by any migration.
- Verification performed on the earlier Round 3/4 change set: Prisma
  validate/generate, `tsc --noEmit`, 120 unit tests, 12 real-PostgreSQL
  integration tests, server build, client build, Chromium Playwright E2E
  (3 tests), migration deploy/status/diff on a fresh disposable DB, secret
  scan, and `git -c core.whitespace=cr-at-eol diff --check`. The Round 5
  verification matrix (124 unit / 47 integration tests and rebuilt artifacts)
  is recorded in `RELEASE_READINESS_REPORT.md`.

Local validation pattern (never point these commands at a production DB):

```bash
cd server
npx prisma validate --schema prisma/schema.prisma
npx prisma generate --schema prisma/schema.prisma
npx tsc --noEmit
DATABASE_URL=<disposable-postgres-url> npx prisma migrate deploy
DATABASE_URL=<disposable-postgres-url> npm run test:unit
DATABASE_URL=<disposable-postgres-url> TEST_DATABASE_URL=<disposable-postgres-url> npm run test:integration
SHADOW_DATABASE_URL=<disposable-shadow-url> npx prisma migrate diff --exit-code \
  --from-migrations ./prisma/migrations --to-schema prisma/schema.prisma
```

## 11. Owner decisions and known limitations

- The repository remains **private** and is pushed only to `origin`
  (`ANUBprad/kairos`). No external repository contact was performed.
- `ATTRIBUTION.md`, copyright and licensing are unchanged. No license grant is
  invented by this work.
- No production deploy, production service access, secret/token exposure, or
  live provider call was performed. No automatic refunds, backfills or
  historical rewrites were applied.
- The legacy `Test` table is preserved.
- Remaining limitations: third-party Firecrawl network hop (section 1), bounded
  50-per-tick job recovery and in-process fallback (F8), the legacy `Test`
  schema/migration delta (section 10), and the absence of a controlled staging
  validation with live provider credentials. These must be evaluated before any
  production rollout. Route-level E2E gaps (F9) were closed in Round 5.

## 12. Round 5 — staging readiness changes

Round 5 focused on reproducible High/Medium audit findings and on making the
remaining live-only checks explicit. Engineering changes:

- **Private audio uploads**: removed the unauthenticated `express.static("uploads")`
  mount. Generated audio is reachable only via the ownership-checked
  `GET /api/audio/:workspaceId/:artifactId` byte-range route.
- **Automatic job recovery**: `createDurableJobSweeper()` periodically re-dispatches
  due `PENDING` jobs and recovers stale `PROCESSING` leases in bounded, guarded
  ticks; it is started by the server entrypoint. See `BACKGROUND_JOB_RECOVERY.md`.
- **Credit idempotency**: a `addCredits` idempotency key can no longer be reused
  by a different user or amount; the unique-race path re-validates the existing
  grant via `assertMatchingGrant`.
- **Provider hardening**: Gemini keys moved from the query string to the
  `x-goog-api-key` header; Cloudinary signed uploads use unique `public_id`,
  `overwrite: false` and a sanitized path; all 20 raw provider `fetch` calls now
  go through the shared 20-second-timeout `providerFetch()` helper. OAuth
  callbacks now clear the single-use state cookie **before** redirecting,
  removing an "Cannot set headers after they are sent" error and stale cookies.
- **Deployment identity**: `DEPLOYMENT_ENV` is explicit (`local`/`staging`/
  `production`) and live `rzp_live_*` keys are rejected outside production.
  `render.yaml` declares a separate staging service and all-secret `sync: false`
  env vars. See `STAGING_DEPLOYMENT.md` and `INTEGRATION_SECURITY.md`.
- **HTTP/CSRF/health**: `Sec-Fetch-Site: none` no longer bypasses the Origin
  check; `/health` (which queries dependencies) has its own rate limiter while
  `/healthz` stays unthrottled; `createApp()` in `server/src/app.ts` makes the
  real Express app testable without binding a port.

All changes remain within the private repository. No live staging deploy,
provider credential, payment, refund or production access was used; see
`RELEASE_READINESS_REPORT.md` for the final classification and labels.
