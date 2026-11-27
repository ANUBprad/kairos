-- Additive daily free allowance. No existing balances, ledger rows or plan
-- state are rewritten. Existing users receive their first allowance lazily on
-- the first server-side read or charge.

ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'DAILY_ALLOWANCE';

ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "dailyCreditDay" TEXT NOT NULL DEFAULT '1970-01-01',
  ADD COLUMN IF NOT EXISTS "dailyCredits" INTEGER NOT NULL DEFAULT 100;

ALTER TABLE "credit_transaction"
  ADD COLUMN IF NOT EXISTS "bucket" TEXT,
  ADD COLUMN IF NOT EXISTS "dailyAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paidAmount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "balanceAfterDaily" INTEGER,
  ADD COLUMN IF NOT EXISTS "balanceAfterPaid" INTEGER;

CREATE INDEX IF NOT EXISTS "credit_transaction_userId_bucket_createdAt_idx"
  ON "credit_transaction"("userId", "bucket", "createdAt");
