-- Provider health is per-organization, but the original unique key (provider,
-- model, date) let two organizations' rows collide, so a producer would merge
-- one org's traffic into another's row and attribute it to whichever org wrote
-- first. Prisma emits @@unique as a plain unique index, so the old key is
-- replaced by an org-scoped one. No table, column or row is touched, and the
-- table has never had a writer, so there is nothing to backfill.
DROP INDEX "ProviderHealth_provider_model_date_key";

CREATE UNIQUE INDEX "ProviderHealth_organizationId_provider_model_date_key" ON "ProviderHealth"("organizationId", "provider", "model", "date");
