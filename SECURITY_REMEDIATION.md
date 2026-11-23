# Kairos — Round 2 remediation notes

This document describes the security and reliability behavior introduced by the
second remediation round. It is an engineering reference, not a production
readiness claim. Licensing and attribution remain a separate owner decision;
see `ATTRIBUTION.md`.

## 1. DNS-pinned outbound fetches

`server/src/lib/safe-fetch.ts` validates and pins the resolved IP address for
every outbound HTTP(S) connection:

- The URL scheme must be `http:` or `https:`; credentials and non-standard
  ports are rejected on the initial URL and on every redirect hop.
- Hostnames are resolved once per hop with `dns.lookup(..., { all: true })`.
  Every returned address must be a permitted public address.
- Private, loopback, link-local, multicast, reserved, CGNAT, benchmarking,
  documentation and IPv4-mapped-IPv6 addresses are rejected. WHATWG URL
  normalization plus explicit checks cover alternate numeric IPv4 forms.
- The validated address is supplied to the HTTP(S) client as the connection's
  lookup result. The original hostname is retained for the HTTP `Host` header
  and TLS SNI/certificate validation.
- The connected socket's peer address is compared to the pinned address where
  the runtime exposes it.
- Redirects are handled manually (max 3), each hop is independently validated
  and resolved, and non-HTTP(S) redirect targets are rejected.
- A total request timeout, a streamed response-size cap, and content-type
  checks remain in force.

Tests in `server/src/lib/safe-fetch.test.ts` use injected lookups/request
factories to prove that the connection uses the validated address and to
simulate DNS rebinding, hostile redirects, oversized responses and timeouts.

`server/src/lib/sources/firecrawl.ts` validates the user-supplied URL with the
same helper, but the subsequent network request is performed by the external
Firecrawl service, which resolves and connects from its own network. Local IP
pinning cannot cover that third-party hop; it remains an external-service
limitation rather than a gap in the local fetch implementation.

## 2. Credit debit/refund lifecycle and durable work

Charged operations now follow a single rule: **a charge and the durable record
of the work it pays for are committed together, or neither is committed.**

- `server/src/lib/outbox.ts` implements a transactional outbox with unique,
  deterministic keys and `PENDING → PROCESSING → DELIVERED | DEAD` states.
- Artifact and source creation insert their record, debit credits, update
  counters and insert an outbox row inside one `prisma.$transaction`. Any
  failure rolls the whole unit back, so no charge is left without work.
- Dispatch is attempted after commit, but acceptance is defined by the
  committed outbox row, not by an in-process fire-and-forget call.
- Inngest events use deterministic ids derived from the outbox key, so
  duplicate delivery is inert. Local development fallback still works, but
  it updates the outbox state rather than being treated as durable by itself.
- Failures release the job with bounded exponential retries. A job that
  exhausts its retries moves to `DEAD` and triggers a compensating refund only
  when the original debit exists and the work is not already `READY`.
- Refunds use stable keys (`*-refund:<id>`) and only refund an existing debit,
  so retries cannot double-refund and records with no debit cannot be refunded.
- `recoverAbandonedDurableJobs()` re-dispatches due `PENDING` jobs and returns
  stale `PROCESSING` jobs to `PENDING` after a bounded lease period, which
  makes recovery possible after a process restart.

Chat messages are synchronous rather than queued. The user message and charge
are committed first; failures before the stream is successfully constructed
refund the charge once and remove the message. Charges are never refunded
after an assistant message has been successfully persisted.

## 3. Artifact state transitions

Allowed transitions are enforced with conditional database updates in
`server/src/repository/artifact.repository.ts`:

- `PENDING → PROCESSING` (worker claim, with a lease token)
- `PROCESSING → READY` (only while holding the current lease)
- `PENDING | PROCESSING → FAILED` (only when eligible/expired; never `READY`)
- `FAILED → PENDING` (retry)

A stale sweep can only claim artifacts whose lease is absent or expired, so it
cannot fail a live generation job. Completion with a stale lease token cannot
overwrite a newer state. Only one worker can claim an artifact because the
claim is an atomic `updateMany` guarded by status and lease conditions. A
refund happens only when the conditional transition to `FAILED` succeeds.

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

## 5. Plan quota enforcement

`server/src/services/usage.services.ts` keeps the authoritative `PLAN_LIMITS`
table and enforces workspace, source, artifact and message limits on the
server. Source, artifact and message limits are checked before creation, with
a transactional re-check in the creation path where supported. Errors are
consistent `ForbiddenError` responses with code `LIMIT_REACHED` and details
`{ limitType, current, max, plan }`. Failed operations roll back their quota
effects with their transaction.

## 6. CSRF and request configuration

- Custom state-changing API routes are protected by explicit origin checks in
  `server/src/middleware/csrf.middleware.ts`. Same-origin requests (including
  `Sec-Fetch-Site: same-origin|none`) pass; cross-site or disallowed origins
  and missing `Origin` are rejected with 403.
- `/api/auth/*`, `/api/payment/webhook` (HMAC-verified) and `/api/inngest` are
  exempt by design and keep their own protections.
- Trusted origins come only from `CLIENT_URL` via `server/src/config/network.ts`.
  Localhost origins are added only outside production.
- `TRUST_PROXY` must be explicit. When a proxy hop count is configured, the
  production configuration fails closed instead of silently trusting arbitrary
  forwarded headers; forwarded-IP headers are read only when a proxy is
  explicitly trusted.

## 7. Signup credits

The `User.credits` database default still grants the welcome credits. A
Better Auth `user.create.after` hook records the matching idempotent
`SIGNUP_BONUS` ledger entry (`signup-credit:<userId>`). The helper never
changes the balance and never grants a second bonus on retries. Existing users
are not backfilled without owner approval.

## 8. Environment and local procedures

Required server environment variables are documented in `server/.env.example`
and `README.md`. For local validation:

```bash
cd server
npx prisma validate
npm run prisma:generate
DATABASE_URL=<disposable-postgres-url> npm run prisma:migrate
DATABASE_URL=<disposable-postgres-url> npm run test:unit
DATABASE_URL=<disposable-postgres-url> TEST_DATABASE_URL=<disposable-postgres-url> npm run test:integration
```

Never point migrations at an unidentified or production database. The legacy
`Test` table is intentionally preserved and is ignored by reconciliation.
