# Operations runbook (Kairos)

This runbook covers local/disposable operations and the staging deployment an
owner must perform. No production procedure is authorized by these changes.

## 1. Health and readiness

| Endpoint | Meaning | Throttling |
| --- | --- | --- |
| `GET /healthz` | Pure liveness. No DB/provider queries. Use as the Render health check. | None |
| `GET /health` | Dependency status (DB, optional Pinecone). | `healthLimiter`: 30 requests/minute per IP |

A failing `/health` with a healthy `/healthz` means a dependency is degraded,
not that the process should be restarted. Do not point deployment health checks
at `/health`.

## 2. Migrations

Always apply checked-in migrations forward; never `prisma db push`:

```bash
cd server
DATABASE_URL=<target-url> npx prisma migrate deploy
DATABASE_URL=<target-url> npx prisma migrate status
```

On a fresh disposable database, verify parity:

```bash
SHADOW_DATABASE_URL=<disposable-shadow-url> npx prisma migrate diff --exit-code \
  --from-migrations ./prisma/migrations --to-schema prisma/schema.prisma
```

The legacy `Test` table is intentionally preserved and is the only known
migration/schema delta. Do not drop it.

## 3. Backup and restore drill (disposable database)

Run only against infrastructure you own. Example for the local staging-phase
container `kairos-stage05-pg-20261123` (host port 55444):

```bash
docker exec kairos-stage05-pg-20261123 pg_dump -U <db-user> -Fc kairos_stage05 > stage05.backup
# restore into a SEPARATE disposable database, never over the source:
docker exec -i kairos-stage05-pg-20261123 pg_restore -U <db-user> -d kairos_stage05_restore < stage05.backup
```

After restore, run `prisma migrate status` and the integration suites against
the restored database. Record the result in `RELEASE_READINESS_REPORT.md`.

## 4. Routine verification matrix

```bash
cd server
npx prisma validate
npx tsc --noEmit
npm run test:unit
DATABASE_URL=<disposable-url> TEST_DATABASE_URL=<disposable-url> npm run test:integration
npm run build
cd ../client && npm run build
cd .. && npx playwright test        # Chromium E2E (client/dev server running)
```

Then from the repo root:

```bash
git -c core.whitespace=cr-at-eol diff --check
```

## 5. Job and payment incident response

- **Stuck artifacts/sources**: check `durable_job` rows by `status` and
  `availableAt`. The periodic sweeper retries due `PENDING` and recovers stale
  `PROCESSING` jobs automatically. Do not mark jobs `DELIVERED` manually.
- **Poison jobs**: allowed to reach `DEAD` at `maxAttempts`; compensation refunds
  once. Investigate the payload before re-enqueueing with a **new** key and a
  new charge.
- **Duplicate completion**: outbox keys and conditional transitions prevent it;
  verify the ledger (`credit_transaction`) has at most one charge and at most
  one refund per resource before intervening.
- **Payment webhook failures**: confirm `RAZORPAY_WEBHOOK_SECRET` is set and
  matches the dashboard, then replay from the provider test dashboard. Invalid
  signatures are rejected by design. Never grant value manually from a forged
  body.

## 6. Secrets and configuration

- All environment credentials are `sync: false` in `render.yaml`; rotate them in
  the Render dashboard, never in git.
- `DEPLOYMENT_ENV=staging` must reject any `rzp_live_*` key at startup. If the
  service boots with a live key in staging, stop it and treat it as an incident.
- `TRUST_PROXY` must be explicit; numeric hop counts are dev-only.
- `OAUTH_STATE_SECRET` should be unique per environment.

## 7. Safe boundaries

- Only push to the private `origin` (`ANUBprad/kairos`). Never contact the
  upstream OpenBook repository or its owner.
- No production deploy, production DB/service access, real payment/refund, real
  customer data or real email is authorized by these changes.
- Keep the repository private until the licensing gate in `LICENSING_REVIEW.md`
  is resolved by the owner.
