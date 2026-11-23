# HTTP / security test evidence (Phase 06)

**Status: PASSED for local real-HTTP and configuration coverage; live HTTPS
checks `BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED`.** All tests described here
run either the actual Express application created by `createApp()` over a real
TCP socket with real PostgreSQL, or real configuration/HTTP primitives. They do
not stub controllers, middleware, services or the ORM. Integration suites
create synthetic fixtures and delete them in `after()` hooks.

## 1. How to run

From `server/`, with an isolated disposable database (only local throwaway
credentials):

```bash
$env:DATABASE_URL='postgresql://kairos:<local-only>@127.0.0.1:55445/kairos_stage06'
$env:TEST_DATABASE_URL=$env:DATABASE_URL
npm run test:unit            # 137 tests, no database required
npm run test:http            # 18 real-HTTP tests
npm run test:jobs            # 6 durable-job recovery tests
npm run test:payments        # 11 provider-mocked payment tests
npm run test:integration     # all 47 (12 concurrency + 18 + 6 + 11)
```

Never set `TEST_DATABASE_URL` to a shared, staging-with-real-data or production
database — the suites delete rows they create.

## 2. `http-security.integration.test.ts` — 18/18 PASS

Real Express routes/middleware/services/DB, covering:

| Area | Assertions |
| --- | --- |
| Liveness | `/healthz` answers 200 without session or dependency calls |
| Authentication | protected API rejects anonymous, malformed and invalid session cookies; signup → session use → logout → access revoked; invalid credentials rejected |
| Error hygiene | 404/500 responses do not leak internal details |
| IDOR | user A cannot read/update/delete user B's workspace; cannot access another user's sources, artifacts or conversations; guessed/malformed ids rejected |
| CSRF | same-origin state changes accepted; cross-origin, missing Origin, malformed Origin and `Sec-Fetch-Site: cross-site`/`none` rejected; webhook path stays exempt but invalid HMAC rejected |
| Upload boundary | unauthenticated multipart upload rejected; no public static audio mount |
| OAuth state | all three callbacks (Google Drive, Notion, GitHub) reject missing/tampered state, clear the state cookie on the response, and never emit a `connected=` success redirect for invalid state |
| Payment HTTP | forged webhook cannot grant credits; signed webhook with an unknown order does not grant value |

Earlier defects fixed by this suite and still covered: unauthenticated static
audio mount removed, and state cookies cleared before `res.redirect()` on every
callback branch.

## 3. `proxy-trust.test.ts` — 6/6 PASS (new, Phase 06)

Regression coverage for `GHSA-jqcg-44mw-7w3h` / `CVE-2026-90711`:

- untrusted socket IP wins over `X-Forwarded-For`;
- explicit trusted IPv4 and IPv6 proxies still work;
- the vulnerable short-prefix `::ffff:10.0.0.0/8` trust string no longer makes
  an arbitrary client trusted (patched `proxy-addr@2.0.8`);
- a genuine IPv4-mapped proxy address is still accepted;
- a live HTTP rate-limit test proves three spoofed forwarding headers from the
  same socket produce `200, 200, 429` rather than resetting the bucket.

## 4. `env.test.ts` — 9/9 PASS (expanded in Phase 06)

Staging fail-closed gates: test-only Razorpay keys, production `NODE_ENV`,
mandatory identity markers/secrets, distinct OAuth state secret, DB identity and
production-endpoint rejection, forbidden endpoint denylist, storage ownership,
and a regression proving failed validation is not cached.

## 5. Job and payment suites

- `job-recovery.integration.test.ts` — 6/6 PASS; see
  `BACKGROUND_JOB_RECOVERY.md`.
- `payment-sandbox.integration.test.ts` — 11/11 PASS; see
  `INTEGRATION_SECURITY.md`.

## 6. Live staging checks still required (owner)

These cannot be performed locally and remain **BLOCKED — CREDENTIALS/PERMISSIONS
REQUIRED**:

- HTTPS redirect, HSTS, Secure/HttpOnly/SameSite session cookies on a real
  domain (verify with `curl -I` and browser dev tools).
- Staging frontend `/api` rewrites and CORS/CSRF behaviour through the real
  staging hostname.
- Real OAuth redirect round-trips with staging-registered callback URLs.
- Real Razorpay **test-mode** checkout, signed webhook delivery, cancellation
  and refund.
- Real provider integrations (Firecrawl, Tavily, Cloudinary, Pinecone,
  ElevenLabs, Gemini/OpenAI, Mem0, Inngest).
- Real email delivery and live monitoring/alerts, if enabled.

Record each result in `RELEASE_READINESS_REPORT.md`; do not mark them passed
based on mocked tests.
