-- Materialize the evaluation / quality / observability tables that the history
-- never created. The models existed in schema.prisma but only ever landed in
-- databases via `prisma db push`, so a fresh `prisma migrate deploy` shipped a
-- schema without BenchmarkQuestion, BenchmarkResult, ExperimentArtifact,
-- GoldenDataset(+Entry), ReviewQueue/ReviewComment, QualityGate(+Result),
-- LeaderboardEntry, Trace/Span/TraceEvent, CostRecord, DriftAlert,
-- AlertRule/AlertEvent, Incident/IncidentEvent, PipelineRun/PipelineStep,
-- TelemetryConfig, and PromptFolder/Prompt/PromptVersion.
--
-- Additive and conditional (IF NOT EXISTS / guarded enums and FKs), matching the
-- repo's hand-written migration style, so it is a safe no-op on databases already
-- shaped by prisma db push and runs cleanly from an empty database. No existing
-- migration is touched; already-applied history stays valid.

-- Enums first; guarded so already-shaped databases keep their types.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DatasetDifficulty') THEN
    CREATE TYPE "DatasetDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'EXPERT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewStatus') THEN
    CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_IMPROVEMENT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewPriority') THEN
    CREATE TYPE "ReviewPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TraceStatus') THEN
    CREATE TYPE "TraceStatus" AS ENUM ('OK', 'ERROR', 'TIMEOUT', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SpanStatus') THEN
    CREATE TYPE "SpanStatus" AS ENUM ('OK', 'ERROR', 'UNSET');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriftType') THEN
    CREATE TYPE "DriftType" AS ENUM (
      'EMBEDDING_DRIFT', 'PROMPT_DRIFT', 'DATASET_DRIFT', 'RETRIEVER_DRIFT',
      'MODEL_DRIFT', 'LATENCY_DRIFT', 'QUALITY_DRIFT', 'COST_DRIFT'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DriftStatus') THEN
    CREATE TYPE "DriftStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'IGNORED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertSeverity') THEN
    CREATE TYPE "AlertSeverity" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AlertEventStatus') THEN
    CREATE TYPE "AlertEventStatus" AS ENUM ('FIRING', 'RESOLVED', 'ACKNOWLEDGED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentSeverity') THEN
    CREATE TYPE "IncidentSeverity" AS ENUM ('MINOR', 'MAJOR', 'CRITICAL', 'FATAL');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IncidentStatus') THEN
    CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'INVESTIGATING', 'IDENTIFIED', 'MONITORING', 'RESOLVED', 'CLOSED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PipelineStatus') THEN
    CREATE TYPE "PipelineStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'TIMEOUT');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromptStatus') THEN
    CREATE TYPE "PromptStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PromptVersionStatus') THEN
    CREATE TYPE "PromptVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;

-- Benchmark questions (referenced by BenchmarkResult).
CREATE TABLE IF NOT EXISTS "BenchmarkQuestion" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "expectedAnswer" TEXT,
  "expectedContext" TEXT,
  "referenceDocId" VARCHAR(255),
  "metadata" JSONB,
  "datasetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BenchmarkQuestion_pkey" PRIMARY KEY ("id")
);

-- Per-case benchmark outcomes.
CREATE TABLE IF NOT EXISTS "BenchmarkResult" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "retrievedChunkIds" TEXT,
  "retrievedChunks" JSONB,
  "generatedAnswer" TEXT,
  "promptUsed" TEXT,
  "retrievalMetrics" JSONB,
  "generationMetrics" JSONB,
  "latencyEmbeddingMs" DOUBLE PRECISION,
  "latencySearchMs" DOUBLE PRECISION,
  "latencyPromptMs" DOUBLE PRECISION,
  "latencyGenerationMs" DOUBLE PRECISION,
  "totalLatencyMs" DOUBLE PRECISION,
  "configSnapshot" JSONB,
  "runId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BenchmarkResult_pkey" PRIMARY KEY ("id")
);

-- Experiment artifacts (referenced by the experiment artifact route).
CREATE TABLE IF NOT EXISTS "ExperimentArtifact" (
  "id" TEXT NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(128) NOT NULL,
  "size" INTEGER NOT NULL,
  "data" JSONB,
  "storageKey" VARCHAR(512),
  "experimentId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExperimentArtifact_pkey" PRIMARY KEY ("id")
);

-- Golden datasets and their entries (evaluation prompt datasets).
CREATE TABLE IF NOT EXISTS "GoldenDataset" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "tags" TEXT[],
  "difficulty" "DatasetDifficulty" NOT NULL DEFAULT 'MEDIUM',
  "version" INTEGER NOT NULL DEFAULT 1,
  "organizationId" TEXT NOT NULL,
  "ownerId" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GoldenDataset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GoldenDatasetEntry" (
  "id" TEXT NOT NULL,
  "question" TEXT NOT NULL,
  "expectedAnswer" TEXT NOT NULL,
  "expectedCitations" TEXT[],
  "context" TEXT,
  "tags" TEXT[],
  "category" VARCHAR(128),
  "metadata" JSONB,
  "datasetId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoldenDatasetEntry_pkey" PRIMARY KEY ("id")
);

-- Human review queue and comments.
CREATE TABLE IF NOT EXISTS "ReviewQueue" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(512) NOT NULL,
  "description" TEXT,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "priority" "ReviewPriority" NOT NULL DEFAULT 'NORMAL',
  "score" DOUBLE PRECISION,
  "resourceType" VARCHAR(64) NOT NULL,
  "resourceId" VARCHAR(255) NOT NULL,
  "metadata" JSONB,
  "organizationId" TEXT NOT NULL,
  "assigneeId" TEXT,
  "createdById" TEXT NOT NULL,
  "reviewerId" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewQueue_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ReviewComment" (
  "id" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "reviewId" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReviewComment_pkey" PRIMARY KEY ("id")
);

-- Quality gates and their evaluation results.
CREATE TABLE IF NOT EXISTS "QualityGate" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "organizationId" TEXT NOT NULL,
  "conditions" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QualityGate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QualityGateResult" (
  "id" TEXT NOT NULL,
  "passed" BOOLEAN NOT NULL,
  "results" JSONB NOT NULL,
  "score" DOUBLE PRECISION,
  "gateId" TEXT NOT NULL,
  "evaluationRunId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QualityGateResult_pkey" PRIMARY KEY ("id")
);

-- Leaderboard entries.
CREATE TABLE IF NOT EXISTS "LeaderboardEntry" (
  "id" TEXT NOT NULL,
  "entity" VARCHAR(255) NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "score" DOUBLE PRECISION NOT NULL,
  "metrics" JSONB NOT NULL,
  "rank" INTEGER,
  "organizationId" TEXT NOT NULL,
  "period" VARCHAR(32) NOT NULL DEFAULT 'all',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaderboardEntry_pkey" PRIMARY KEY ("id")
);

-- Observability: traces, spans, trace events.
CREATE TABLE IF NOT EXISTS "Trace" (
  "id" TEXT NOT NULL,
  "requestId" VARCHAR(255) NOT NULL,
  "name" VARCHAR(512) NOT NULL,
  "status" "TraceStatus" NOT NULL DEFAULT 'OK',
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "durationMs" INTEGER,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "provider" VARCHAR(64),
  "model" VARCHAR(128),
  "temperature" DOUBLE PRECISION,
  "maxTokens" INTEGER,
  "inputTokens" INTEGER,
  "outputTokens" INTEGER,
  "totalTokens" INTEGER,
  "cost" DOUBLE PRECISION,
  "input" TEXT,
  "output" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Trace_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Span" (
  "id" TEXT NOT NULL,
  "traceId" TEXT NOT NULL,
  "parentSpanId" TEXT,
  "name" VARCHAR(256) NOT NULL,
  "status" "SpanStatus" NOT NULL DEFAULT 'OK',
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "durationMs" INTEGER,
  "input" JSONB,
  "output" JSONB,
  "attributes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Span_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TraceEvent" (
  "id" TEXT NOT NULL,
  "traceId" TEXT NOT NULL,
  "name" VARCHAR(256) NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL,
  "attributes" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TraceEvent_pkey" PRIMARY KEY ("id")
);

-- Observability: cost tracking.
CREATE TABLE IF NOT EXISTS "CostRecord" (
  "id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "provider" VARCHAR(64) NOT NULL,
  "model" VARCHAR(128) NOT NULL,
  "operation" VARCHAR(64) NOT NULL,
  "inputTokens" INTEGER NOT NULL DEFAULT 0,
  "outputTokens" INTEGER NOT NULL DEFAULT 0,
  "totalTokens" INTEGER NOT NULL DEFAULT 0,
  "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "requestCount" INTEGER NOT NULL DEFAULT 0,
  "organizationId" TEXT NOT NULL,
  "userId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CostRecord_pkey" PRIMARY KEY ("id")
);

-- Observability: drift detection.
CREATE TABLE IF NOT EXISTS "DriftAlert" (
  "id" TEXT NOT NULL,
  "type" "DriftType" NOT NULL,
  "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
  "status" "DriftStatus" NOT NULL DEFAULT 'OPEN',
  "metric" VARCHAR(128) NOT NULL,
  "currentValue" DOUBLE PRECISION NOT NULL,
  "baselineValue" DOUBLE PRECISION NOT NULL,
  "deviationPercent" DOUBLE PRECISION NOT NULL,
  "message" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DriftAlert_pkey" PRIMARY KEY ("id")
);

-- Observability: alert rules and events.
CREATE TABLE IF NOT EXISTS "AlertRule" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "metric" VARCHAR(128) NOT NULL,
  "operator" VARCHAR(16) NOT NULL,
  "threshold" DOUBLE PRECISION NOT NULL,
  "windowMinutes" INTEGER NOT NULL DEFAULT 5,
  "severity" "AlertSeverity" NOT NULL DEFAULT 'WARNING',
  "cooldownMinutes" INTEGER NOT NULL DEFAULT 30,
  "notifyWebhook" TEXT,
  "notifyEmail" TEXT,
  "notifySlack" TEXT,
  "organizationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AlertEvent" (
  "id" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "status" "AlertEventStatus" NOT NULL DEFAULT 'FIRING',
  "value" DOUBLE PRECISION NOT NULL,
  "message" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "firedAt" TIMESTAMP(3) NOT NULL,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- Observability: incidents and timeline events.
CREATE TABLE IF NOT EXISTS "Incident" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(512) NOT NULL,
  "description" TEXT,
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'MINOR',
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
  "rootCause" TEXT,
  "resolution" TEXT,
  "postmortem" TEXT,
  "organizationId" TEXT NOT NULL,
  "ownerId" TEXT,
  "affectedRequestCount" INTEGER NOT NULL DEFAULT 0,
  "linkedAlertIds" TEXT[],
  "linkedTraceIds" TEXT[],
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IncidentEvent" (
  "id" TEXT NOT NULL,
  "incidentId" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "IncidentEvent_pkey" PRIMARY KEY ("id")
);

-- Observability: pipeline runs and steps.
CREATE TABLE IF NOT EXISTS "PipelineRun" (
  "id" TEXT NOT NULL,
  "traceId" TEXT,
  "status" "PipelineStatus" NOT NULL DEFAULT 'RUNNING',
  "organizationId" TEXT NOT NULL,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "totalMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PipelineStep" (
  "id" TEXT NOT NULL,
  "pipelineId" TEXT NOT NULL,
  "name" VARCHAR(128) NOT NULL,
  "type" VARCHAR(64) NOT NULL,
  "status" "PipelineStatus" NOT NULL DEFAULT 'RUNNING',
  "order" INTEGER NOT NULL,
  "input" JSONB,
  "output" JSONB,
  "error" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "endTime" TIMESTAMP(3),
  "durationMs" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PipelineStep_pkey" PRIMARY KEY ("id")
);

-- Observability: telemetry configuration (PK doubles as FK to Organization).
CREATE TABLE IF NOT EXISTS "TelemetryConfig" (
  "organizationId" TEXT NOT NULL,
  "samplingRate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "retentionDays" INTEGER NOT NULL DEFAULT 90,
  "enableTraces" BOOLEAN NOT NULL DEFAULT true,
  "enableMetrics" BOOLEAN NOT NULL DEFAULT true,
  "enableLogs" BOOLEAN NOT NULL DEFAULT true,
  "maxSpansPerTrace" INTEGER NOT NULL DEFAULT 100,
  "maxEventsPerTrace" INTEGER NOT NULL DEFAULT 50,
  "compressOldTraces" BOOLEAN NOT NULL DEFAULT true,
  "archiveAfterDays" INTEGER NOT NULL DEFAULT 30,
  CONSTRAINT "TelemetryConfig_pkey" PRIMARY KEY ("organizationId")
);

-- Prompt management: folders, prompts, versions.
CREATE TABLE IF NOT EXISTS "PromptFolder" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "color" VARCHAR(32),
  "icon" VARCHAR(32),
  "organizationId" TEXT NOT NULL,
  "parentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PromptFolder_pkey" PRIMARY KEY ("id")
);

-- "Prompt" cannot carry its currentVersionId FK until PromptVersion exists
-- (circular relation), so the column is created without the constraint here and
-- the FK is added after PromptVersion below.
CREATE TABLE IF NOT EXISTS "Prompt" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(512) NOT NULL,
  "description" TEXT,
  "tags" TEXT[],
  "status" "PromptStatus" NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "organizationId" TEXT NOT NULL,
  "folderId" TEXT,
  "ownerId" TEXT NOT NULL,
  "currentVersionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Prompt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PromptVersion" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL,
  "title" VARCHAR(512) NOT NULL,
  "description" TEXT,
  "systemPrompt" TEXT NOT NULL,
  "userPrompt" TEXT NOT NULL,
  "variables" JSONB,
  "metadata" JSONB,
  "model" VARCHAR(128),
  "temperature" DOUBLE PRECISION,
  "maxTokens" INTEGER,
  "topP" DOUBLE PRECISION,
  "status" "PromptVersionStatus" NOT NULL DEFAULT 'DRAFT',
  "promptId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromptVersion_pkey" PRIMARY KEY ("id")
);

-- Foreign keys. Guarded per constraint so an already-shaped DB is untouched;
-- ordered so every referenced table exists before its FK is added.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BenchmarkQuestion_datasetId_fkey'
  ) THEN
    ALTER TABLE "BenchmarkQuestion" ADD CONSTRAINT "BenchmarkQuestion_datasetId_fkey"
      FOREIGN KEY ("datasetId") REFERENCES "BenchmarkDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BenchmarkResult_questionId_fkey'
  ) THEN
    ALTER TABLE "BenchmarkResult" ADD CONSTRAINT "BenchmarkResult_questionId_fkey"
      FOREIGN KEY ("questionId") REFERENCES "BenchmarkQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'BenchmarkResult_runId_fkey'
  ) THEN
    ALTER TABLE "BenchmarkResult" ADD CONSTRAINT "BenchmarkResult_runId_fkey"
      FOREIGN KEY ("runId") REFERENCES "BenchmarkRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ExperimentArtifact_experimentId_fkey'
  ) THEN
    ALTER TABLE "ExperimentArtifact" ADD CONSTRAINT "ExperimentArtifact_experimentId_fkey"
      FOREIGN KEY ("experimentId") REFERENCES "Experiment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GoldenDataset_organizationId_fkey'
  ) THEN
    ALTER TABLE "GoldenDataset" ADD CONSTRAINT "GoldenDataset_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GoldenDataset_ownerId_fkey'
  ) THEN
    ALTER TABLE "GoldenDataset" ADD CONSTRAINT "GoldenDataset_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GoldenDataset_parentId_fkey'
  ) THEN
    ALTER TABLE "GoldenDataset" ADD CONSTRAINT "GoldenDataset_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "GoldenDataset"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'GoldenDatasetEntry_datasetId_fkey'
  ) THEN
    ALTER TABLE "GoldenDatasetEntry" ADD CONSTRAINT "GoldenDatasetEntry_datasetId_fkey"
      FOREIGN KEY ("datasetId") REFERENCES "GoldenDataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ReviewQueue_organizationId_fkey'
  ) THEN
    ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ReviewQueue_assigneeId_fkey'
  ) THEN
    ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_assigneeId_fkey"
      FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ReviewQueue_createdById_fkey'
  ) THEN
    ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ReviewQueue_reviewerId_fkey'
  ) THEN
    ALTER TABLE "ReviewQueue" ADD CONSTRAINT "ReviewQueue_reviewerId_fkey"
      FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ReviewComment_reviewId_fkey'
  ) THEN
    ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_reviewId_fkey"
      FOREIGN KEY ("reviewId") REFERENCES "ReviewQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ReviewComment_authorId_fkey'
  ) THEN
    ALTER TABLE "ReviewComment" ADD CONSTRAINT "ReviewComment_authorId_fkey"
      FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'QualityGate_organizationId_fkey'
  ) THEN
    ALTER TABLE "QualityGate" ADD CONSTRAINT "QualityGate_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'QualityGateResult_gateId_fkey'
  ) THEN
    ALTER TABLE "QualityGateResult" ADD CONSTRAINT "QualityGateResult_gateId_fkey"
      FOREIGN KEY ("gateId") REFERENCES "QualityGate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LeaderboardEntry_organizationId_fkey'
  ) THEN
    ALTER TABLE "LeaderboardEntry" ADD CONSTRAINT "LeaderboardEntry_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Trace_organizationId_fkey'
  ) THEN
    ALTER TABLE "Trace" ADD CONSTRAINT "Trace_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Trace_userId_fkey'
  ) THEN
    ALTER TABLE "Trace" ADD CONSTRAINT "Trace_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Span_traceId_fkey'
  ) THEN
    ALTER TABLE "Span" ADD CONSTRAINT "Span_traceId_fkey"
      FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TraceEvent_traceId_fkey'
  ) THEN
    ALTER TABLE "TraceEvent" ADD CONSTRAINT "TraceEvent_traceId_fkey"
      FOREIGN KEY ("traceId") REFERENCES "Trace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CostRecord_organizationId_fkey'
  ) THEN
    ALTER TABLE "CostRecord" ADD CONSTRAINT "CostRecord_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'CostRecord_userId_fkey'
  ) THEN
    ALTER TABLE "CostRecord" ADD CONSTRAINT "CostRecord_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DriftAlert_organizationId_fkey'
  ) THEN
    ALTER TABLE "DriftAlert" ADD CONSTRAINT "DriftAlert_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AlertRule_organizationId_fkey'
  ) THEN
    ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AlertEvent_ruleId_fkey'
  ) THEN
    ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_ruleId_fkey"
      FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AlertEvent_organizationId_fkey'
  ) THEN
    ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Incident_organizationId_fkey'
  ) THEN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Incident_ownerId_fkey'
  ) THEN
    ALTER TABLE "Incident" ADD CONSTRAINT "Incident_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'IncidentEvent_incidentId_fkey'
  ) THEN
    ALTER TABLE "IncidentEvent" ADD CONSTRAINT "IncidentEvent_incidentId_fkey"
      FOREIGN KEY ("incidentId") REFERENCES "Incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PipelineRun_organizationId_fkey'
  ) THEN
    ALTER TABLE "PipelineRun" ADD CONSTRAINT "PipelineRun_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PipelineStep_pipelineId_fkey'
  ) THEN
    ALTER TABLE "PipelineStep" ADD CONSTRAINT "PipelineStep_pipelineId_fkey"
      FOREIGN KEY ("pipelineId") REFERENCES "PipelineRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TelemetryConfig_organizationId_fkey'
  ) THEN
    ALTER TABLE "TelemetryConfig" ADD CONSTRAINT "TelemetryConfig_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PromptFolder_organizationId_fkey'
  ) THEN
    ALTER TABLE "PromptFolder" ADD CONSTRAINT "PromptFolder_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PromptFolder_parentId_fkey'
  ) THEN
    ALTER TABLE "PromptFolder" ADD CONSTRAINT "PromptFolder_parentId_fkey"
      FOREIGN KEY ("parentId") REFERENCES "PromptFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Prompt_organizationId_fkey'
  ) THEN
    ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_organizationId_fkey"
      FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Prompt_folderId_fkey'
  ) THEN
    ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_folderId_fkey"
      FOREIGN KEY ("folderId") REFERENCES "PromptFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Prompt_ownerId_fkey'
  ) THEN
    ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PromptVersion_promptId_fkey'
  ) THEN
    ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_promptId_fkey"
      FOREIGN KEY ("promptId") REFERENCES "Prompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PromptVersion_createdById_fkey'
  ) THEN
    ALTER TABLE "PromptVersion" ADD CONSTRAINT "PromptVersion_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Prompt_currentVersionId_fkey'
  ) THEN
    ALTER TABLE "Prompt" ADD CONSTRAINT "Prompt_currentVersionId_fkey"
      FOREIGN KEY ("currentVersionId") REFERENCES "PromptVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Unique constraints from @unique declarations.
CREATE UNIQUE INDEX IF NOT EXISTS "Trace_requestId_key" ON "Trace"("requestId");
CREATE UNIQUE INDEX IF NOT EXISTS "CostRecord_date_provider_model_operation_organizationId_key"
  ON "CostRecord"("date", "provider", "model", "operation", "organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "PromptVersion_promptId_version_key" ON "PromptVersion"("promptId", "version");

-- Composite and single-column indexes.
CREATE INDEX IF NOT EXISTS "BenchmarkQuestion_datasetId_idx" ON "BenchmarkQuestion"("datasetId");
CREATE INDEX IF NOT EXISTS "BenchmarkResult_runId_idx" ON "BenchmarkResult"("runId");
CREATE INDEX IF NOT EXISTS "BenchmarkResult_questionId_idx" ON "BenchmarkResult"("questionId");
CREATE INDEX IF NOT EXISTS "ExperimentArtifact_experimentId_idx" ON "ExperimentArtifact"("experimentId");
CREATE INDEX IF NOT EXISTS "ExperimentArtifact_experimentId_type_idx" ON "ExperimentArtifact"("experimentId", "type");
CREATE INDEX IF NOT EXISTS "GoldenDataset_organizationId_idx" ON "GoldenDataset"("organizationId");
CREATE INDEX IF NOT EXISTS "GoldenDataset_ownerId_idx" ON "GoldenDataset"("ownerId");
CREATE INDEX IF NOT EXISTS "GoldenDataset_difficulty_idx" ON "GoldenDataset"("difficulty");
CREATE INDEX IF NOT EXISTS "GoldenDatasetEntry_datasetId_idx" ON "GoldenDatasetEntry"("datasetId");
CREATE INDEX IF NOT EXISTS "GoldenDatasetEntry_category_idx" ON "GoldenDatasetEntry"("category");
CREATE INDEX IF NOT EXISTS "GoldenDatasetEntry_tags_idx" ON "GoldenDatasetEntry"("tags");
CREATE INDEX IF NOT EXISTS "ReviewQueue_organizationId_idx" ON "ReviewQueue"("organizationId");
CREATE INDEX IF NOT EXISTS "ReviewQueue_status_idx" ON "ReviewQueue"("status");
CREATE INDEX IF NOT EXISTS "ReviewQueue_assigneeId_idx" ON "ReviewQueue"("assigneeId");
CREATE INDEX IF NOT EXISTS "ReviewQueue_resourceType_resourceId_idx" ON "ReviewQueue"("resourceType", "resourceId");
CREATE INDEX IF NOT EXISTS "ReviewComment_reviewId_idx" ON "ReviewComment"("reviewId");
CREATE INDEX IF NOT EXISTS "QualityGate_organizationId_idx" ON "QualityGate"("organizationId");
CREATE INDEX IF NOT EXISTS "QualityGateResult_gateId_idx" ON "QualityGateResult"("gateId");
CREATE INDEX IF NOT EXISTS "QualityGateResult_passed_idx" ON "QualityGateResult"("passed");
CREATE INDEX IF NOT EXISTS "LeaderboardEntry_organizationId_type_period_idx" ON "LeaderboardEntry"("organizationId", "type", "period");
CREATE INDEX IF NOT EXISTS "LeaderboardEntry_score_idx" ON "LeaderboardEntry"("score" DESC);
CREATE INDEX IF NOT EXISTS "Trace_organizationId_startTime_idx" ON "Trace"("organizationId", "startTime" DESC);
CREATE INDEX IF NOT EXISTS "Trace_userId_startTime_idx" ON "Trace"("userId", "startTime" DESC);
CREATE INDEX IF NOT EXISTS "Trace_provider_model_idx" ON "Trace"("provider", "model");
CREATE INDEX IF NOT EXISTS "Trace_status_idx" ON "Trace"("status");
CREATE INDEX IF NOT EXISTS "Span_traceId_idx" ON "Span"("traceId");
CREATE INDEX IF NOT EXISTS "Span_parentSpanId_idx" ON "Span"("parentSpanId");
CREATE INDEX IF NOT EXISTS "Span_name_idx" ON "Span"("name");
CREATE INDEX IF NOT EXISTS "TraceEvent_traceId_idx" ON "TraceEvent"("traceId");
CREATE INDEX IF NOT EXISTS "CostRecord_organizationId_date_idx" ON "CostRecord"("organizationId", "date");
CREATE INDEX IF NOT EXISTS "CostRecord_provider_model_idx" ON "CostRecord"("provider", "model");
CREATE INDEX IF NOT EXISTS "DriftAlert_organizationId_type_status_idx" ON "DriftAlert"("organizationId", "type", "status");
CREATE INDEX IF NOT EXISTS "DriftAlert_createdAt_idx" ON "DriftAlert"("createdAt" DESC);
CREATE INDEX IF NOT EXISTS "AlertRule_organizationId_enabled_idx" ON "AlertRule"("organizationId", "enabled");
CREATE INDEX IF NOT EXISTS "AlertEvent_ruleId_firedAt_idx" ON "AlertEvent"("ruleId", "firedAt" DESC);
CREATE INDEX IF NOT EXISTS "AlertEvent_organizationId_status_idx" ON "AlertEvent"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Incident_organizationId_status_idx" ON "Incident"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "Incident_severity_status_idx" ON "Incident"("severity", "status");
CREATE INDEX IF NOT EXISTS "Incident_startedAt_idx" ON "Incident"("startedAt" DESC);
CREATE INDEX IF NOT EXISTS "IncidentEvent_incidentId_timestamp_idx" ON "IncidentEvent"("incidentId", "timestamp");
CREATE INDEX IF NOT EXISTS "PipelineRun_organizationId_startTime_idx" ON "PipelineRun"("organizationId", "startTime" DESC);
CREATE INDEX IF NOT EXISTS "PipelineRun_status_idx" ON "PipelineRun"("status");
CREATE INDEX IF NOT EXISTS "PipelineStep_pipelineId_idx" ON "PipelineStep"("pipelineId");
CREATE INDEX IF NOT EXISTS "PromptFolder_organizationId_idx" ON "PromptFolder"("organizationId");
CREATE INDEX IF NOT EXISTS "PromptFolder_parentId_idx" ON "PromptFolder"("parentId");
CREATE INDEX IF NOT EXISTS "Prompt_organizationId_idx" ON "Prompt"("organizationId");
CREATE INDEX IF NOT EXISTS "Prompt_folderId_idx" ON "Prompt"("folderId");
CREATE INDEX IF NOT EXISTS "Prompt_ownerId_idx" ON "Prompt"("ownerId");
CREATE INDEX IF NOT EXISTS "Prompt_status_idx" ON "Prompt"("status");
CREATE INDEX IF NOT EXISTS "Prompt_tags_idx" ON "Prompt"("tags");
CREATE INDEX IF NOT EXISTS "PromptVersion_promptId_idx" ON "PromptVersion"("promptId");
CREATE INDEX IF NOT EXISTS "PromptVersion_status_idx" ON "PromptVersion"("status");