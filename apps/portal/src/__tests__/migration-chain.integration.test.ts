import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { readdirSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const HOTPATH_TABLES = [
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
];

const HOTPATH_INDEXES = [
  "ApiKey_keyPrefix_idx",
  "ExperimentRun_knowledgeBaseId_createdAt_idx",
  "BenchmarkRun_status_idx",
  "ProviderHealth_organizationId_date_idx",
  "Conversation_knowledgeBaseId_userId_idx",
  "Message_conversationId_createdAt_idx",
  "MessageCitation_messageId_idx",
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
           AND table_name = ANY(${HOTPATH_TABLES})`;
      assert.equal(Number(tables[0].n), HOTPATH_TABLES.length);

      // 3. The hotpath indexes exist after deploy.
      const indexes = await client.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*)::bigint AS n FROM pg_indexes
         WHERE indexname = ANY(${HOTPATH_INDEXES})`;
      assert.equal(Number(indexes[0].n), HOTPATH_INDEXES.length);

      // 4. pgvector extension exists.
      const ext = await client.$queryRaw<
        { extname: string }[]
      >`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
      assert.equal(ext.length, 1);

      // 5. DocumentEmbedding.embedding exists with the vector type.
      const emb = await client.$queryRaw<
        { udt_name: string }[]
      >`SELECT udt_name FROM information_schema.columns
         WHERE table_name = 'DocumentEmbedding' AND column_name = 'embedding'`;
      assert.equal(emb.length, 1);
      assert.equal(emb[0].udt_name, "vector");

      // 6. Migration history is complete and up to date.
      const applied = await client.$queryRaw<
        { n: bigint }[]
      >`SELECT count(*)::bigint AS n FROM "_prisma_migrations"
         WHERE rolled_back_at IS NOT NULL`;
      assert.equal(Number(applied[0].n), 0);

      // 7. No data-destroying statement in any migration of the chain.
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