# Operations runbook (Kairos / Phase 06)

This runbook covers local/disposable operations and the staging deployment an
owner must perform. No production procedure is authorized by these changes.

## 1. Health and readiness

| Endpoint | Meaning | Throttling |
| --- | --- | --- |
| `GET /healthz` | Pure liveness. No DB/provider queries. Use as the Render health check. | None |
| `GET /health` | Dependency status (DB, optional Pinecone). | `healthLimiter`: 30 requests/minute per IP |

A failing `/health` with a healthy `/healthz` means a dependency is degraded,
not that the process should be restarted. Do not point deployment health checks
at `/health`. Monitoring/alert recommendations are in
`MONITORING_AND_ALERTING.md`.

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
migration/schema delta. Do not drop it. Full rollback guidance is in
`MIGRATION_AND_ROLLBACK.md`.

## 3. Backup and restore drill (disposable database)

Run only against infrastructure you own. Phase 06 used the throwaway container
`kairos-stage06-pg-20261123` (host port 55445, DB `kairos_stage06`) and a
**separate** disposable restore database:

```bash
docker exec kairos-stage06-pg-20261123 \
  pg_dump -U kairos -Fc kairos_stage06 > phase06-stage06.backup
# restore into a SEPARATE disposable database, never over the source:
docker exec -i <restore-container> \
  pg_restore -U kairos -d kairos_stage06_restore < phase06-stage06.backup
```

After restore, run `prisma migrate status` and the integration suites against
the restored database. Record the result in `RELEASE_READINESS_REPORT.md`.

## 4. Routine verification matrix

```bash
cd server
npx prisma validate
npx tsc --noEmit
npm run test:unit                  # 148 (Phase 07)
DATABASE_URL=<disposable-url> TEST_DATABASE_URL=<disposable-url> npm run test:integration  # 47
npm run build
cd ../client && npm run build
cd .. && npx playwright test       # 3 Chromium tests

# dependency gates (CI also runs these)
npm audit --audit-level=high --prefix server
npm audit --audit-level=high --prefix client
git diff --exit-code -- server/package-lock.json client/package-lock.json

git -c core.whitespace=cr-at-eol diff --check
```

The client build may hit a OneDrive file lock on `.next` in this workspace. A
temporary `VERIFY_DIST_DIR` override was used in an earlier phase and reverted;
no build config change is part of the commit. In Phase 07 an OS-level lock on a
single `property-information` source-map file blocked in-place `npm ci`; lockfile
reproducibility was instead verified with `npm ci` in a clean temporary directory
using the same `package.json`/`package-lock.json`, and the installed tree was
copied back. Only that 179-byte source map failed to copy; it is not used by the
build. The positive staging client build then passed.

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
- **Dependency regression**: CI fails on any critical/high advisory. Follow
  `DEPENDENCY_SECURITY_REMEDIATION.md`; do not run blind `npm audit fix` or
  disable the audit.

## 6. Secrets and configuration

- All environment credentials are `sync: false` in `render.yaml`; rotate them in
  the Render dashboard, never in git.
- `DEPLOYMENT_ENV=staging` requires `NODE_ENV=production`, `SERVER_URL`,
  `OAUTH_STATE_SECRET`, `STAGING_DATABASE_ID`, `STAGING_RESOURCE_PREFIX`, and
  rejects live/non-test Razorpay keys, production-looking DB endpoints, reused
  production DB URLs and unmarked Cloudinary resources. Startup fails closed.
- `TRUST_PROXY` must be explicit; numeric hop counts are dev-only. The patched
  `proxy-addr` and `proxy-trust.test.ts` protect rate limits from forwarded-IP
  spoofing.
- `OAUTH_STATE_SECRET` must be unique per environment and distinct from
  `BETTER_AUTH_SECRET` in staging.
- A configuration that fails validation is no longer cached; correcting the
  environment and restarting the process is sufficient.

## 7. Safe boundaries

- Only push to the private `origin` (`ANUBprad/kairos`). No external repository
  contact is authorized.
- No production deploy, production DB/service access, real payment/refund, real
  customer data or real email is authorized by these changes.
- Keep the repository private until the independent licensing gate in
  `LICENSING_REVIEW.md` is resolved by the owner.

## 8. Phase 07 staging-only deployment and drill

1. Verify the guard before any Render action:

   ```bash
   node scripts/check-staging-blueprint.mjs render.staging.yaml
   ```

2. Deploy **only** `render.staging.yaml` from private `origin/main`. Do not use
   the full `render.yaml`, which still contains the production service. Confirm
   only `kairos-server-staging` and `kairos-client-staging` exist/change.
3. Use `kairos-phase07-pg-20261123`-style throwaway databases only for local
   drills. Phase 07 backup evidence: 45,614-byte `pg_dump -Fc` artifact restored
   into the separate `kairos_phase07_restore` database in 1,385 ms; `prisma
   migrate status` reported 13/13 migrations and fixture counts matched (1 user,
   workspace, source, artifact, message, conversation, payment, ledger row and
   job), with all orphan/invariant counters zero.
4. Keep `render.yaml` unchanged as a reference; any change to it must not add a
   production service to the staging blueprint.
5. Phase 07 added fail-closed staging origin checks in both client and server,
   production identity checks, `TRUST_PROXY` IP/CIDR validation, bounded
   Cloudinary download URLs, redaction and combined provider signals. All have
   regression tests and the final matrix passed.
6. Clean only Phase 07-labelled containers after the drill. Other containers
   (`kairos-remediation-pg-20261123`, `kairos-postgres-1`, `kairos-postgres`)
   are unrelated and must be left untouched.

---

## Phase 08 operations note

Phase 08 added `kairos-phase08-pg-20261124` and the separate
`kairos-phase08-restore-20261124` container for a disposable backup/restore
drill; only those Phase 08-labelled containers are eligible for cleanup. The
staging deploy path now fails closed on migrations before app build. An early
`X-Request-Id` middleware adds correlation IDs to responses and error payloads;
propagation into Inngest/worker logs is still outstanding. Owner triage should
cover that propagation, automated backup scheduling and the pre-existing client
lint debt documented in `PHASE08_STAGING_DEPLOYMENT_AND_VALIDATION_REPORT.md`.
