-- Additive: an honest per-question failure record on BenchmarkResult so an
-- evaluated question that errored does not silently vanish. Nullable Json is
-- absent for successful results, populated only when the entry failed.
ALTER TABLE "BenchmarkResult" ADD COLUMN IF NOT EXISTS "error" JSONB;