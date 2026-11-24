# Staging deployment guide (Kairos / Phase 06)

**Status: IMPLEMENTED — LIVE VALIDATION REQUIRED.** This document describes a
reproducible, isolated staging configuration and the exact steps an owner with
Render/provider access must perform. No staging deployment was performed while
preparing these changes because no staging account, credentials, or permissions
were supplied. Nothing here invents credentials or contacts upstream.

The critical/high dependency findings that previously blocked a staging
candidate are **FIXED AND VERIFIED** locally (see
`DEPENDENCY_SECURITY_REMEDIATION.md`); residual moderate/low advisories are
**ACCEPTED RISK — OWNER APPROVAL REQUIRED**.

## 1. Environment separation contract

| Concern | Local disposable (used for verification here) | Staging (owner to deploy) | Production |
| --- | --- | --- | --- |
| Database | Throwaway PostgreSQL container `kairos-stage06-pg-20261123` (host port 55445, DB `kairos_stage06`) | Separate staging database, never production's | Separate production database (out of scope) |
| `NODE_ENV` | `test` / `development` | `production` (real Express middleware and secure cookies) | `production` |
| `DEPLOYMENT_ENV` | `local` | `staging` | `production` |
| Identity marker | n/a | `STAGING_DATABASE_ID` must appear in DB URL; `STAGING_RESOURCE_PREFIX` must appear in staging storage resources | explicit `production` |
| Razorpay | none / injected mock | `rzp_test_*` **test mode only** | live keys, owner approval only |
| OAuth callbacks | localhost | staging callback URLs registered with providers | production callback URLs |
| Signing secrets | throwaway strings | unique staging secrets (`OAUTH_STATE_SECRET` distinct from `BETTER_AUTH_SECRET`) | unique production secrets |
| Data | synthetic only | synthetic/test accounts only | real data (out of scope here) |

`server/src/config/env.ts` now fails closed when `DEPLOYMENT_ENV=staging` if:

- `NODE_ENV` is not `production`;
- `SERVER_URL`, `OAUTH_STATE_SECRET`, `STAGING_DATABASE_ID` or
  `STAGING_RESOURCE_PREFIX` is missing/placeholder;
- `OAUTH_STATE_SECRET` equals `BETTER_AUTH_SECRET`;
- the DB URL does not contain `STAGING_DATABASE_ID`, matches
  `PRODUCTION_DATABASE_URL`, or has a production-looking host/DB name;
- `STAGING_FORBIDDEN_ENDPOINTS` matches a configured endpoint;
- Cloudinary cloud name/upload preset is not staging-owned;
- Razorpay credentials are live (`rzp_live_*`) or are non-test when supplied.

The same module no longer caches a configuration that failed validation
(regression test in `server/src/config/env.test.ts`).

## 2. Manifest

`render.yaml` declares three web services:

- `openbook-server` (production; do not deploy from this workflow).
- `kairos-server-staging` (`DEPLOYMENT_ENV=staging`) with the identity gates
  above.
- `kairos-client-staging` (dedicated Next.js frontend for staging; browser URLs
  via `NEXT_PUBLIC_*`, internal rewrite target via `BACKEND_INTERNAL_URL`).

Every credential in the manifest is `sync: false`; no secret value is committed.
Both server services use `/healthz` as the deployment health check (pure
liveness, no dependency queries). The staging frontend uses its normal Next.js
start command.

> Owner note: deploying the whole blueprint provisions **all** services. To
> deploy staging alone, use a separate blueprint containing only the staging
> backend and frontend blocks. Committing `render.yaml` does not deploy
> anything by itself. Point the staging backend's `CLIENT_URL` at the staging
> frontend URL.

## 3. Required staging variables

Set these in the Render dashboard for the staging backend. Use the staging
database's **internal** URL on Render; use the external URL only from your own
machine for migrations/Studio.

Core: `NODE_ENV=production`, `DEPLOYMENT_ENV=staging`, `DATABASE_URL`,
`CLIENT_URL`, `SERVER_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`OAUTH_STATE_SECRET`, `TRUST_PROXY` (explicit allowed proxies, or
unset), `STAGING_DATABASE_ID`, `STAGING_RESOURCE_PREFIX`. Optional:
`STAGING_FORBIDDEN_ENDPOINTS`, `PRODUCTION_DATABASE_URL`.

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

Staging frontend: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_BETTER_AUTH_URL`, and
`BACKEND_INTERNAL_URL` (server-side rewrite target only). See
`client/.env.example`; never put backend secrets in `NEXT_PUBLIC_*` variables.

Inngest: leave all `INNGEST_*` variables unset for in-process jobs plus the
periodic sweeper, or set all of `INNGEST_USE_CLOUD`, `INNGEST_EVENT_KEY`,
`INNGEST_SIGNING_KEY`, `INNGEST_SERVE_ORIGIN` for a dedicated staging Inngest
environment. Never set `INNGEST_DEV=1` on Render.

## 4. Deployment sequence (owner, with credentials)

1. Create a new staging PostgreSQL database on Render and copy its internal
   connection string into the staging service's `DATABASE_URL`. Ensure the
   database name/host contains the value chosen for `STAGING_DATABASE_ID`.
2. Configure all variables in section 3. Confirm no `rzp_live_*` key is used and
   that the service starts with the identity gates enabled.
3. Deploy the staging backend and frontend. Confirm backend `/healthz` returns
   200 and `/health` reports the database (and any configured optional
   dependency) as healthy; confirm the frontend loads and its `/api` rewrites
   reach the staging backend.
4. Apply migrations from a trusted machine against the **staging** URL only:

   ```bash
   cd server
   DATABASE_URL=<staging-external-url> npx prisma migrate deploy
   DATABASE_URL=<staging-external-url> npx prisma migrate status
   ```

   Do not use `prisma db push`; do not run against production.
5. Register OAuth redirect URIs and the Razorpay test webhook with the exact
   staging host. Run the manual checks in `STAGING_SECURITY_TESTS.md` and
   configure alerts from `MONITORING_AND_ALERTING.md`.
6. Seed only synthetic users/workspaces. Never import production data.
7. Record results in `RELEASE_READINESS_REPORT.md` before considering any
   production promotion. Follow `MIGRATION_AND_ROLLBACK.md` for incidents.

## 5. What was verifiable without a staging account

The following were run locally against the disposable PostgreSQL container and
are documented in `RELEASE_READINESS_REPORT.md`:

- Prisma validate / generate / migrate deploy / migrate status.
- TypeScript type-check, unit tests (137), server and client builds, Playwright.
- Real-PostgreSQL integration tests (47), including real Express HTTP routes,
  job recovery and provider-mocked payments.
- Staging identity/env gate tests (9) and proxy-IP spoofing regression tests (6).
- Backup/restore drill on the disposable database into a separate disposable
  restore database.

The following remain **BLOCKED — CREDENTIALS/PERMISSIONS REQUIRED**: actual
Render deployment, HTTPS/cookie flags on a real domain, live provider calls,
live Razorpay test-mode checkout/webhook delivery, and live email delivery.

## 6. Phase 07 — staging-only blueprint (highest-priority change)

The three-service `render.yaml` is left intact as the historical/reference
manifest, but it is **not** the deployment entry point for this workflow. A new,
dedicated blueprint `render.staging.yaml` contains **exactly** these two services:

- `kairos-server-staging` (backend, `NODE_ENV=production`,
  `DEPLOYMENT_ENV=staging`, `/healthz` liveness check)
- `kairos-client-staging` (frontend, staging `NEXT_PUBLIC_*` browser URLs and
  staging-only `/api` rewrite target)

The production service is absent by construction. Every credential remains
`sync: false`; no secret value, live Razorpay key or production URL is present.

### 6.1 Automated guard

```bash
node scripts/check-staging-blueprint.mjs render.staging.yaml
# STAGING BLUEPRINT GUARD: PASS (2 staging services, no production service)
```

The dependency-free guard runs in CI as the `staging-blueprint-guard` job. It
fails if a third service, the production service name, an inline secret value, a
non-`web` service, a non-`/healthz` health check, or a wrong environment marker
is introduced. Result: **FIXED AND VERIFIED**.

### 6.2 Owner deployment (only with Render access)

```bash
# In the private Render dashboard: "Blueprint > Deploy from a repository file"
# Repository: ANUBprad/kairos  Branch: main  File: render.staging.yaml
# Set every sync:false value in the dashboard, then create the two services.
```

1. Create a dedicated staging PostgreSQL database first. Its connection string
   must contain the `STAGING_DATABASE_ID` you configure, and must not equal
   `PRODUCTION_DATABASE_URL`.
2. Set `CLIENT_URL` to the public `kairos-client-staging` HTTPS URL and
   `SERVER_URL`/`NEXT_PUBLIC_API_URL`/`NEXT_PUBLIC_BETTER_AUTH_URL` to the public
   `kairos-server-staging` HTTPS URL. `BACKEND_INTERNAL_URL` is the server-side
   rewrite target only and must be staging-marked (or equal the public staging
   API URL); it is never a secret or a `NEXT_PUBLIC_*` value.
3. Confirm no production service was created, updated, restarted or redeployed.
4. Record deployment IDs, service URLs, commit SHA and timestamps in
   `PHASE07_STAGING_VALIDATION_REPORT.md`.
5. Apply migrations with `prisma migrate deploy` against the staging URL only.

### 6.3 Phase 07 fail-closed additions

- `client/lib/env.ts`: with `DEPLOYMENT_ENV=staging`, both browser-facing URLs
  and the rewrite target must be HTTPS, credential-free, staging-marked and not
  production-like. A negative build with `BACKEND_INTERNAL_URL` pointed at a
  production-looking host correctly failed with
  `BACKEND_INTERNAL_URL looks like production; refusing staging rewrite`.
- `server/src/config/env.ts`: `CLIENT_URL` and `SERVER_URL` must be HTTPS,
  credential-free, staging-owned and non-production-like; a production-labelled
  deployment can no longer run with `NODE_ENV=development`, and
  `BETTER_AUTH_URL`/`SERVER_URL` are mandatory and validated in production.
- `server/src/config/network.ts`, `auth.ts`, `oauth-state.ts`: one shared
  production predicate now includes `DEPLOYMENT_ENV=production`, closing the
  split-identity cookie/CORS downgrade path. `TRUST_PROXY` entries must be IP or
  CIDR tokens (numeric hop counts remain development-only).

No Render credentials were present in this environment, so no deployment
occurred. Overall Phase 07 classification is `C. READY FOR STAGING DEPLOYMENT`;
the independent licensing classification remains `E`.

---

## Phase 08 deployment note

Deploy **only** `render.staging.yaml`. The backend `buildCommand` now runs
`npm install --include=dev && npx prisma migrate deploy && npx prisma migrate status && npm run build`;
no paid-only `preDeployCommand` is used, and `DATABASE_URL` must be configured
as a private build-time variable for staging. The canonical blueprint guard and
the legacy staging-identity guard both pass in CI. Phase 08 still produced no
Render service IDs, deployment IDs, URLs, timestamps or build logs because
credentials were unavailable; record those only from the owner's private
dashboard after deployment.
