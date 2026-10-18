-- Better Auth anonymous plugin: mark auto-provisioned, account-less visitors.
-- Additive and non-destructive: existing users default to false, so registered
-- and demo accounts are unaffected. Anonymous users own only their own
-- auto-provisioned organization, so this flag never widens data access.
ALTER TABLE "User" ADD COLUMN "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
