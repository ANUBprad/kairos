import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { compareRunsForUser } from "@/lib/evaluation/regression";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

// Decisive deterministic paired series (8 questions, candidate clearly better).
const BASELINE_RECALL = [0.1, 0.2, 0.25, 0.3, 0.15, 0.35, 0.2, 0.25];
const CANDIDATE_RECALL = [0.6, 0.5, 0.7, 0.55, 0.8, 0.65, 0.7, 0.6];

// Flat BenchmarkResult.create data derived from the decisive series.
function resultData(runId: string, questionId: string, recall: number, opts: { search?: number; total?: number } = {}): Prisma.BenchmarkResultUncheckedCreateInput {
  return {
    runId,
    questionId,
    retrievalMetrics: {
      recallAtK: recall,
      precisionAtK: recall,
      hitRate: recall,
      meanReciprocalRank: recall,
      ndcg: recall,
    },
    generationMetrics: {
      faithfulness: recall,
      contextPrecision: 0.5,
      contextRecall: 0.5,
      answerRelevancy: 0.4,
    },
    latencySearchMs: opts.search ?? 400,
    totalLatencyMs: opts.total ?? 700,
  };
}

describe("statistical regression comparison tenancy against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const datasetIds: string[] = [];
  const runIds: string[] = [];
  const memberUserId = randomUUID();
  const outsiderUserId = randomUUID();
  const foreignUserId = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();

  after(async () => {
    if (!testDbUrl) return;
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      await client.benchmarkRun.deleteMany({ where: { id: { in: runIds } } });
      await client.benchmarkDataset.deleteMany({ where: { id: { in: datasetIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("compares persisted per-case results inside the caller's tenant and rejects access to everything else", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      userIds.push(memberUserId, outsiderUserId, foreignUserId);
      orgIds.push(orgAId, orgBId);
      await client.user.createMany({
        data: [
          { id: memberUserId, email: `rc-member-${randomUUID()}@test.local`, name: "Member" },
          { id: outsiderUserId, email: `rc-outsider-${randomUUID()}@test.local`, name: "Outsider" },
          { id: foreignUserId, email: `rc-foreign-${randomUUID()}@test.local`, name: "Foreign" },
        ],
      });
      await client.organization.create({
        data: {
          id: orgAId,
          name: "Regression Owner Org",
          slug: `rc-owner-${randomUUID()}`,
          ownerId: memberUserId,
          members: { create: [{ userId: memberUserId, role: "OWNER" }] },
        },
      });
      await client.organization.create({
        data: {
          id: orgBId,
          name: "Regression Foreign Org",
          slug: `rc-foreign-${randomUUID()}`,
          ownerId: foreignUserId,
          members: { create: [{ userId: foreignUserId, role: "OWNER" }] },
        },
      });

      const projA = await client.project.create({
        data: { name: "RC Project A", slug: `rc-proj-a-${randomUUID()}`, organizationId: orgAId },
        select: { id: true },
      });
      const projA2 = await client.project.create({
        data: { name: "RC Project A2", slug: `rc-proj-a2-${randomUUID()}`, organizationId: orgAId },
        select: { id: true },
      });
      const projB = await client.project.create({
        data: { name: "RC Project B", slug: `rc-proj-b-${randomUUID()}`, organizationId: orgBId },
        select: { id: true },
      });
      const kbA = await client.knowledgeBase.create({
        data: { name: "RC KB A", projectId: projA.id, retrievalConfig: {} },
        select: { id: true },
      });
      const kbA2 = await client.knowledgeBase.create({
        data: { name: "RC KB A2", projectId: projA2.id, retrievalConfig: {} },
        select: { id: true },
      });
      const kbB = await client.knowledgeBase.create({
        data: { name: "RC KB B", projectId: projB.id, retrievalConfig: {} },
        select: { id: true },
      });

      const dsA = await client.benchmarkDataset.create({
        data: {
          name: `rc-a-${randomUUID()}`,
          knowledgeBaseId: kbA.id,
          questions: { create: BASELINE_RECALL.map((_, i) => ({ question: `rc-q-${i}` })) },
        },
        include: { questions: true },
      });
      const dsOther = await client.benchmarkDataset.create({
        data: {
          name: `rc-other-${randomUUID()}`,
          knowledgeBaseId: kbA2.id,
          questions: { create: [{ question: "rc-other-q" }] },
        },
        include: { questions: true },
      });
      const dsStandalone = await client.benchmarkDataset.create({
        data: {
          name: `rc-standalone-${randomUUID()}`,
          knowledgeBaseId: null,
          questions: { create: BASELINE_RECALL.map((_, i) => ({ question: `rc-sq-${i}` })) },
        },
        include: { questions: true },
      });
      const dsForeign = await client.benchmarkDataset.create({
        data: {
          name: `rc-foreign-${randomUUID()}`,
          knowledgeBaseId: kbB.id,
          questions: { create: [{ question: "rc-fq" }] },
        },
        include: { questions: true },
      });
      datasetIds.push(dsA.id, dsOther.id, dsStandalone.id, dsForeign.id);

      const baselineRun = await client.benchmarkRun.create({
        data: { name: "baseline run", status: "completed", configSnapshot: {}, datasetId: dsA.id },
        select: { id: true },
      });
      const candidateRun = await client.benchmarkRun.create({
        data: { name: "candidate run", status: "completed", configSnapshot: {}, datasetId: dsA.id },
        select: { id: true },
      });
      const partialRun = await client.benchmarkRun.create({
        data: { name: "partial run", status: "completed", configSnapshot: {}, datasetId: dsA.id },
        select: { id: true },
      });
      const runningRun = await client.benchmarkRun.create({
        data: { name: "running run", status: "running", configSnapshot: {}, datasetId: dsA.id },
        select: { id: true },
      });
      const otherDatasetRun = await client.benchmarkRun.create({
        data: { name: "other dataset run", status: "completed", configSnapshot: {}, datasetId: dsOther.id },
        select: { id: true },
      });
      const standaloneBaseline = await client.benchmarkRun.create({
        data: { name: "standalone baseline", status: "completed", configSnapshot: {}, datasetId: dsStandalone.id },
        select: { id: true },
      });
      const standaloneCandidate = await client.benchmarkRun.create({
        data: { name: "standalone candidate", status: "completed", configSnapshot: {}, datasetId: dsStandalone.id },
        select: { id: true },
      });
      const foreignRun = await client.benchmarkRun.create({
        data: { name: "foreign run", status: "completed", configSnapshot: {}, datasetId: dsForeign.id },
        select: { id: true },
      });
      const deletedRun = await client.benchmarkRun.create({
        data: { name: "deleted run", status: "completed", configSnapshot: {}, datasetId: dsA.id },
        select: { id: true },
      });
      await client.benchmarkRun.delete({ where: { id: deletedRun.id } });
      runIds.push(
        baselineRun.id,
        candidateRun.id,
        partialRun.id,
        runningRun.id,
        otherDatasetRun.id,
        standaloneBaseline.id,
        standaloneCandidate.id,
        foreignRun.id,
        deletedRun.id,
      );

      await client.benchmarkResult.createMany({
        data: dsA.questions.map((q, i) => resultData(baselineRun.id, q.id, BASELINE_RECALL[i])),
      });
      await client.benchmarkResult.createMany({
        data: dsA.questions.map((q, i) => resultData(candidateRun.id, q.id, CANDIDATE_RECALL[i], {
          search: [250, 240, 260, 245, 235, 265, 255, 250][i],
          total: [400, 390, 410, 395, 385, 430, 420, 400][i],
        })),
      });
      await client.benchmarkResult.createMany({
        data: dsA.questions.slice(0, 4).map((q, i) => resultData(partialRun.id, q.id, BASELINE_RECALL[i])),
      });
      await client.benchmarkResult.create({
        data: resultData(otherDatasetRun.id, dsOther.questions[0].id, 0.5),
      });
      await client.benchmarkResult.createMany({
        data: dsStandalone.questions.map((q, i) => resultData(standaloneBaseline.id, q.id, BASELINE_RECALL[i])),
      });
      await client.benchmarkResult.createMany({
        data: dsStandalone.questions.map((q, i) => resultData(standaloneCandidate.id, q.id, CANDIDATE_RECALL[i], {
          search: [250, 240, 260, 245, 235, 265, 255, 250][i],
          total: [400, 390, 410, 395, 385, 430, 420, 400][i],
        })),
      });
      await client.benchmarkResult.create({
        data: resultData(foreignRun.id, dsForeign.questions[0].id, 0.5),
      });

      // Same-tenant member: baseline vs candidate verdicts emerge from paired results.
      const comparison = await compareRunsForUser(baselineRun.id, candidateRun.id, memberUserId);
      assert.equal(comparison.ok, true);
      assert.equal(comparison.alignment.shared, 8);
      assert.equal(comparison.alignment.baselineOnly, 0);
      assert.equal(comparison.alignment.candidateOnly, 0);
      assert.equal(comparison.overall.verdict, "improvement");
      const recall = comparison.metrics.find((m) => m.key === "recallAtK")!;
      assert.equal(recall.verdict, "improvement");
      assert.equal(recall.pairedCount, 8);
      assert.ok((recall.pValue ?? 1) < 0.05, `expected p < 0.05, got ${recall.pValue}`);
      const candidateLatency = comparison.metrics.find((m) => m.key === "totalLatencyMs")!;
      assert.equal(candidateLatency.verdict, "improvement");

      // Compatibility guards are structured, not thrown.
      const same = await compareRunsForUser(baselineRun.id, baselineRun.id, memberUserId);
      assert.equal(same.ok, false);
      assert.deepEqual(same.error, { reason: "same_run" });
      assert.deepEqual(
        (await compareRunsForUser(baselineRun.id, otherDatasetRun.id, memberUserId)).error,
        { reason: "different_datasets" },
      );
      assert.deepEqual(
        (await compareRunsForUser(baselineRun.id, runningRun.id, memberUserId)).error,
        { reason: "run_not_completed", status: "running", run: "candidate" },
      );

      // Partial overlap is reported, never extrapolated.
      const partial = await compareRunsForUser(baselineRun.id, partialRun.id, memberUserId);
      assert.equal(partial.ok, true);
      assert.equal(partial.alignment.shared, 4);
      assert.equal(partial.alignment.baselineOnly, 4);
      assert.equal(partial.alignment.candidateOnly, 0);
      assert.equal(partial.metrics.find((m) => m.key === "recallAtK")!.pairedCount, 4);

      // The member cannot read a foreign tenant's run as either side — uniform "Run not found".
      await assert.rejects(
        compareRunsForUser(foreignRun.id, candidateRun.id, memberUserId),
        /Run not found/,
        "foreign baseline must fail as not-found",
      );
      await assert.rejects(
        compareRunsForUser(baselineRun.id, foreignRun.id, memberUserId),
        /Run not found/,
        "foreign candidate must fail as not-found",
      );
      await assert.rejects(
        compareRunsForUser(randomUUID(), candidateRun.id, memberUserId),
        /Run not found/,
        "fabricated baseline must fail as not-found",
      );
      await assert.rejects(
        compareRunsForUser(baselineRun.id, deletedRun.id, memberUserId),
        /Run not found/,
        "deleted candidate must fail as not-found",
      );

      // An authenticated caller outside the org can compare unanchored global runs
      // but never the org's org-tenanted runs.
      const global = await compareRunsForUser(standaloneBaseline.id, standaloneCandidate.id, outsiderUserId);
      assert.equal(global.ok, true);
      assert.equal(global.overall.verdict, "improvement");
      await assert.rejects(
        compareRunsForUser(baselineRun.id, candidateRun.id, outsiderUserId),
        /Run not found/,
        "outsider must not read org-tenanted runs",
      );

      // The foreign tenant's owner cannot compare across tenants either.
      await assert.rejects(
        compareRunsForUser(baselineRun.id, standaloneCandidate.id, foreignUserId),
        /Run not found/,
        "foreign owner must not read the member's runs",
      );
    } finally {
      await client.$disconnect();
    }
  });
});