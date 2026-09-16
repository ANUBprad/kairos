-- Additive: one persisted statistical regression comparison per (baseline,
-- candidate) benchmark run pair. Repeat comparisons of the same ordered pair
-- overwrite the single row in place, so a CI retry never stacks duplicates.
CREATE TABLE "BenchmarkRegression" (
    "id" TEXT NOT NULL,
    "baselineRunId" TEXT NOT NULL,
    "candidateRunId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "overallVerdict" VARCHAR(32) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BenchmarkRegression_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BenchmarkRegression_baselineRunId_candidateRunId_key" ON "BenchmarkRegression"("baselineRunId", "candidateRunId");
CREATE INDEX "BenchmarkRegression_datasetId_idx" ON "BenchmarkRegression"("datasetId");

ALTER TABLE "BenchmarkRegression" ADD CONSTRAINT "BenchmarkRegression_baselineRunId_fkey" FOREIGN KEY ("baselineRunId") REFERENCES "BenchmarkRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchmarkRegression" ADD CONSTRAINT "BenchmarkRegression_candidateRunId_fkey" FOREIGN KEY ("candidateRunId") REFERENCES "BenchmarkRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchmarkRegression" ADD CONSTRAINT "BenchmarkRegression_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "BenchmarkDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;