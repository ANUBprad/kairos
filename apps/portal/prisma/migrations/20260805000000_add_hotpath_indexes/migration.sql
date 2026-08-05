-- Additive indexes for hot-path queries (no schema semantic changes).

-- API key lookup by prefix on every V1 API request.
CREATE INDEX "ApiKey_keyPrefix_idx" ON "ApiKey"("keyPrefix");

-- Experiment runs listed per knowledge base ordered by creation time.
CREATE INDEX "ExperimentRun_knowledgeBaseId_createdAt_idx" ON "ExperimentRun"("knowledgeBaseId", "createdAt");

-- Benchmark runs filtered by status (baselines, analytics).
CREATE INDEX "BenchmarkRun_status_idx" ON "BenchmarkRun"("status");

-- Provider health queries are scoped by organization and date range.
CREATE INDEX "ProviderHealth_organizationId_date_idx" ON "ProviderHealth"("organizationId", "date");
