# Integration, provider and payment security (Phase 06)

**Status: provider-mocked tests PASSED; live provider/payment validation
`BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED`.** No live provider, Razorpay
test-mode, or email call was made while preparing these changes. All previously
critical/high dependency advisories are **FIXED AND VERIFIED** locally; details
and residual accepted moderate/low findings are in
`DEPENDENCY_SECURITY_REMEDIATION.md`.

## 1. Shared outbound fetch hardening

All twenty raw provider `fetch` calls in `elevenlabs.ts`, `rag/rerank.ts`,
`sources/github.ts`, `sources/youtube.ts`, `google-drive.services.ts` and
`notion.services.ts` go through `server/src/lib/provider-http.ts`:

- `providerFetch()` always applies a 20-second hard timeout. In Phase 07 a
  caller-supplied signal is **combined** with that timeout via `AbortSignal.any`
  instead of replacing it, so request cancellation still propagates without
  dropping the bound.
- `PROVIDER_TIMEOUT_MS` is covered by `server/src/lib/provider-http.test.ts`
  (default signal added; caller signal combined and propagation verified). No
  provider is contacted by that unit test.

DNS-pinned, SSRF-resistant user-supplied URL fetching remains in
`server/src/lib/safe-fetch.ts` (see `SECURITY_REMEDIATION.md`, section 1); that
policy is unchanged.

## 2. Per-provider fixes

| Integration | Change |
| --- | --- |
| Gemini | API key moved from the URL query string to `x-goog-api-key`; 15s timeout. Keys no longer appear in URLs/logs. |
| Cloudinary | Signed uploads use a unique `public_id`, `overwrite: false` and a sanitized base path; raw upload calls have a 30s timeout. No hardcoded unsigned preset. Staging gates require a staging-owned cloud name/upload preset. Phase 07 replaced `cloudinary.url()` with `cloudinary.utils.private_download_url()` so private download links carry a real one-hour `expires_at` and a matching signature; a Cloudinary 403 now returns only a generic client error, with dashboard guidance logged server-side. |
| Google Drive / Notion / GitHub OAuth | State cookie cleared before `res.redirect()` on every callback branch; invalid state never yields `connected=`. |
| ElevenLabs / Cohere rerank / GitHub / YouTube / Drive / Notion | Raw fetches replaced with bounded `providerFetch()`. |
| All providers | Secrets remain `sync: false` in `render.yaml`; no credential value is committed or printed in logs. |
| Provider SDKs (Phase 06) | `better-auth 1.7.27`, `firecrawl 4.54.0`, `inngest 4.26.2`, `mem0ai 3.3.1`, `multer 2.5.0`, `zod 4.6.7` and patched transitive overrides; full verification matrix passed. |

Provider-specific hardening already present and unchanged: restrictive provider
ID validation and URL encoding, escaped Drive query terms, redacting logger,
2 MB generic body cap, magic-byte-checked upload limits.

## 3. Payment validation — provider-mocked PASS, live sandbox BLOCKED

`server/src/integration/payment-sandbox.integration.test.ts` (11 tests) exercises
the **real** settlement service, HMAC verification, payment repository and
PostgreSQL ledger with an injected `PaymentProvider` (test-only injection point
in `payment.services.ts`). No Razorpay network call occurs.

Verified invariants:

- Server-owned pricing: a client cannot choose the amount; credit packs and
  `PRO`/`PRO_PLUS` use configured values. Invalid amounts, quantities and plans
  are rejected before the provider is contacted.
- Checkout HMAC: tampered order ids, forged signatures and wrong users cannot
  settle or grant value.
- Webhook HMAC: invalid, missing and malformed signatures/payloads are rejected;
  failed/cancelled payments and unknown orders are ignored.
- Idempotency: duplicate and concurrent webhook deliveries settle **once**;
  webhook-before-verification and verification-before-webhook both settle once.
- Fail closed: ambiguous legacy records are rejected without granting a plan or
  credits. Provider failures create no payment record.
- Financial invariants in PostgreSQL: exactly one `PURCHASE` credit transaction
  per settlement, correct final credit balance and plan, and exactly one refund
  for a matching eligible debit to the correct user (wrong-user refund denied).

`DEPLOYMENT_ENV=staging` plus the `rzp_live_*` and non-test-key rejection in
`config/env.ts` ensures a staging service cannot accept live credentials. Live
test-mode checkout, webhook delivery from Razorpay, and provider refund
behaviour remain **BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED**.

## 4. Live checklist for the owner (not performed here)

1. Configure staging Razorpay test-mode keys, webhook secret, DB identity and
   storage prefix gates; register `<staging-api>/api/payment/webhook` in the
   Razorpay test dashboard.
2. Complete a small test-mode checkout for a credit pack and for a subscription;
   confirm credits/plan in the staging DB exactly once.
3. Replay the same webhook twice and out of order with verification; confirm no
   duplicate ledger rows.
4. Trigger a cancellation/failure and confirm no grant.
5. Exercise a terminal artifact/source failure and confirm one compensating
   refund in the staging ledger.
6. For each provider, run one read-only/live call and confirm no secret appears
   in application logs or URLs. Live Inngest/Mem0 validation is specifically
   required because the nested `zod` major override passed typecheck/build/tests
   but was not exercised against a real provider.

## 5. Phase 07 security review and hardening

Two independent read-only source audits (auth/session/IDOR/CSRF/OAuth/payments/
jobs, and SSRF/uploads/logging/proxy/health/error handling) found **no confirmed
P0 or P1 findings**. The underlying logic—not merely test presence—was traced:
HMAC verification over raw webhook bodies, atomic settlement/idempotency keys,
owner-scoped repositories, single-use HMAC-signed OAuth state with cookie nonce
binding, DNS-pinned per-hop SSRF validation, fail-closed proxy trust, and
conditional job/artifact transitions.

Safe P2/P3 hardening applied with regression tests (all **FIXED AND VERIFIED**
locally):

- Cloudinary `expires_at` (one-hour expiring private URLs), generic 403 response.
- Logger redaction extended to free-form messages, session/OTP/card keys and
  provider key patterns (`sk-`, `rzp_test_/rzp_live_`, `AIza`, `gh*`).
- Combined provider abort signals; redirect sockets released immediately.
- `TRUST_PROXY` IP/CIDR validation and one unified production predicate used by
  CORS, Better Auth, OAuth cookies and env validation; production identity can
  no longer be downgraded with `NODE_ENV=development`.
- Client staging rewrite and server staging-origin gates.

Live provider/Inngest/Mem0/Razorpay validation and the Zod 4 smoke test over a
real Inngest/Mem0 deployment remain **BLOCKED — CREDENTIALS/PERMISSIONS
REQUIRED**; the provider-mocked suites are not a substitute. Residual moderate/
low dependency advisories remain **ACCEPTED RISK — OWNER APPROVAL REQUIRED**.
