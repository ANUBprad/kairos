-- Kairos remediation: forward-only reconciliation of schema objects that were
-- previously created with `prisma db push`. Safe to apply to a migrated or
-- baselined database; it never drops tables or deletes application data.

-- 1. Credit balance and auditable ledger -------------------------------------
ALTER TABLE "user"
  ADD COLUMN IF NOT EXISTS "credits" INTEGER NOT NULL DEFAULT 50;

DO $$
BEGIN
  CREATE TYPE "CreditTransactionType" AS ENUM (
    'SIGNUP_BONUS', 'PURCHASE', 'SOURCE_UPLOAD', 'CHAT_MESSAGE',
    'ARTIFACT_GENERATE', 'AUDIO_DEBATE', 'REFUND'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'SIGNUP_BONUS';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'PURCHASE';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'SOURCE_UPLOAD';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'CHAT_MESSAGE';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'ARTIFACT_GENERATE';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'AUDIO_DEBATE';
ALTER TYPE "CreditTransactionType" ADD VALUE IF NOT EXISTS 'REFUND';

CREATE TABLE IF NOT EXISTS "credit_transaction" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "balanceAfter" INTEGER NOT NULL,
  "type" "CreditTransactionType" NOT NULL,
  "description" TEXT NOT NULL,
  "metadata" JSONB,
  "idempotencyKey" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "credit_transaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "credit_transaction_idempotencyKey_key"
  ON "credit_transaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "credit_transaction_userId_createdAt_idx"
  ON "credit_transaction"("userId", "createdAt");

DO $$
BEGIN
  ALTER TABLE "credit_transaction"
    ADD CONSTRAINT "credit_transaction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. Payment records --------------------------------------------------------
ALTER TABLE "payment_record"
  ADD COLUMN IF NOT EXISTS "creditsPurchased" INTEGER NOT NULL DEFAULT 0;

-- Credit-pack purchases have no subscription plan. Historical rows are left
-- untouched so this migration never revokes an existing entitlement.
ALTER TABLE "payment_record" ALTER COLUMN "plan" DROP NOT NULL;
ALTER TABLE "payment_record" ALTER COLUMN "plan" DROP DEFAULT;

-- 3. Application enum values ------------------------------------------------
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'DIAGRAM';
ALTER TYPE "ArtifactType" ADD VALUE IF NOT EXISTS 'PODCAST';

ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'GOOGLE_DRIVE';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'NOTION';
ALTER TYPE "IntegrationProvider" ADD VALUE IF NOT EXISTS 'GITHUB';

-- 4. Artifact refund idempotency --------------------------------------------
ALTER TABLE "learning_artifact"
  ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- 5. Single-use OAuth state -------------------------------------------------
CREATE TABLE IF NOT EXISTS "oauth_state_nonce" (
  "id" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "returnTo" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "oauth_state_nonce_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_state_nonce_nonce_key"
  ON "oauth_state_nonce"("nonce");
CREATE INDEX IF NOT EXISTS "oauth_state_nonce_userId_provider_idx"
  ON "oauth_state_nonce"("userId", "provider");
CREATE INDEX IF NOT EXISTS "oauth_state_nonce_expiresAt_idx"
  ON "oauth_state_nonce"("expiresAt");

DO $$
BEGIN
  ALTER TABLE "oauth_state_nonce"
    ADD CONSTRAINT "oauth_state_nonce_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- The orphan "Test" table from the initial migration is intentionally
-- preserved. Its removal requires a verified data/reference review.
