import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { SOURCE_STATUS_VALUES } from "../lib/source-contract";

// The complete required hot path: every evaluation, quality, and observability
// table the application queries at runtime. Previously this list only covered a
// small subset, which let migration-orphaned tables fall out of the deploy chain
// unnoticed.
const REQUIRED_TABLES = [
  "Experiment",
  "BenchmarkDataset",
  "ExperimentRun",
  "BenchmarkRun",
  "ProviderHealth",
  "DocumentChunk",
  "DocumentEmbedding",
  "Conversation",
  "Message",
  "MessageCitation",
  "QuizAttempt",
  "QuizAttemptAnswer",
  "FlashcardReview",
  "BenchmarkQuestion",
  "BenchmarkResult",
  "ExperimentArtifact",
  "GoldenDataset",
  "GoldenDatasetEntry",
  "ReviewQueue",
  "ReviewComment",
  "QualityGate",
  "QualityGateResult",
  "LeaderboardEntry",
  "Trace",
  "Span",
  "TraceEvent",
  "CostRecord",
  "DriftAlert",
  "AlertRule",
  "AlertEvent",
  "Incident",
  "IncidentEvent",
  "PipelineRun",
  "PipelineStep",
  "TelemetryConfig",
  "PromptFolder",
  "Prompt",
  "PromptVersion",
];

const REQUIRED_INDEXES = [
  "ApiKey_keyPrefix_idx",
  "Document_knowledgeBaseId_status_idx",
  "Document_knowledgeBaseId_fileHash_key",
  "ExperimentRun_knowledgeBaseId_createdAt_idx",
  "BenchmarkRun_status_idx",
  "BenchmarkDataset_parentVersionId_version_key",
  "ProviderHealth_organizationId_date_idx",
  "Conversation_knowledgeBaseId_userId_idx",
  "Message_conversationId_createdAt_idx",
  "MessageCitation_messageId_idx",
  "QuizAttempt_artifactId_idx",
  "QuizAttempt_knowledgeBaseId_userId_idx",
  "QuizAttemptAnswer_attemptId_idx",
  "QuizAttemptAnswer_attemptId_questionId_key",
  "FlashcardReview_artifactId_idx",
  "FlashcardReview_knowledgeBaseId_userId_idx",
  "FlashcardReview_userId_artifactId_cardId_key",
  "BenchmarkQuestion_datasetId_idx",
  "BenchmarkResult_runId_idx",
  "BenchmarkResult_questionId_idx",
  "ExperimentArtifact_experimentId_idx",
  "ExperimentArtifact_experimentId_type_idx",
  "GoldenDataset_organizationId_idx",
  "GoldenDataset_ownerId_idx",
  "GoldenDataset_difficulty_idx",
  "GoldenDatasetEntry_datasetId_idx",
  "GoldenDatasetEntry_category_idx",
  "GoldenDatasetEntry_tags_idx",
  "ReviewQueue_organizationId_idx",
  "ReviewQueue_status_idx",
  "ReviewQueue_assigneeId_idx",
  "ReviewQueue_resourceType_resourceId_idx",
  "ReviewComment_reviewId_idx",
  "QualityGate_organizationId_idx",
  "QualityGateResult_gateId_idx",
  "QualityGateResult_passed_idx",
  "LeaderboardEntry_organizationId_type_period_idx",
  "LeaderboardEntry_score_idx",
  "Trace_requestId_key",
  "Trace_organizationId_startTime_idx",
  "Trace_userId_startTime_idx",
  "Trace_provider_model_idx",
  "Trace_status_idx",
  "Span_traceId_idx",
  "Span_parentSpanId_idx",
  "Span_name_idx",
  "TraceEvent_traceId_idx",
  "CostRecord_date_provider_model_operation_organizationId_key",
  "CostRecord_organizationId_date_idx",
  "CostRecord_provider_model_idx",
  "DriftAlert_organizationId_type_status_idx",
  "DriftAlert_createdAt_idx",
  "AlertRule_organizationId_enabled_idx",
  "AlertEvent_ruleId_firedAt_idx",
  "AlertEvent_organizationId_status_idx",
  "Incident_organizationId_status_idx",
  "Incident_severity_status_idx",
  "Incident_startedAt_idx",
  "IncidentEvent_incidentId_timestamp_idx",
  "PipelineRun_organizationId_startTime_idx",
  "PipelineRun_status_idx",
  "PipelineStep_pipelineId_idx",
  "PromptFolder_organizationId_idx",
  "PromptFolder_parentId_idx",
  "Prompt_organizationId_idx",
  "Prompt_folderId_idx",
  "Prompt_ownerId_idx",
  "Prompt_status_idx",
  "Prompt_tags_idx",
  "PromptVersion_promptId_idx",
  "PromptVersion_status_idx",
  "PromptVersion_promptId_version_key",
];

const REQUIRED_ENUMS = [
  "DatasetDifficulty",
  "ReviewStatus",
  "ReviewPriority",
  "TraceStatus",
  "SpanStatus",
  "DriftType",
  "DriftStatus",
  "AlertSeverity",
  "AlertEventStatus",
  "IncidentSeverity",
  "IncidentStatus",
  "PipelineStatus",
  "PromptStatus",
  "PromptVersionStatus",
];

const REQUIRED_FKS = [
  "BenchmarkQuestion_datasetId_fkey",
  "BenchmarkResult_questionId_fkey",
  "BenchmarkResult_runId_fkey",
  "ExperimentArtifact_experimentId_fkey",
  "GoldenDataset_organizationId_fkey",
  "GoldenDataset_ownerId_fkey",
  "GoldenDataset_parentId_fkey",
  "GoldenDatasetEntry_datasetId_fkey",
  "ReviewQueue_organizationId_fkey",
  "ReviewQueue_assigneeId_fkey",
  "ReviewQueue_createdById_fkey",
  "ReviewQueue_reviewerId_fkey",
  "ReviewComment_reviewId_fkey",
  "ReviewComment_authorId_fkey",
  "QualityGate_organizationId_fkey",
  "QualityGateResult_gateId_fkey",
  "LeaderboardEntry_organizationId_fkey",
  "Trace_organizationId_fkey",
  "Trace_userId_fkey",
  "Span_traceId_fkey",
  "TraceEvent_traceId_fkey",
  "CostRecord_organizationId_fkey",
  "CostRecord_userId_fkey",
  "DriftAlert_organizationId_fkey",
  "AlertRule_organizationId_fkey",
  "AlertEvent_ruleId_fkey",
  "AlertEvent_organizationId_fkey",
  "Incident_organizationId_fkey",
  "Incident_ownerId_fkey",
  "IncidentEvent_incidentId_fkey",
  "PipelineRun_organizationId_fkey",
  "PipelineStep_pipelineId_fkey",
  "TelemetryConfig_organizationId_fkey",
  "PromptFolder_organizationId_fkey",
  "PromptFolder_parentId_fkey",
  "Prompt_organizationId_fkey",
  "Prompt_folderId_fkey",
  "Prompt_ownerId_fkey",
  "PromptVersion_promptId_fkey",
  "PromptVersion_createdById_fkey",
  "Prompt_currentVersionId_fkey",
];

function makeClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function testDbUrlWithDatabase(url: string, dbName: string): string {
  const slashIdx = url.lastIndexOf("/");
  assert.ok(slashIdx > 0, `cannot locate database segment in URL: ${url}`);
  const queryIdx = url.indexOf("?", slashIdx);
  const base = url.slice(0, slashIdx + 1) + dbName;
  return queryIdx >= 0 ? base + url.slice(queryIdx) : base;
}

function maintenanceUrl(url: string): string {
  const m = url.match(
    /^postgres(ql)?:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/[^?]+(\?.*)?$/,
  );
  assert.ok(m, `cannot parse database URL for maintenance connection: ${url}`);
  const [, , user, pass, host, port, params] = m;
  return `postgresql://${user}:${pass}@${host}:${port}/postgres${params ?? ""}`;
}

function runMigrateDeploy(dbUrl: string): void {
  const prismaCli = path.join(
    process.cwd(),
    "node_modules",
    "prisma",
    "build",
    "index.js",
  );
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: dbUrl },
    stdio: "pipe",
  });
}

describe("prisma migration chain", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const dbName = `kairos_migtest_${randomUUID().replace(/-/g, "").slice(0, 12)}`;

  after(async () => {
    if (!testDbUrl) return;
    const admin = makeClient(maintenanceUrl(testDbUrl));
    try {
      await admin.$connect();
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
    } catch {
      // teardown best effort — the throwaway database may not exist
    } finally {
      await admin.$disconnect();
    }
  });

  it("deploys the full chain onto an empty database and materializes the schema the migrations require", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }

    const admin = makeClient(maintenanceUrl(testDbUrl));
    await admin.$connect();
    try {
      await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${dbName}"`);
      await admin.$executeRawUnsafe(`CREATE DATABASE "${dbName}"`);
    } finally {
      await admin.$disconnect();
    }

    const dbUrl = testDbUrlWithDatabase(testDbUrl, dbName);

    // 1. The exact command used for production deploys must succeed from empty.
    runMigrateDeploy(dbUrl);

    const client = makeClient(dbUrl);
    try {
      await client.$connect();

      // 2. Every table referenced by the hotpath / embedding-vector migrations exists.
      const tables = await client.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*)::bigint AS n FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = ANY(${REQUIRED_TABLES})`;
      assert.equal(Number(tables[0].n), REQUIRED_TABLES.length);

      // 3. The hotpath indexes exist after deploy.
      const indexes = await client.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*)::bigint AS n FROM pg_indexes
         WHERE indexname = ANY(${REQUIRED_INDEXES})`;
      assert.equal(Number(indexes[0].n), REQUIRED_INDEXES.length);

      // 4. The evaluation/observability enum types exist after deploy.
      const enums = await client.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*)::bigint AS n FROM pg_type
        WHERE typname = ANY(${REQUIRED_ENUMS})
          AND typtype = 'e'`;
      assert.equal(Number(enums[0].n), REQUIRED_ENUMS.length);

      // 4b. The DocumentStatus enum carries exactly the application's status
      // contract after a fresh deploy (a migrate-deploy database must accept any
      // status the application writes — previously the chain only created a
      // legacy PROCESSING/READY/ERROR/DELETED subset).
      const docStatusEnum = await client.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*)::bigint AS n FROM pg_type
        WHERE typname = 'DocumentStatus' AND typtype = 'e'`;
      assert.equal(Number(docStatusEnum[0].n), 1);
      const docStatusValues = await client.$queryRaw<
        { enumlabel: string }[]
      >`SELECT enumlabel FROM pg_enum e
        JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'DocumentStatus'
        ORDER BY e.enumsortorder`;
      const deployed = docStatusValues.map((v) => v.enumlabel);
      for (const status of SOURCE_STATUS_VALUES) {
        assert.ok(
          deployed.includes(status),
          `fresh deploy must create DocumentStatus value "${status}"`,
        );
      }

      const owner = await client.user.create({
        data: { email: `chain-${randomUUID()}@test.local` },
      });
      const org = await client.organization.create({
        data: {
          name: `chain-${randomUUID()}`,
          slug: `chain-${randomUUID().slice(0, 8)}`,
          ownerId: owner.id,
        },
      });
      const project = await client.project.create({
        data: {
          name: `chain-${randomUUID()}`,
          slug: `chain-${randomUUID().slice(0, 8)}`,
          organizationId: org.id,
        },
      });
      const kb = await client.knowledgeBase.create({
        data: { name: "chain-kb", projectId: project.id },
      });
      const doc = await client.document.create({
        data: { name: "a.pdf", fileType: "pdf", knowledgeBaseId: kb.id },
      });
      assert.equal(doc.status, "QUEUED", "application default status must be QUEUED");

      // 5. The evaluation/observability foreign keys exist after deploy.
      const fks = await client.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*)::bigint AS n FROM information_schema.table_constraints
        WHERE constraint_name = ANY(${REQUIRED_FKS})
          AND constraint_type = 'FOREIGN KEY'`;
      assert.equal(Number(fks[0].n), REQUIRED_FKS.length);

      // 6. pgvector extension exists.
      const ext = await client.$queryRaw<
        { extname: string }[]
      >`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
      assert.equal(ext.length, 1);

      // 7. DocumentEmbedding.embedding exists with the vector type.
      const emb = await client.$queryRaw<
        { udt_name: string }[]
      >`SELECT udt_name FROM information_schema.columns
         WHERE table_name = 'DocumentEmbedding' AND column_name = 'embedding'`;
      assert.equal(emb.length, 1);
      assert.equal(emb[0].udt_name, "vector");

      // 8. Migration history is complete and up to date.
      const applied = await client.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*)::bigint AS n FROM "_prisma_migrations"
         WHERE rolled_back_at IS NOT NULL`;
      assert.equal(Number(applied[0].n), 0);

      // 9. No data-destroying statement in any migration of the chain.
      const migrationsDir = path.join(process.cwd(), "prisma", "migrations");
      for (const dir of readdirSync(migrationsDir, { withFileTypes: true })) {
        if (!dir.isDirectory()) continue;
        const sql = readFileSync(
          path.join(migrationsDir, dir.name, "migration.sql"),
          "utf8",
        );
        assert.ok(
          !/(^|\n)\s*(DROP\s+(TABLE|COLUMN|INDEX|EXTENSION|SCHEMA)|TRUNCATE|DELETE\s+FROM|DROP\s+CONSTRAINT)/i.test(sql),
          `destructive statement detected in migration ${dir.name}`,
        );
      }
    } finally {
      await client.$disconnect();
    }
  });
});