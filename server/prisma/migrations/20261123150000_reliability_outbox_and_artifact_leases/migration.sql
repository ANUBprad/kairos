-- Reliability workstream: durable job outbox + artifact processing leases.
-- Forward-only and safe on databases that were previously managed with
-- `prisma db push`. No historical payment, credit, user or artifact data is
-- modified, and the legacy orphan "Test" table is intentionally preserved.

-- 1. Durable job outbox -----------------------------------------------------
DO $$
BEGIN
  CREATE TYPE "DurableJobStatus" AS ENUM (
    'PENDING', 'PROCESSING', 'DELIVERED', 'DEAD'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "durable_job" (
  "id"          TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "payload"     JSONB NOT NULL,
  "status"      "DurableJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"    INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  "deliveredAt" TIMESTAMP(3),
  "lastError"   TEXT,

  CONSTRAINT "durable_job_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "durable_job_key_key"
  ON "durable_job"("key");
CREATE INDEX IF NOT EXISTS "durable_job_status_availableAt_idx"
  ON "durable_job"("status", "availableAt");

-- 2. Artifact processing leases --------------------------------------------
-- Leases are nullable so existing PENDING/PROCESSING/READY/FAILED rows keep
-- their current meaning and are eligible for the legacy stale sweep.
ALTER TABLE "learning_artifact"
  ADD COLUMN IF NOT EXISTS "leaseToken" TEXT;
ALTER TABLE "learning_artifact"
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "learning_artifact_status_leaseExpiresAt_idx"
  ON "learning_artifact"("status", "leaseExpiresAt");
