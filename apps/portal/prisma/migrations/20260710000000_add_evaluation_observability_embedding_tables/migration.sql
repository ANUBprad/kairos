-- Materialize the tables that later migrations index or alter:
--   - 20260805000000_add_hotpath_indexes indexes ExperimentRun, BenchmarkRun,
--     ProviderHealth (and ApiKey, which _init already creates).
--   - 20260913000000_add_embedding_vectors adds a vector column to
--     DocumentEmbedding.
-- The hand-written history only covered the _init kernel; everything else lived
-- in prisma db push. This additive, conditional prerequisite makes the chain
-- runnable from an empty database without touching existing migration files
-- (their checksums and already-applied history stay valid).
--
-- The four hotpath index names (ExperimentRun_knowledgeBaseId_createdAt_idx,
-- BenchmarkRun_status_idx, ProviderHealth_organizationId_date_idx) and the
-- DocumentEmbedding."embedding" column are intentionally NOT created here:
-- the migrations that own them create them in order, so a fresh deploy ends
-- with a schema that matches schema.prisma exactly.
--
-- Conditional guard style matches the repo's hand-written migrations
-- (retrieval_config, workspace_sources, learning_artifact) so this is a safe
-- no-op on databases already shaped by prisma db push.

-- BenchmarkDataset (FK target for Experiment, BenchmarkRun).
CREATE TABLE IF NOT EXISTS "BenchmarkDataset" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "source" VARCHAR(128),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "version" INTEGER NOT NULL DEFAULT 1,
    "knowledgeBaseId" TEXT,
    "parentVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkDataset_pkey" PRIMARY KEY ("id")
);

-- Experiment (FK target for ExperimentRun).
CREATE TABLE IF NOT EXISTS "Experiment" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "knowledgeBaseId" TEXT NOT NULL,
    "createdById" TEXT,
    "datasetId" TEXT,
    "embeddingModel" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "retriever" TEXT NOT NULL DEFAULT 'vector',
    "reranker" TEXT NOT NULL DEFAULT 'none',
    "llm" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
    "promptTemplate" TEXT NOT NULL DEFAULT 'default',
    "chunkStrategy" TEXT NOT NULL DEFAULT 'fixed',
    "chunkSize" INTEGER NOT NULL DEFAULT 512,
    "chunkOverlap" INTEGER NOT NULL DEFAULT 50,
    "topK" INTEGER NOT NULL DEFAULT 10,
    "similarityThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    "retrievalMode" TEXT NOT NULL DEFAULT 'vector',
    "configA" JSONB NOT NULL,
    "configB" JSONB,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "winner" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Experiment_pkey" PRIMARY KEY ("id")
);

-- ExperimentRun (indexed by add_hotpath_indexes).
CREATE TABLE IF NOT EXISTS "ExperimentRun" (
    "id" TEXT NOT NULL,
    "configSnapshot" JSONB NOT NULL,
    "query" TEXT NOT NULL,
    "retrievedChunks" JSONB NOT NULL,
    "metrics" JSONB,
    "debug" JSONB,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "error" TEXT,
    "latencyEmbedding" DOUBLE PRECISION,
    "latencyVectorSearch" DOUBLE PRECISION,
    "latencyPromptBuild" DOUBLE PRECISION,
    "latencyLlmResponse" DOUBLE PRECISION,
    "totalLatency" DOUBLE PRECISION,
    "chunkCount" INTEGER,
    "tokensUsed" INTEGER,
    "cost" DOUBLE PRECISION,
    "embeddingModel" TEXT,
    "retrievalMode" TEXT,
    "experimentId" TEXT,
    "knowledgeBaseId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExperimentRun_pkey" PRIMARY KEY ("id")
);

-- BenchmarkRun (indexed by add_hotpath_indexes).
CREATE TABLE IF NOT EXISTS "BenchmarkRun" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255),
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "configSnapshot" JSONB NOT NULL,
    "aggregatedMetrics" JSONB,
    "datasetId" TEXT NOT NULL,
    "createdById" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BenchmarkRun_pkey" PRIMARY KEY ("id")
);

-- ProviderHealth (indexed by add_hotpath_indexes).
CREATE TABLE IF NOT EXISTS "ProviderHealth" (
    "id" TEXT NOT NULL,
    "provider" VARCHAR(64) NOT NULL,
    "model" VARCHAR(128) NOT NULL,
    "date" DATE NOT NULL,
    "organizationId" TEXT NOT NULL,
    "totalRequests" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "timeoutCount" INTEGER NOT NULL DEFAULT 0,
    "avgLatencyMs" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "p50LatencyMs" DOUBLE PRECISION,
    "p95LatencyMs" DOUBLE PRECISION,
    "p99LatencyMs" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalTokens" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastErrorAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderHealth_pkey" PRIMARY KEY ("id")
);

-- DocumentChunk (FK target for DocumentEmbedding).
CREATE TABLE IF NOT EXISTS "DocumentChunk" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "index" INTEGER NOT NULL,
    "metadata" JSONB,
    "tokenCount" INTEGER,
    "documentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChunk_pkey" PRIMARY KEY ("id")
);

-- DocumentEmbedding (the "embedding" vector column is added later by
-- 20260913000000_add_embedding_vectors, after the vector extension exists).
CREATE TABLE IF NOT EXISTS "DocumentEmbedding" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'text-embedding-3-small',
    "dimensions" INTEGER NOT NULL DEFAULT 1536,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "chunkId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentEmbedding_pkey" PRIMARY KEY ("id")
);

-- Foreign keys. Guarded per constraint so an already-shaped DB is untouched.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BenchmarkDataset_knowledgeBaseId_fkey'
  ) THEN
    ALTER TABLE "BenchmarkDataset" ADD CONSTRAINT "BenchmarkDataset_knowledgeBaseId_fkey"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BenchmarkDataset_parentVersionId_fkey'
  ) THEN
    ALTER TABLE "BenchmarkDataset" ADD CONSTRAINT "BenchmarkDataset_parentVersionId_fkey"
      FOREIGN KEY ("parentVersionId") REFERENCES "BenchmarkDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Experiment_knowledgeBaseId_fkey'
  ) THEN
    ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_knowledgeBaseId_fkey"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Experiment_createdById_fkey'
  ) THEN
    ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Experiment_datasetId_fkey'
  ) THEN
    ALTER TABLE "Experiment" ADD CONSTRAINT "Experiment_datasetId_fkey"
      FOREIGN KEY ("datasetId") REFERENCES "BenchmarkDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ExperimentRun_experimentId_fkey'
  ) THEN
    ALTER TABLE "ExperimentRun" ADD CONSTRAINT "ExperimentRun_experimentId_fkey"
      FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ExperimentRun_knowledgeBaseId_fkey'
  ) THEN
    ALTER TABLE "ExperimentRun" ADD CONSTRAINT "ExperimentRun_knowledgeBaseId_fkey"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BenchmarkRun_datasetId_fkey'
  ) THEN
    ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_datasetId_fkey"
      FOREIGN KEY ("datasetId") REFERENCES "BenchmarkDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BenchmarkRun_createdById_fkey'
  ) THEN
    ALTER TABLE "BenchmarkRun" ADD CONSTRAINT "BenchmarkRun_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ProviderHealth_organizationId_fkey'
  ) THEN
    ALTER TABLE "ProviderHealth" ADD CONSTRAINT "ProviderHealth_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DocumentChunk_documentId_fkey'
  ) THEN
    ALTER TABLE "DocumentChunk" ADD CONSTRAINT "DocumentChunk_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DocumentEmbedding_chunkId_fkey'
  ) THEN
    ALTER TABLE "DocumentEmbedding" ADD CONSTRAINT "DocumentEmbedding_chunkId_fkey"
      FOREIGN KEY ("chunkId") REFERENCES "DocumentChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Unique constraints from @unique declarations.
CREATE UNIQUE INDEX IF NOT EXISTS "DocumentEmbedding_chunkId_key" ON "DocumentEmbedding"("chunkId");
CREATE UNIQUE INDEX IF NOT EXISTS "ProviderHealth_provider_model_date_key" ON "ProviderHealth"("provider", "model", "date");

-- Composite indexes. The schema-mandated indexes owned by add_hotpath_indexes
-- (ExperimentRun_knowledgeBaseId_createdAt, BenchmarkRun_status,
-- ProviderHealth_organizationId_date) are deliberately absent here.
CREATE INDEX IF NOT EXISTS "Experiment_createdById_idx" ON "Experiment"("createdById");
CREATE INDEX IF NOT EXISTS "Experiment_datasetId_idx" ON "Experiment"("datasetId");
CREATE INDEX IF NOT EXISTS "Experiment_status_idx" ON "Experiment"("status");
CREATE INDEX IF NOT EXISTS "Experiment_knowledgeBaseId_status_idx" ON "Experiment"("knowledgeBaseId", "status");
CREATE INDEX IF NOT EXISTS "ExperimentRun_experimentId_idx" ON "ExperimentRun"("experimentId");
CREATE INDEX IF NOT EXISTS "ExperimentRun_knowledgeBaseId_idx" ON "ExperimentRun"("knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "ExperimentRun_status_idx" ON "ExperimentRun"("status");
CREATE INDEX IF NOT EXISTS "BenchmarkDataset_knowledgeBaseId_idx" ON "BenchmarkDataset"("knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "BenchmarkDataset_parentVersionId_idx" ON "BenchmarkDataset"("parentVersionId");
CREATE INDEX IF NOT EXISTS "BenchmarkDataset_version_idx" ON "BenchmarkDataset"("version");
CREATE INDEX IF NOT EXISTS "BenchmarkRun_datasetId_idx" ON "BenchmarkRun"("datasetId");
CREATE INDEX IF NOT EXISTS "BenchmarkRun_createdById_idx" ON "BenchmarkRun"("createdById");
CREATE INDEX IF NOT EXISTS "ProviderHealth_provider_date_idx" ON "ProviderHealth"("provider", "date");
CREATE INDEX IF NOT EXISTS "ProviderHealth_date_idx" ON "ProviderHealth"("date");
CREATE INDEX IF NOT EXISTS "DocumentChunk_documentId_index_idx" ON "DocumentChunk"("documentId", "index");