# Staging deployment guide (Kairos / Round 5)

**Status: IMPLEMENTED — LIVE VALIDATION BLOCKED.** This document describes a
reproducible, isolated staging configuration and the exact steps an owner with
Render/provider access must perform. No staging deployment was performed while
preparing these changes because no staging account, credentials, or permissions
were supplied. Nothing here invents credentials or contacts upstream.

## 1. Environment separation contract

| Concern | Local disposable (used for verification here) | Staging (owner to deploy) | Production |
| --- | --- | --- | --- |
| Database | Throwaway PostgreSQL container `kairos-stage05-pg-20261123` | Separate staging database, never production's | Separate production database |
| `NODE_ENV` | `test` / `development` | `production` (real Express middleware) | `production` |
| `DEPLOYMENT_ENV` | `local` | `staging` | `production` |
| Razorpay | none / injected mock | `rzp_test_*` **test mode only** | live keys, owner approval only |
| OAuth callbacks | localhost | staging callback URLs registered with providers | production callback URLs |
| Signing secrets | throwaway strings | unique staging secrets | unique production secrets |
| Data | synthetic only | synthetic/test accounts only | real data (out of scope here) |

`server/src/config/env.ts` enforces the payment boundary: if `DEPLOYMENT_ENV`
is `local` or `staging` and `RAZORPAY_KEY_ID` starts with `rzp_live_`, startup
fails closed with `Live Razorpay credentials are not allowed in local or staging
deployments.` Staging therefore cannot accidentally use a live key.

## 2. Manifest

`render.yaml` declares two web services:

- `openbook-server` (production) with `DEPLOYMENT_ENV=production`.
- `kairos-server-staging` with `DEPLOYMENT_ENV=staging`.

Every credential in the manifest is `sync: false`; no secret value is committed.
Both services use `/healthz` as the deployment health check (pure liveness, no
dependency queries) and `npm start` from `server/`.

> Owner note: deploying the whole blueprint provisions **both** services. To
> deploy staging alone, use a separate blueprint containing only the staging
> block (or deploy from an isolated branch). Committing `render.yaml` does not
> deploy anything by itself.

## 3. Required staging variables

Set these in the Render dashboard for the staging service. Use the staging
database's **internal** URL on Render; use the external URL only from your own
machine for migrations/Studio.

Core: `NODE_ENV=production`, `DEPLOYMENT_ENV=staging`, `DATABASE_URL`,
`CLIENT_URL`, `SERVER_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`OAUTH_STATE_SECRET`, `TRUST_PROXY` (explicit allowed proxies, or unset).

OAuth (staging-registered apps/callbacks): `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GITHUB_CLIENT_ID`,
`GITHUB_CLIENT_SECRET`, `GITHUB_REDIRECT_URI`, `NOTION_CLIENT_ID`,
`NOTION_CLIENT_SECRET`, `NOTION_REDIRECT_URI`.

Providers (test/dev keys where the vendor offers them): `OPENAI_API_KEY`,
`GEMINI_API_KEY`, `ELEVENLABS_API_KEY`, `PINECONE_API_KEY`, `PINECONE_INDEX`,
`EMBEDDING_DIMENSIONS`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET`, `CLOUDINARY_UPLOAD_PRESET`, `FIRECRAWL_API_KEY`,
`TAVILY_API_KEY`, `COHERE_API_KEY`, `MEM0_API_KEY`.

Payments: `RAZORPAY_KEY_ID` (`rzp_test_*`), `RAZORPAY_KEY_SECRET`,
`RAZORPAY_WEBHOOK_SECRET`. Register the staging webhook URL in the Razorpay
test-mode dashboard and point it at `/api/payment/webhook`.

Inngest: leave all `INNGEST_*` variables unset for in-process jobs plus the
periodic sweeper, or set all of `INNGEST_USE_CLOUD`, `INNGEST_EVENT_KEY`,
`INNGEST_SIGNING_KEY`, `INNGEST_SERVE_ORIGIN` for a dedicated staging Inngest
environment. Never set `INNGEST_DEV=1` on Render.

## 4. Deployment sequence (owner, with credentials)

1. Create a new staging PostgreSQL database on Render and copy its internal
   connection string into the staging service's `DATABASE_URL`.
2. Configure all variables in section 3. Confirm no `rzp_live_*` key is used.
3. Deploy the staging service. Confirm `/healthz` returns 200 and `/health`
   reports the database (and any configured optional dependency) as healthy.
4. Apply migrations from a trusted machine against the **staging** URL only:

   ```bash
   cd server
   DATABASE_URL=<staging-external-url> npx prisma migrate deploy
   DATABASE_URL=<staging-external-url> npx prisma migrate status
   ```

   Do not use `prisma db push`; do not run against production.
5. Register OAuth redirect URIs and the Razorpay test webhook with the exact
   staging host. Run the manual checks in `STAGING_SECURITY_TESTS.md`.
6. Seed only synthetic users/workspaces. Never import production data.
7. Record results and signatures in `RELEASE_READINESS_REPORT.md` before
   considering any production promotion.

## 5. What was verifiable without a staging account

The following were run locally against the disposable PostgreSQL container and
are documented in `RELEASE_READINESS_REPORT.md`:

- Prisma validate / migrate deploy / migrate status / migration diff parity.
- TypeScript type-check, server and client builds.
- Unit tests and real-PostgreSQL integration tests, including real Express HTTP
  routes, job recovery and provider-mocked payments.
- Backup/restore drill on the disposable database.

The following remain **BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED**: actual
Render deployment, HTTPS cookie flags on a real domain, live provider calls,
live Razorpay test-mode checkout/webhook delivery, and live email delivery.
