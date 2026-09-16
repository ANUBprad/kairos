import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { runBenchmark } from "@/lib/evaluation/benchmark";
import { DEFAULT_RETRIEVAL_CONFIG } from "@/lib/retrieval/types";

// Force getEmbeddingProvider("gemini") to throw "GEMINI_API_KEY is not
// configured" synchronously, before any network: runBenchmark's every-question
// catch then deterministically produces an all-fail run. No other test in the
// suite reads this env var (chat-provider-signal passes keys explicitly).
delete process.env.GEMINI_API_KEY;

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("runBenchmark failure lifecycle against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const projectIds: string[] = [];
  const knowledgeBaseIds: string[] = [];
  const datasetIds: string[] = [];
  const runIds: string[] = [];

  after(async () => {
    if (!testDbUrl) return;
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      await client.benchmarkResult.deleteMany({ where: { runId: { in: runIds } } });
      await client.benchmarkRun.deleteMany({ where: { id: { in: runIds } } });
      await client.benchmarkDataset.deleteMany({ where: { id: { in: datasetIds } } });
      await client.knowledgeBase.deleteMany({ where: { id: { in: knowledgeBaseIds } } });
      await client.project.deleteMany({ where: { id: { in: projectIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  async function seedKb(client: PrismaClient, tag: string): Promise<{ userId: string; kbId: string }> {
    if (!testDbUrl) throw new Error("no test db");
    const userId = randomUUID();
    const orgId = randomUUID();
    userIds.push(userId);
    orgIds.push(orgId);
    const member = await client.user.create({
      data: { id: userId, email: `br-${tag}-${randomUUID()}@test.local`, name: "Member" },
      select: { id: true },
    });
    const org = await client.organization.create({
      data: {
        id: orgId,
        name: `BR ${tag} Org`,
        slug: `br-${tag}-${randomUUID()}`,
        ownerId: member.id,
        members: { create: [{ userId: member.id, role: "OWNER" }] },
      },
      select: { id: true },
    });
    const project = await client.project.create({
      data: { name: `BR ${tag} Project`, slug: `br-${tag}-proj-${randomUUID()}`, organizationId: org.id },
      select: { id: true },
    });
    projectIds.push(project.id);
    const kb = await client.knowledgeBase.create({
      data: { name: `BR ${tag} KB`, projectId: project.id, retrievalConfig: {} },
      select: { id: true },
    });
    knowledgeBaseIds.push(kb.id);
    return { userId: member.id, kbId: kb.id };
  }

  it("marks a run failed (not completed) when every question fails, with no NaN aggregated metrics", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { kbId } = await seedKb(client, "allfail");

      const datasetName = `br-allfail-${randomUUID()}`;
      const dataset = await client.benchmarkDataset.create({
        data: {
          name: datasetName,
          questions: {
            create: [
              { question: "boom one" },
              { question: "boom two" },
            ],
          },
        },
        include: { questions: true },
      });
      datasetIds.push(dataset.id);
      assert.equal(dataset.questions.length, 2);

      // Deterministically broken retrieval: an unregistered strategy falls
      // through to getEmbeddingProvider("gemini"), which throws synchronously
      // because this file deletes GEMINI_API_KEY before any provider is built.
      const config = {
        ...DEFAULT_RETRIEVAL_CONFIG,
        retrievalStrategy: "no-such-strategy",
        embeddingProvider: "gemini",
      };

      const runId = await runBenchmark(dataset.id, kbId, config as never, "all-fail run");
      runIds.push(runId);

      const run = await client.benchmarkRun.findUniqueOrThrow({
        where: { id: runId },
        include: { results: true },
      });
      assert.equal(run.status, "failed", "an all-fail run must not be marked completed");
      assert.ok(run.completedAt, "a failed run records when it finalized");
      assert.equal(run.results.length, 0, "no failed question persists a result row");
      assert.equal(JSON.stringify(run.aggregatedMetrics), "{}", "no NaN avgLatencyMs leaks into aggregated metrics");
    } finally {
      await client.$disconnect();
    }
  });
});