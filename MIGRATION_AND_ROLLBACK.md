# Migration and rollback plan (Kairos / Phase 06)

Status: **FIXED AND VERIFIED** for forward migrations on a fresh disposable
PostgreSQL database. The rollback procedure is documented and rehearsed only on
disposable infrastructure; production execution remains
**IMPLEMENTED — LIVE VALIDATION REQUIRED** and is not authorized here.

## 1. Migration policy

- Apply checked-in migrations forward only:
  `DATABASE_URL=<target> npx prisma migrate deploy` (from `server/`).
- Never use `prisma db push`, hand-edit `_prisma_migrations`, reset, or rewrite
  history to repair drift.
- Verify with `npx prisma migrate status` after every deploy and record the
  applied migration count and commit SHA.
- Thirteen migrations are checked in; all applied cleanly to a fresh
  `kairos_stage06` database. `prisma migrate diff` shows only the pre-existing
  legacy `Test` table delta, which is intentionally preserved and not modelled
  in `schema.prisma`. No other drift was found.

## 2. Pre-deploy checklist (owner, staging only)

1. Confirm the target is the **staging** database: `DEPLOYMENT_ENV=staging`,
   `NODE_ENV=production`, `DATABASE_URL` contains `STAGING_DATABASE_ID`, and no
   `rzp_live_*` key or production endpoint is present. Startup gates in
   `server/src/config/env.ts` enforce this and fail closed.
2. Take a logical backup (`pg_dump -Fc`) of the staging database and store it in
   the owner-controlled private location with a retention note.
3. Record the current application commit, `prisma migrate status` output and the
   backup artifact identifier. This is the application rollback reference.
4. Deploy the application and then run `prisma migrate deploy` against staging;
   re-run `migrate status`. Do not run migrations against production from this
   workflow.

## 3. Rollback paths

### Application-only rollback (preferred when schema is unchanged)

Redeploy the previous known-good commit/image to the same staging database.
Because migrations are forward-only and additive, previously generated columns
and tables are left in place. Do **not** reverse a migration by editing files
or resetting git history. Confirm `/healthz`, `/health`, auth, ledger and job
smoke checks after redeploy.

### Database rollback (only when a migration caused the incident)

1. Stop writes to the affected staging service (or scale it to zero) and keep
   the failed backup/incident artifacts.
2. Create a **new** disposable/restored staging database. Never overwrite the
   live staging database in place.
3. Restore the pre-deploy `pg_dump -Fc` artifact with `pg_restore` into the new
   database. Verify `prisma migrate status` and critical-table parity before
   repointing the service.
4. Repoint `DATABASE_URL` at the restored database through the private Render
   dashboard; keep the staging identity gates satisfied (`STAGING_DATABASE_ID`
   must appear in the new URL).
5. Re-run unit/integration smoke checks with synthetic data only, then resume
   writes. Record the decision and verification in the release report.

If the restore cannot satisfy the staging identity gate or migration status,
stop and escalate rather than bypassing the gate.

## 4. Disposable backup/restore drill (performed locally)

The drill used two separate throwaway databases created for Phase 06:

```bash
# source: kairos-stage06-pg-20261123 (host port 55445)
docker exec kairos-stage06-pg-20261123 \
  pg_dump -U kairos -Fc kairos_stage06 > phase06-stage06.backup

# target: a SEPARATE disposable database/container, never the source
docker exec -i <restore-container> \
  pg_restore -U kairos -d kairos_stage06_restore < phase06-stage06.backup
```

A synthetic fixture (1 user, 1 workspace, 1 source, 1 artifact, 1 `PURCHASE`
ledger row and 1 `DELIVERED` job) was inserted into the disposable source before
the final dump. After restore, `prisma migrate status` reported all 13 migrations
applied; read-only SQL confirmed the same fixture counts in the restored DB and
zero orphan sources/artifacts, zero refunds without a purchase, zero `DEAD` jobs
and zero stale `PROCESSING` jobs. The synthetic fixture was then deleted from the
source DB, which was verified back to zero rows. Exact results are also recorded
in `RELEASE_READINESS_REPORT.md`.

## 5. Verification queries (read-only, synthetic data only)

Use against disposable staging data; never export real customer rows.

```sql
-- migration ledger and core tables
SELECT count(*) AS applied_migrations FROM _prisma_migrations;
SELECT count(*) AS users FROM "user";
SELECT count(*) AS workspaces FROM workspace;
SELECT count(*) AS sources FROM source;
SELECT count(*) AS artifacts FROM learning_artifact;

-- financial and job consistency
SELECT count(*) AS purchase_rows FROM credit_transaction WHERE type = 'PURCHASE';
SELECT count(*) AS refund_rows FROM credit_transaction WHERE type = 'REFUND';
SELECT status, count(*) FROM durable_job GROUP BY status;

-- ownership / orphan checks (both must be zero)
SELECT count(*) AS orphan_sources
FROM source s LEFT JOIN workspace w ON w.id = s."workspaceId"
WHERE w.id IS NULL;
SELECT count(*) AS orphan_artifacts
FROM learning_artifact a LEFT JOIN workspace w ON w.id = a."workspaceId"
WHERE w.id IS NULL;
```

Any unexpected refund, `DEAD` job without a compensating refund, or orphaned
resource is an incident; investigate before further deploys.

## 6. Boundaries

- No production backup, production database, real customer row, real payment,
  or production deploy was accessed in this work.
- No force-push, reset or history rewrite is part of this procedure.
- Public redistribution remains gated by `LICENSING_REVIEW.md`; rollback does
  not change that gate.

## 7. Phase 07 forward-only migration and restore evidence

No new migration was added in Phase 07. The same 13 checked-in migrations were
applied to a fresh disposable database `kairos_phase07`
(`kairos-phase07-pg-20261123`, host port 55447) with
`npx prisma migrate deploy`; `npx prisma migrate status` reported
`Database schema is up to date!` and 13 migrations found. Schema audit:
19 tables, 166 columns, 10 enum types, 54 indexes, 13 foreign keys, 19 primary
keys. The legacy `Test` table remains present intentionally.

A fresh `pg_dump -Fc` backup was taken after inserting a synthetic fixture
(1 user, 1 workspace, 1 source, 1 conversation, 1 message, 1 artifact,
1 payment, 1 `PURCHASE` ledger row and 1 `DELIVERED` job). The 45,614-byte artifact
(SHA-256 `5F22FFF4633C79663EEAC7DFC8C322583F250D93FD03027D446C036E46A78BA8`)
was restored into the **separate** disposable database `kairos_phase07_restore`
(`kairos-phase07-restore-20261123`, host port 55448) in 1,385 ms. Restored
verification: `prisma migrate status` 13/13 up to date; all nine fixture counts
identical; `orphan_workspaces/sources/artifacts/conversations/messages/payments/ledger
= 0`; `invalid_refunds = 0`; `stale_processing_jobs = 0`;
`premature_dead_jobs = 0`.

Rollback policy is unchanged: redeploy the previous application commit for app-only
incidents; for a schema-caused incident restore the pre-deploy backup into a new
database and repoint the service—never reset, reverse a migration in place, or
overwrite the live staging database. No production backup or database was touched.
