# HTTP / security test evidence (Round 5)

**Status: PASSED for local real-HTTP coverage; live HTTPS checks
`BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED`.** All tests described here run the
actual Express application created by `createApp()` in `server/src/app.ts` over
a real TCP socket with a real PostgreSQL database. They do not stub controllers,
middleware, services, or the ORM. Each suite creates synthetic fixtures and
deletes them in `after()` hooks.

## 1. How to run

From `server/`, with an isolated disposable database:

```bash
. <path-to-stage05-env.ps1>          # sets DATABASE_URL / TEST_DATABASE_URL only for the disposable DB
npm run test:http                    # 18 tests
npm run test:jobs                    # 6 tests
npm run test:payments                # 11 tests
npm run test:integration             # all 47 (includes the earlier 12)
```

`npm run test:unit` (124 tests) needs no database. Never set `TEST_DATABASE_URL`
to a shared or production database — the suites delete rows they create.

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

Two real defects were found and fixed while writing this suite:

1. `express.static("uploads")` exposed generated podcast audio without an
   ownership check. Removed; audio is served only by
   `GET /api/audio/:workspaceId/:artifactId`.
2. OAuth callbacks cleared the state cookie in `finally` **after**
   `res.redirect()` had ended the response, producing
   `Cannot set headers after they are sent` and leaving a stale nonce cookie.
   `redirectClearingState()` now clears the cookie before redirecting on every
   success and failure branch of all three providers.

## 3. `job-recovery.integration.test.ts` — 6/6 PASS

Exercised against PostgreSQL; see `BACKGROUND_JOB_RECOVERY.md` for detail.

## 4. `payment-sandbox.integration.test.ts` — 11/11 PASS

Provider-mocked lifecycle; see `INTEGRATION_SECURITY.md` for detail.

## 5. Live staging checks still required (owner)

These cannot be performed locally and remain blocked until staging access and
credentials exist:

- HTTPS redirect, HSTS, Secure/HttpOnly/SameSite session cookies on a real
  domain (verify with `curl -I` and browser dev tools).
- Real OAuth redirect round-trips with staging-registered callback URLs.
- Real Razorpay **test-mode** checkout, signed webhook delivery and cancellation.
- Real provider integrations (Firecrawl, Tavily, Cloudinary, Pinecone,
  ElevenLabs, Gemini/OpenAI, Mem0, Inngest).
- Real email delivery, if enabled.

Record each result in `RELEASE_READINESS_REPORT.md`; do not mark them passed
based on mocked tests.
