-- Round 3 concurrency guards. Forward-only; no historical rows are rewritten.
-- The legacy "Test" table and all existing payment/credit/user records are
-- intentionally preserved unchanged.

-- 1. Idempotent chat requests ------------------------------------------------
-- A unique request key lets a retried chat request reuse the same user message
-- instead of consuming quota and credits a second time.
ALTER TABLE "message"
  ADD COLUMN IF NOT EXISTS "requestKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "message_requestKey_key"
  ON "message"("requestKey");

-- 2. Signup ledger consistency ----------------------------------------------
-- New users no longer receive an implicit balance from a column default. The
-- 50 welcome credits are granted atomically with the SIGNUP_BONUS ledger row
-- by the signup hook. Existing users keep every credit they already have.
ALTER TABLE "user"
  ALTER COLUMN "credits" SET DEFAULT 0;
