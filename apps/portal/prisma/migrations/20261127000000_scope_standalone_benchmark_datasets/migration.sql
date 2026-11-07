-- Standalone benchmark datasets belong to the authenticated user who created them.
ALTER TABLE "BenchmarkDataset" ADD COLUMN "createdById" TEXT;

ALTER TABLE "BenchmarkDataset"
  ADD CONSTRAINT "BenchmarkDataset_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "BenchmarkDataset_createdById_idx" ON "BenchmarkDataset"("createdById");
