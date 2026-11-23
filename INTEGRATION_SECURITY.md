# Integration, provider and payment security (Round 5)

**Status: provider-mocked tests PASSED; live provider/payment validation
`BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED`.** No live provider, Razorpay
test-mode, or email call was made while preparing these changes.

## 1. Shared outbound fetch hardening

All twenty raw provider `fetch` calls in `elevenlabs.ts`, `rag/rerank.ts`,
`sources/github.ts`, `sources/youtube.ts`, `google-drive.services.ts` and
`notion.services.ts` now go through `server/src/lib/provider-http.ts`:

- `providerFetch()` always applies a 20-second `AbortSignal.timeout()` unless
  the caller supplies its own signal.
- `PROVIDER_TIMEOUT_MS` is covered by `server/src/lib/provider-http.test.ts`
  (default signal added; explicit caller signal preserved). No provider is
  contacted by that unit test.

DNS-pinned, SSRF-resistant user-supplied URL fetching remains in
`server/src/lib/safe-fetch.ts` (see `SECURITY_REMEDIATION.md`, section 1); that
policy is unchanged.

## 2. Per-provider fixes

| Integration | Round 5 change |
| --- | --- |
| Gemini | API key moved from the URL query string to `x-goog-api-key`; 15s timeout. Keys no longer appear in URLs/logs. |
| Cloudinary | Signed uploads use a unique `public_id`, `overwrite: false` and a sanitized base path; raw upload calls have a 30s timeout. No hardcoded unsigned preset. |
| Google Drive / Notion / GitHub OAuth | State cookie cleared before `res.redirect()` on every callback branch; invalid state never yields `connected=`. |
| ElevenLabs / Cohere rerank / GitHub / YouTube / Drive / Notion | Raw fetches replaced with bounded `providerFetch()`. |
| All providers | Secrets remain `sync: false` in `render.yaml`; no credential value is committed or printed in logs. |

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

`DEPLOYMENT_ENV=staging` plus the `rzp_live_*` rejection in `config/env.ts`
ensures a staging service cannot accept live credentials. Live test-mode
checkout, webhook delivery from Razorpay, and provider refund behaviour remain
**BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED**.

## 4. Live checklist for the owner (not performed here)

1. Configure staging Razorpay test-mode keys and webhook secret; register
   `<staging-api>/api/payment/webhook` in the Razorpay test dashboard.
2. Complete a small test-mode checkout for a credit pack and for a subscription;
   confirm credits/plan in the staging DB exactly once.
3. Replay the same webhook twice and out of order with verification; confirm no
   duplicate ledger rows.
4. Trigger a cancellation/failure and confirm no grant.
5. Exercise a terminal artifact/source failure and confirm one compensating
   refund in the staging ledger.
6. For each provider, run one read-only/live call and confirm no secret appears
   in application logs or URLs.
