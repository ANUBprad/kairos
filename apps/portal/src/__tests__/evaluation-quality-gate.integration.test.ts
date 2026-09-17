import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { createBenchmarkDatasetVersion } from "@/lib/evaluation/benchmark";
import { trackRegressionComparison, getBenchmarkRegressionForOrg } from "@/lib/evaluation/regression-tracking";
import { evaluateQualityGate, DEFAULT_QUALITY_GATE_POLICY } from "@/lib/evaluation/quality-gate";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

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

describe("regression quality gate over persisted comparisons", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const datasetIds: string[] = [];
  const runIds: string[] = [];

  const memberUserId = randomUUID();
  const otherMemberUserId = randomUUID();
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

  it("applies the gate to a persisted comparison while honoring the org boundary", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      userIds.push(memberUserId, otherMemberUserId, foreignUserId);
      orgIds.push(orgAId, orgBId);
      await client.user.createMany({
        data: [
          { id: memberUserId, email: `qg-member-${randomUUID()}@test.local`, name: "Member" },
          { id: otherMemberUserId, email: `qg-other-${randomUUID()}@test.local`, name: "Other Member" },
          { id: foreignUserId, email: `qg-foreign-${randomUUID()}@test.local`, name: "Foreign" },
        ],
      });
      await client.organization.createMany({
        data: [
          { id: orgAId, name: "QG Org A", slug: `qg-a-${randomUUID()}`, ownerId: memberUserId },
          { id: orgBId, name: "QG Org B", slug: `qg-b-${randomUUID()}`, ownerId: foreignUserId },
        ],
      });
      const projA = await client.project.create({
        data: { name: "QG Project A", slug: `qg-proj-a-${randomUUID()}`, organizationId: orgAId },
        select: { id: true },
      });
      const kbA = await client.knowledgeBase.create({
        data: { name: "QG KB A", projectId: projA.id, retrievalConfig: {} },
        select: { id: true },
      });

      const rootDs = await client.benchmarkDataset.create({
        data: {
          name: `qg-root-${randomUUID()}`,
          knowledgeBaseId: kbA.id,
          questions: { create: BASELINE_RECALL.map((_, i) => ({ question: `qg-q-${i}` })) },
        },
        include: { questions: true },
      });
      const version = await createBenchmarkDatasetVersion(rootDs.id);
      const dsStandalone = await client.benchmarkDataset.create({
        data: {
          name: `qg-standalone-${randomUUID()}`,
          knowledgeBaseId: null,
          questions: { create: BASELINE_RECALL.map((_, i) => ({ question: `qg-sq-${i}` })) },
        },
        include: { questions: true },
      });
      datasetIds.push(rootDs.id, version.id, dsStandalone.id);

      const baseline = await client.benchmarkRun.create({
        data: { name: "qg baseline", status: "completed", configSnapshot: {}, datasetId: version.id },
        select: { id: true },
      });
      const candidate = await client.benchmarkRun.create({
        data: { name: "qg candidate", status: "completed", configSnapshot: {}, datasetId: version.id },
        select: { id: true },
      });
      const standaloneBaseline = await client.benchmarkRun.create({
        data: { name: "qg standalone baseline", status: "completed", configSnapshot: {}, datasetId: dsStandalone.id },
        select: { id: true },
      });
      const standaloneCandidate = await client.benchmarkRun.create({
        data: { name: "qg standalone candidate", status: "completed", configSnapshot: {}, datasetId: dsStandalone.id },
        select: { id: true },
      });
      runIds.push(baseline.id, candidate.id, standaloneBaseline.id, standaloneCandidate.id);

      await client.benchmarkResult.createMany({
        data: version.questions.map((q, i) => resultData(baseline.id, q.id, BASELINE_RECALL[i])),
      });
      await client.benchmarkResult.createMany({
        data: version.questions.map((q, i) => resultData(candidate.id, q.id, CANDIDATE_RECALL[i])),
      });
      await client.benchmarkResult.createMany({
        data: dsStandalone.questions.map((q, i) => resultData(standaloneBaseline.id, q.id, BASELINE_RECALL[i])),
      });
      await client.benchmarkResult.createMany({
        data: dsStandalone.questions.map((q, i) => resultData(standaloneCandidate.id, q.id, CANDIDATE_RECALL[i])),
      });

      const tracked = await trackRegressionComparison({ baselineRunId: baseline.id, candidateRunId: candidate.id }, orgAId);

      // The owning org reads the persisted snapshot back and the gate is a pure
      // function of it: deterministic, PASS under the explicit default policy.
      const persisted = await getBenchmarkRegressionForOrg(tracked.record.id, orgAId);
      assert.ok(persisted);
      assert.equal(persisted.record.id, tracked.record.id);
      assert.deepEqual(persisted.machine, tracked.machine);
      const gate = evaluateQualityGate(persisted.machine, DEFAULT_QUALITY_GATE_POLICY);
      assert.equal(gate.outcome, "PASS");
      assert.equal(gate.blocked, false);
      assert.deepEqual(evaluateQualityGate(persisted.machine, DEFAULT_QUALITY_GATE_POLICY), gate);

      // A deliberately failing policy (recallAtK below an explicit floor) is
      // blocked deterministically on the SAME persisted snapshot.
      const failing = evaluateQualityGate(persisted.machine, {
        version: 1,
        name: "integration-failing",
        onInsufficient: "block",
        onIncompatible: "block",
        metrics: [{ metric: "recallAtK", min: 0.99 }],
      });
      assert.equal(failing.outcome, "FAIL");
      assert.equal(failing.blocked, true);
      assert.equal(failing.criteria.find((c) => c.metric === "recallAtK")!.state, "fail");

      // A foreign organization cannot read this org's persisted regression.
      assert.equal(await getBenchmarkRegressionForOrg(tracked.record.id, orgBId), null);
      // Nor can a fabricated id be probed by the owning org.
      assert.equal(await getBenchmarkRegressionForOrg(randomUUID(), orgAId), null);

      // Standalone (unanchored) regressions stay global, in line with the
      // shared access boundary: another org tracks it and a third reads it.
      const globalTracked = await trackRegressionComparison(
        { baselineRunId: standaloneBaseline.id, candidateRunId: standaloneCandidate.id },
        orgBId,
      );
      const globalRead = await getBenchmarkRegressionForOrg(globalTracked.record.id, orgAId);
      assert.ok(globalRead);
      const globalGate = evaluateQualityGate(globalRead.machine, DEFAULT_QUALITY_GATE_POLICY);
      assert.equal(globalGate.outcome, "PASS");
    } finally {
      await client.$disconnect();
    }
  });
});