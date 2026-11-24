-- Phase 08 reliability fix: durable-job attempt leases and heartbeats.
-- Forward-only and additive. No existing rows, payment records, credit ledger
-- entries or legacy tables are modified. Legacy PROCESSING rows keep NULL lease
-- fields and remain recoverable by the updatedAt fallback in stale recovery.

ALTER TABLE "durable_job"
  ADD COLUMN IF NOT EXISTS "leaseToken" TEXT,
  ADD COLUMN IF NOT EXISTS "leaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "heartbeatAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "durable_job_status_leaseExpiresAt_idx"
  ON "durable_job"("status", "leaseExpiresAt");
