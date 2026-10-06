-- Anchor org-owned benchmark datasets (e.g. golden datasets) to their
-- organization so publish snapshots are tenant-scoped instead of global.
-- Existing rows keep a NULL anchor (standalone/global material), preserving
-- current behavior.
ALTER TABLE "BenchmarkDataset" ADD COLUMN     "organizationId" TEXT;

ALTER TABLE "BenchmarkDataset" ADD CONSTRAINT "BenchmarkDataset_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "BenchmarkDataset_organizationId_idx" ON "BenchmarkDataset"("organizationId");