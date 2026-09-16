import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createBenchmarkDatasetVersion } from "@/lib/evaluation/benchmark";
import { trackRegressionComparison } from "@/lib/evaluation/regression-tracking";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

// Decisive deterministic paired series (8 questions, candidate clearly better).
const BASELINE_RECALL = [0.1, 0.2, 0.25, 0.3, 0.15, 0.35, 0.2, 0.25];
const CANDIDATE_RECALL = [0.6, 0.5, 0.7, 0.55, 0.8, 0.65, 0.7, 0.6];

function resultData(runId: string, questionId: string, recall: number): Prisma.BenchmarkResultUncheckedCreateInput {
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
    latencySearchMs: 400,
    totalLatencyMs: 700,
  };
}

describe("regression comparison tracking against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const datasetIds: string[] = [];
  const runIds: string[] = [];
  const memberUserId = randomUUID();
  const foreignUserId = randomUUID();
  const orgAId = randomUUID();
  const orgBId = randomUUID();

  after(async () => {
    if (!testDbUrl) return;
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      await client.benchmarkRegression.deleteMany({
        where: { OR: [{ baselineRunId: { in: runIds } }, { candidateRunId: { in: runIds } }] },
      });
      await client.benchmarkRun.deleteMany({ where: { id: { in: runIds } } });
      await client.benchmarkDataset.deleteMany({ where: { id: { in: datasetIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: userIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  it("tracks a versioned regression comparison idempotently inside the caller's organization", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      userIds.push(memberUserId, foreignUserId);
      orgIds.push(orgAId, orgBId);
      await client.user.createMany({
        data: [
          { id: memberUserId, email: `rt-member-${randomUUID()}@test.local`, name: "Member" },
          { id: foreignUserId, email: `rt-foreign-${randomUUID()}@test.local`, name: "Foreign" },
        ],
      });
      await client.organization.create({
        data: {
          id: orgAId,
          name: "RT Owner Org",
          slug: `rt-owner-${randomUUID()}`,
          ownerId: memberUserId,
          members: { create: [{ userId: memberUserId, role: "OWNER" }] },
        },
      });
      await client.organization.create({
        data: {
          id: orgBId,
          name: "RT Foreign Org",
          slug: `rt-foreign-${randomUUID()}`,
          ownerId: foreignUserId,
          members: { create: [{ userId: foreignUserId, role: "OWNER" }] },
        },
      });

      const projA = await client.project.create({
        data: { name: "RT Project A", slug: `rt-proj-a-${randomUUID()}`, organizationId: orgAId },
        select: { id: true },
      });
      const projB = await client.project.create({
        data: { name: "RT Project B", slug: `rt-proj-b-${randomUUID()}`, organizationId: orgBId },
        select: { id: true },
      });
      const kbA = await client.knowledgeBase.create({
        data: { name: "RT KB A", projectId: projA.id, retrievalConfig: {} },
        select: { id: true },
      });
      const kbB = await client.knowledgeBase.create({
        data: { name: "RT KB B", projectId: projB.id, retrievalConfig: {} },
        select: { id: true },
      });

      const rootDs = await client.benchmarkDataset.create({
        data: {
          name: `rt-root-${randomUUID()}`,
          knowledgeBaseId: kbA.id,
          questions: { create: BASELINE_RECALL.map((_, i) => ({ question: `rt-q-${i}` })) },
        },
        include: { questions: true },
      });
      const versionV1 = await createBenchmarkDatasetVersion(rootDs.id);
      const rootDs2 = await client.benchmarkDataset.create({
        data: {
          name: `rt-root2-${randomUUID()}`,
          knowledgeBaseId: kbA.id,
          questions: { create: BASELINE_RECALL.map((_, i) => ({ question: `rt-r2-${i}` })) },
        },
        include: { questions: true },
      });
      const versionV2 = await createBenchmarkDatasetVersion(rootDs2.id);
      const dsStandalone = await client.benchmarkDataset.create({
        data: {
          name: `rt-standalone-${randomUUID()}`,
          knowledgeBaseId: null,
          questions: { create: BASELINE_RECALL.map((_, i) => ({ question: `rt-sq-${i}` })) },
        },
        include: { questions: true },
      });
      const dsForeign = await client.benchmarkDataset.create({
        data: {
          name: `rt-foreign-${randomUUID()}`,
          knowledgeBaseId: kbB.id,
          questions: { create: [{ question: "rt-fq" }] },
        },
        include: { questions: true },
      });
      datasetIds.push(rootDs.id, versionV1.id, rootDs2.id, versionV2.id, dsStandalone.id, dsForeign.id);

      const baselineRun = await client.benchmarkRun.create({
        data: { name: "rt baseline", status: "completed", configSnapshot: {}, datasetId: versionV1.id },
        select: { id: true },
      });
      const candidateRun = await client.benchmarkRun.create({
        data: { name: "rt candidate", status: "completed", configSnapshot: {}, datasetId: versionV1.id },
        select: { id: true },
      });
      const otherVersionRun = await client.benchmarkRun.create({
        data: { name: "rt other version run", status: "completed", configSnapshot: {}, datasetId: versionV2.id },
        select: { id: true },
      });
      const standaloneBaseline = await client.benchmarkRun.create({
        data: { name: "rt standalone baseline", status: "completed", configSnapshot: {}, datasetId: dsStandalone.id },
        select: { id: true },
      });
      const standaloneCandidate = await client.benchmarkRun.create({
        data: { name: "rt standalone candidate", status: "completed", configSnapshot: {}, datasetId: dsStandalone.id },
        select: { id: true },
      });
      const foreignRun = await client.benchmarkRun.create({
        data: { name: "rt foreign run", status: "completed", configSnapshot: {}, datasetId: dsForeign.id },
        select: { id: true },
      });
      const exportedRun = await client.benchmarkRun.create({
        data: { name: "rt exported run", status: "completed", configSnapshot: {}, datasetId: versionV1.id },
        select: { id: true },
      });
      runIds.push(
        baselineRun.id,
        candidateRun.id,
        otherVersionRun.id,
        standaloneBaseline.id,
        standaloneCandidate.id,
        foreignRun.id,
        exportedRun.id,
      );

      await client.benchmarkResult.createMany({
        data: versionV1.questions.map((q, i) => resultData(baselineRun.id, q.id, BASELINE_RECALL[i])),
      });
      await client.benchmarkResult.createMany({
        data: versionV1.questions.map((q, i) => resultData(candidateRun.id, q.id, CANDIDATE_RECALL[i])),
      });
      await client.benchmarkResult.createMany({
        data: versionV2.questions.map((q, i) => resultData(otherVersionRun.id, q.id, BASELINE_RECALL[i])),
      });
      await client.benchmarkResult.create({ data: resultData(exportedRun.id, versionV1.questions[0].id, BASELINE_RECALL[0]) });
      await client.benchmarkResult.createMany({
        data: dsStandalone.questions.map((q, i) => resultData(standaloneBaseline.id, q.id, BASELINE_RECALL[i])),
      });
      await client.benchmarkResult.createMany({
        data: dsStandalone.questions.map((q, i) => resultData(standaloneCandidate.id, q.id, CANDIDATE_RECALL[i])),
      });
      await client.benchmarkResult.create({ data: resultData(foreignRun.id, dsForeign.questions[0].id, 0.5) });

      // Member on the pinned immutable version row: a real comparison is
      // recorded against the version's dataset id.
      const tracked = await trackRegressionComparison({ baselineRunId: baselineRun.id, candidateRunId: candidateRun.id }, orgAId);
      assert.equal(tracked.record.datasetId, versionV1.id);
      assert.equal(tracked.record.overallVerdict, "improvement");
      assert.equal(tracked.machine.ok, true);
      assert.equal(tracked.machine.state, "compatible");
      assert.equal(tracked.machine.error, null);
      assert.equal(tracked.machine.baseline.datasetId, versionV1.id);
      assert.equal(tracked.machine.candidate.datasetId, versionV1.id);
      assert.equal(tracked.machine.overall.verdict, "improvement");
      assert.equal(tracked.machine.metrics.length, 11);
      assert.equal(tracked.machine.metrics.find((m) => m.key === "recallAtK")!.pairedCount, 8);

      // The machine snapshot is what got persisted.
      const persisted = await client.benchmarkRegression.findUnique({ where: { id: tracked.record.id } });
      assert.ok(persisted);
      assert.deepEqual(persisted.result, tracked.machine);
      assert.equal(persisted.overallVerdict, "improvement");

      // Idempotent: repeating the same ordered pair rewrites one row.
      const repeated = await trackRegressionComparison({ baselineRunId: baselineRun.id, candidateRunId: candidateRun.id }, orgAId);
      assert.equal(repeated.record.id, tracked.record.id);
      assert.equal(repeated.record.overallVerdict, "improvement");

      // The verdict and all deterministic statistics are stable across the
      // recompute; only the shared engine's bootstrap CI bounds (randomly
      // resampled) may shift slightly, so byte-equality is not an idempotency
      // property. Compare the deterministic envelope instead.
      const envelope = (machine: typeof tracked.machine) => ({
        ok: machine.ok,
        state: machine.state,
        error: machine.error,
        baseline: machine.baseline,
        candidate: machine.candidate,
        alignment: machine.alignment,
        overall: machine.overall,
        metrics: machine.metrics.map((m) => ({
          key: m.key,
          label: m.label,
          higherIsBetter: m.higherIsBetter,
          pairedCount: m.pairedCount,
          baselineMean: m.baselineMean,
          candidateMean: m.candidateMean,
          delta: m.delta,
          pValue: m.pValue,
          testUsed: m.testUsed,
          effectSizeMagnitude: m.effectSizeMagnitude,
          verdict: m.verdict,
        })),
      });
      assert.deepEqual(envelope(repeated.machine), envelope(tracked.machine));
      for (const machine of [tracked.machine, repeated.machine]) {
        assert.doesNotMatch(JSON.stringify(machine), /NaN|Infinity|undefined/);
      }
      const count = await client.benchmarkRegression.count({
        where: { baselineRunId: baselineRun.id, candidateRunId: candidateRun.id },
      });
      assert.equal(count, 1);

      // Different pinned immutable versions are different datasets: honest
      // incompatibility, never compared.
      const crossVersion = await trackRegressionComparison(
        { baselineRunId: baselineRun.id, candidateRunId: otherVersionRun.id },
        orgAId,
      );
      assert.equal(crossVersion.machine.ok, false);
      assert.equal(crossVersion.machine.state, "incompatible");
      assert.deepEqual(crossVersion.machine.error, { reason: "different_datasets" });
      assert.equal(crossVersion.machine.metrics.length, 0);
      assert.equal(crossVersion.record.overallVerdict, "incompatible");

      // Foreign, out-of-org, and fabricated run ids fail identically.
      await assert.rejects(
        trackRegressionComparison({ baselineRunId: baselineRun.id, candidateRunId: foreignRun.id }, orgAId),
        /Run not found/,
        "foreign candidate must be indistinguishable from not-found",
      );
      await assert.rejects(
        trackRegressionComparison({ baselineRunId: foreignRun.id, candidateRunId: candidateRun.id }, orgAId),
        /Run not found/,
        "foreign baseline must be indistinguishable from not-found",
      );
      await assert.rejects(
        trackRegressionComparison({ baselineRunId: baselineRun.id, candidateRunId: candidateRun.id }, orgBId),
        /Run not found/,
        "another organization must not read org A's runs",
      );
      await assert.rejects(
        trackRegressionComparison({ baselineRunId: randomUUID(), candidateRunId: candidateRun.id }, orgAId),
        /Run not found/,
        "fabricated ids must fail identically",
      );

      // A run shared into another dataset still resolves only through the
      // version row the caller can see; an exported run is still org-scoped.
      await assert.rejects(
        trackRegressionComparison({ baselineRunId: exportedRun.id, candidateRunId: candidateRun.id }, orgBId),
        /Run not found/,
      );

      // Standalone (unanchored) runs stay global: any authenticated org can
      // track their comparison, in line with the shared access boundary.
      const global = await trackRegressionComparison(
        { baselineRunId: standaloneBaseline.id, candidateRunId: standaloneCandidate.id },
        orgBId,
      );
      assert.equal(global.machine.ok, true);
      assert.equal(global.machine.state, "compatible");
      assert.equal(global.machine.overall.verdict, "improvement");
    } finally {
      await client.$disconnect();
    }
  });
});