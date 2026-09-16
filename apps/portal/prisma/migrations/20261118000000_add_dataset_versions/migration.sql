-- Immutable dataset versioning: published snapshots carry a deterministic
-- content hash and version numbering is unique per parent, so concurrent
-- creates cannot collide on the same version number.
ALTER TABLE "BenchmarkDataset" ADD COLUMN "contentHash" VARCHAR(64);

CREATE UNIQUE INDEX "BenchmarkDataset_parentVersionId_version_key" ON "BenchmarkDataset"("parentVersionId", "version");