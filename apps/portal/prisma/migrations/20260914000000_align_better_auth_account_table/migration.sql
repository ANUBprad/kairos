-- Align the Account table with the better-auth 1.7 Prisma adapter schema.
-- Password reset OAuth token expirations are written by the adapter during
-- provider flows; email/password sign-in/up do not touch these columns.

ALTER TABLE "Account" ADD COLUMN "accessTokenExpiresAt" TIMESTAMP(3);
ALTER TABLE "Account" ADD COLUMN "refreshTokenExpiresAt" TIMESTAMP(3);