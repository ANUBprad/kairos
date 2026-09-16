import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  createIntelligenceRun,
  completeIntelligenceRun,
  failIntelligenceRun,
  type IntelligenceEntryResult,
  type IntelligenceOutcome,
} from "@/lib/evaluation/intelligence-persistence";
import { compareRunsForUser } from "@/lib/evaluation/regression";
import { filterAccessibleRunIds } from "@/lib/actions/evaluation";
import { assertRunAccess } from "@/lib/evaluation/access";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

// Synthetic intelligence outcome mirroring the Intelligence service response
// shape (EntryResult.to_dict with include_results=true).
function makeOutcome(
  perEntry: Array<{
    query: string;
    recall?: number;
    failed?: boolean;
    errorType?: string;
    errorMessage?: string;
  }>,
  traceId = "trace-x",
): IntelligenceOutcome {
  const results: IntelligenceEntryResult[] = perEntry.map((e, i) => {
    const base = {
      entry_id: `entry-${i}`,
      query: e.query,
      query_type: "simple",
      status: e.failed ? "error" : "ok",
      retrieved_chunks: e.failed ? [] : [`chunk-${i}-a`, `chunk-${i}-b`],
      retrieval_type: "HYBRID",
      fallback_triggered: false,
      trace_id: traceId,
      latency_classify: 0.01,
      latency_retrieval: 0.02,
      latency_generation: 0.03,
      latency_total: 0.06,
    };
    if (e.failed) {
      return { ...base, error_type: e.errorType ?? "RuntimeError", error_message: e.errorMessage ?? "boom" };
    }
    return {
      ...base,
      recall: e.recall,
      precision: e.recall,
      generated_answer: `answer-${i}`,
      prompt_tokens: 100,
      completion_tokens: 50,
      model: "test-model",
      cost_usd: 0.001,
      judge_scores: { faithfulness: 0.9, relevance: 0.8, hallucination: 0.1, grounding: 0.85 },
      composite_judge_score: 0.85,
    };
  });
  const ok = results.filter((r) => r.status === "ok");
  return {
    total: results.length,
    succeeded: ok.length,
    failed: results.length - ok.length,
    success_rate: ok.length / results.length,
    mean_latency: { classify: 0.01, retrieval: 0.02, generation: 0.03, total: 0.06 },
    total_tokens: { prompt_tokens: 100 * ok.length, completion_tokens: 50 * ok.length },
    total_cost_usd: 0.001 * ok.length,
    mean_recall: ok.length ? 0.5 : null,
    mean_precision: ok.length ? 0.5 : null,
    mean_judge_scores: ok.length
      ? { faithfulness: 0.9, relevance: 0.8, hallucination: 0.1, grounding: 0.85 }
      : undefined,
    results,
    trace_id: traceId,
  };
}

describe("intelligence evaluation persistence against a real database", () => {
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

  async function seedTenant(client: PrismaClient, tag: string): Promise<{ userId: string; kbId: string }> {
    if (!testDbUrl) throw new Error("no test db");
    const userId = randomUUID();
    const orgId = randomUUID();
    userIds.push(userId);
    orgIds.push(orgId);
    const member = await client.user.create({
      data: { id: userId, email: `ip-${tag}-${randomUUID()}@test.local`, name: "Member" },
      select: { id: true },
    });
    const org = await client.organization.create({
      data: {
        id: orgId,
        name: `IP ${tag} Org`,
        slug: `ip-${tag}-${randomUUID()}`,
        ownerId: member.id,
        members: { create: [{ userId: member.id, role: "OWNER" }] },
      },
      select: { id: true },
    });
    const project = await client.project.create({
      data: { name: `IP ${tag} Project`, slug: `ip-${tag}-proj-${randomUUID()}`, organizationId: org.id },
      select: { id: true },
    });
    projectIds.push(project.id);
    const kb = await client.knowledgeBase.create({
      data: { name: `IP ${tag} KB`, projectId: project.id, retrievalConfig: {} },
      select: { id: true },
    });
    knowledgeBaseIds.push(kb.id);
    return { userId: member.id, kbId: kb.id };
  }

  it("persists a completed intelligence run with per-entry metrics and honest failures", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { userId, kbId } = await seedTenant(client, "happy");

      const datasetName = `ip-happy-${randomUUID()}`;
      const { runId, datasetId } = await createIntelligenceRun({
        datasetName,
        knowledgeBaseId: kbId,
        userId,
        label: "happy run",
        config: { topK: 5, generate: true, judge: true },
      });
      datasetIds.push(datasetId);
      runIds.push(runId);

      const running = await client.benchmarkRun.findUniqueOrThrow({ where: { id: runId } });
      assert.equal(running.status, "running");
      assert.equal(running.datasetId, datasetId);
      assert.equal(running.createdById, userId);
      const createdSnapshot = running.configSnapshot as Record<string, unknown>;
      assert.equal(createdSnapshot.engine, "intelligence");
      assert.equal(createdSnapshot.topK, 5);
      assert.equal(running.completedAt, null);

      await completeIntelligenceRun(runId, makeOutcome([
        { query: "q1", recall: 0.8 },
        { query: "q2", recall: 0.6 },
      ]));

      const completed = await client.benchmarkRun.findUniqueOrThrow({
        where: { id: runId },
        include: { results: { include: { question: true } } },
      });
      assert.equal(completed.status, "completed");
      assert.ok(completed.completedAt, "completedAt should be set on a completed run");
      assert.equal((completed.configSnapshot as Record<string, unknown>).traceId, "trace-x", "outcome trace_id merged into configSnapshot");
      const agg = completed.aggregatedMetrics as Record<string, unknown>;
      assert.equal(agg.total, 2);
      assert.equal(agg.succeeded, 2);
      assert.equal(agg.failed, 0);
      assert.equal(agg.successRate, 1);
      assert.equal(agg.avgRecallAtK, 0.5);
      assert.equal(agg.avgFaithfulness, 0.9);
      assert.equal(agg.avgLatencyMs, 60);
      assert.deepEqual(agg.totalTokens, { prompt_tokens: 200, completion_tokens: 100 });
      assert.equal(agg.totalCostUsd, 0.002);

      const rQ1 = completed.results.find((r) => r.question.question === "q1");
      assert.ok(rQ1, "q1 row persisted");
      assert.equal(rQ1.retrievedChunkIds, "chunk-0-a,chunk-0-b", "q1 chunk ids persisted as text list and JSON");
      assert.equal(rQ1.generatedAnswer, "answer-0");
      const rQ2 = completed.results.find((r) => r.question.question === "q2");
      assert.ok(rQ2, "q2 row persisted");
      assert.equal(rQ2.retrievedChunkIds, "chunk-1-a,chunk-1-b", "chunk ids match their entry");
      assert.equal(rQ2.generatedAnswer, "answer-1");
      for (const result of completed.results) {
        assert.equal(result.runId, runId);
        assert.deepEqual(result.error, null, "ok entries carry no error");
        assert.equal(result.totalLatencyMs, 60, "seconds converted to whole milliseconds");
        assert.equal(result.latencySearchMs, 20);
        assert.equal(result.latencyGenerationMs, 30);
        assert.ok(Array.isArray(result.retrievedChunks));
        const snapshot = result.configSnapshot as Record<string, unknown>;
        assert.equal(snapshot.engine, "intelligence");
        assert.equal(snapshot.model, "test-model");
        assert.equal(snapshot.traceId, "trace-x");
      }
      const q2 = await client.benchmarkQuestion.findFirstOrThrow({
        where: { datasetId, question: "q2" },
      });
      assert.deepEqual(q2.metadata, { intelligenceSource: true });

      const failedRun = await createIntelligenceRun({
        datasetName,
        knowledgeBaseId: kbId,
        userId,
        config: {},
      });
      runIds.push(failedRun.runId);
      await completeIntelligenceRun(failedRun.runId, makeOutcome([
        { query: "q1", recall: 0.8 },
        { query: "broken", failed: true, errorType: "RetrievalError", errorMessage: "upstream broke" },
      ]));
      const failedRow = await client.benchmarkRun.findUniqueOrThrow({
        where: { id: failedRun.runId },
        include: { results: { include: { question: true } } },
      });
      assert.equal(failedRow.status, "completed");
      const erroredResult = failedRow.results.find((r) => r.question.question === "broken");
      assert.ok(erroredResult, "failed entry persisted as a result");
      assert.deepEqual(
        (erroredResult.error as Record<string, unknown>),
        { status: "error", errorType: "RetrievalError", errorMessage: "upstream broke" },
      );
      assert.equal(erroredResult.generatedAnswer, null);
      assert.equal(erroredResult.retrievalMetrics, null);
      const failedAgg = failedRow.aggregatedMetrics as Record<string, unknown>;
      assert.equal(failedAgg.succeeded, 1);
      assert.equal(failedAgg.failed, 1);
      assert.equal(failedAgg.successRate, 0.5);

      const allFailed = await createIntelligenceRun({
        datasetName,
        knowledgeBaseId: kbId,
        userId,
        config: {},
      });
      runIds.push(allFailed.runId);
      await completeIntelligenceRun(allFailed.runId, makeOutcome([
        { query: "ghost", failed: true },
        { query: "ghost2", failed: true },
      ]));
      const allFailedRun = await client.benchmarkRun.findUniqueOrThrow({
        where: { id: allFailed.runId },
        include: { results: true },
      });
      assert.equal(allFailedRun.status, "failed");
      assert.ok(allFailedRun.completedAt);
      assert.equal(allFailedRun.results.length, 2);
      for (const r of allFailedRun.results) {
        assert.ok(r.error, "every failed entry records its error");
      }
    } finally {
      await client.$disconnect();
    }
  });

  it("drops non-finite metric values before they reach the database", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { userId, kbId } = await seedTenant(client, "nan");

      const datasetName = `ip-nan-${randomUUID()}`;
      const { runId, datasetId } = await createIntelligenceRun({
        datasetName,
        knowledgeBaseId: kbId,
        userId,
        config: {},
      });
      datasetIds.push(datasetId);
      runIds.push(runId);

      const outcome = makeOutcome([
        { query: "n1", recall: 0.5 },
        { query: "n2", recall: 0.5 },
      ]);
      outcome.mean_recall = NaN;
      outcome.mean_precision = Infinity;
      outcome.success_rate = NaN;
      outcome.mean_judge_scores = { faithfulness: NaN, relevance: 0.8, hallucination: 0.1, grounding: 0.85 };
      const entryJudgeScores = outcome.results[0].judge_scores!;
      entryJudgeScores.faithfulness = NaN;
      entryJudgeScores.relevance = Infinity;
      outcome.results[0].composite_judge_score = Infinity;

      await completeIntelligenceRun(runId, outcome);

      const completed = await client.benchmarkRun.findUniqueOrThrow({
        where: { id: runId },
        include: { results: true },
      });
      // JSONB cannot hold NaN/Infinity: the run must still finalize and the
      // non-finite values must be dropped rather than poisoning the write.
      assert.equal(completed.status, "completed");
      const agg = completed.aggregatedMetrics as Record<string, unknown>;
      assert.equal("avgRecallAtK" in agg, false, "NaN mean_recall is dropped");
      assert.equal("avgPrecisionAtK" in agg, false, "Infinity mean_precision is dropped");
      assert.equal("successRate" in agg, false, "NaN success_rate is dropped");
      assert.equal("avgFaithfulness" in agg, false, "NaN mean judge score is dropped");
      assert.equal(agg.avgLatencyMs, 60);
      const fromDb = JSON.stringify(completed.aggregatedMetrics);
      assert.doesNotMatch(fromDb, /NaN|Infinity/, "no non-finite values in persisted metrics");
      for (const r of completed.results) {
        if (r.generationMetrics) {
          const g = JSON.stringify(r.generationMetrics);
          assert.doesNotMatch(g, /NaN|Infinity/, "per-entry generation metrics are finite");
        }
      }
      const q1 = completed.results.find((r) => (r.configSnapshot as Record<string, unknown>).traceId === "trace-x");
      assert.ok(q1, "at least one row persisted");
      if (q1.generationMetrics) {
        const gm = q1.generationMetrics as Record<string, number>;
        assert.equal("faithfulness" in gm, false, "NaN per-entry score dropped");
        assert.equal("relevance" in gm, false, "Infinity per-entry score dropped");
        assert.equal("compositeJudgeScore" in gm, false, "Infinity composite score dropped");
        assert.equal(gm.hallucination, 0.1, "finite per-entry score retained");
      }
    } finally {
      await client.$disconnect();
    }
  });

  it("finalizes a run once and treats re-execution as a fresh run, never coalescing results", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const { userId, kbId } = await seedTenant(client, "idem");

      const datasetName = `ip-idem-${randomUUID()}`;
      const first = await createIntelligenceRun({ datasetName, knowledgeBaseId: kbId, userId, config: {} });
      const second = await createIntelligenceRun({ datasetName, knowledgeBaseId: kbId, userId, config: {} });
      datasetIds.push(first.datasetId, second.datasetId);
      runIds.push(first.runId, second.runId);
      assert.notEqual(first.runId, second.runId, "each execution is its own run");
      assert.equal(first.datasetId, second.datasetId, "same dataset name reuses the persisted dataset");

      await completeIntelligenceRun(first.runId, makeOutcome([
        { query: "i1", recall: 0.5 },
        { query: "i2", recall: 0.5 },
      ]));
      // Re-finalizing the same run must be a no-op (guard on status).
      await completeIntelligenceRun(first.runId, makeOutcome([
        { query: "i1", recall: 0.1 },
        { query: "i2", recall: 0.1 },
        { query: "i3", recall: 0.1 },
      ]));
      await failIntelligenceRun(first.runId);

      const firstRun = await client.benchmarkRun.findUniqueOrThrow({
        where: { id: first.runId },
        include: { results: true },
      });
      assert.equal(firstRun.status, "completed", "failIntelligenceRun is a no-op after the run is finalized");
      assert.equal(firstRun.results.length, 2, "re-finalize did not duplicate results");
      const persistedDupes = await client.benchmarkResult.count({ where: { runId: first.runId } });
      assert.equal(persistedDupes, 2);

      await completeIntelligenceRun(second.runId, makeOutcome([
        { query: "i1", recall: 0.5 },
        { query: "i2", recall: 0.5 },
        { query: "i3", recall: 0.5 },
      ]));
      const secondRun = await client.benchmarkRun.findUniqueOrThrow({
        where: { id: second.runId },
        include: { results: true },
      });
      assert.equal(secondRun.status, "completed");
      assert.equal(secondRun.results.length, 3);
      assert.equal((await client.benchmarkResult.count({ where: { runId: first.runId } })), 2, "re-execution never writes into a previous run");

      const questionCount = await client.benchmarkQuestion.count({ where: { datasetId: first.datasetId } });
      assert.equal(questionCount, 3, "questions sync once per distinct query, no duplicated rows");
    } finally {
      await client.$disconnect();
    }
  });

  it("feeds the regression comparison and the leaderboard scoping, and stays tenant-isolated", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      const member = await seedTenant(client, "regress");
      const foreign = await seedTenant(client, "foreign");

      const regressionDatasetName = `ip-regress-${randomUUID()}`;
      const baseline = await createIntelligenceRun({
        datasetName: regressionDatasetName,
        knowledgeBaseId: member.kbId,
        userId: member.userId,
        label: "baseline",
        config: {},
      });
      datasetIds.push(baseline.datasetId);
      runIds.push(baseline.runId);
      const candidate = await createIntelligenceRun({
        datasetName: regressionDatasetName,
        knowledgeBaseId: member.kbId,
        userId: member.userId,
        label: "candidate",
        config: {},
      });
      datasetIds.push(candidate.datasetId);
      runIds.push(candidate.runId);
      assert.equal(baseline.datasetId, candidate.datasetId, "paired regression runs share one dataset");
      const foreignRun = await createIntelligenceRun({
        datasetName: `ip-foreign-${randomUUID()}`,
        knowledgeBaseId: foreign.kbId,
        userId: foreign.userId,
        config: {},
      });
      datasetIds.push(foreignRun.datasetId);
      runIds.push(foreignRun.runId);

      await completeIntelligenceRun(baseline.runId, makeOutcome([
        { query: "b-0", recall: 0.1 },
        { query: "b-1", recall: 0.2 },
        { query: "b-2", recall: 0.25 },
        { query: "b-3", recall: 0.3 },
        { query: "b-4", recall: 0.15 },
        { query: "b-5", recall: 0.35 },
        { query: "b-6", recall: 0.2 },
        { query: "b-7", recall: 0.25 },
      ], "trace-b"));
      await completeIntelligenceRun(candidate.runId, makeOutcome([
        { query: "b-0", recall: 0.6 },
        { query: "b-1", recall: 0.5 },
        { query: "b-2", recall: 0.7 },
        { query: "b-3", recall: 0.55 },
        { query: "b-4", recall: 0.8 },
        { query: "b-5", recall: 0.65 },
        { query: "b-6", recall: 0.7 },
        { query: "b-7", recall: 0.6 },
      ], "trace-c"));
      await completeIntelligenceRun(foreignRun.runId, makeOutcome([{ query: "foreign-q", recall: 0.9 }]));

      const exposed = await filterAccessibleRunIds([candidate.runId, foreignRun.runId], member.userId);
      assert.deepEqual(exposed.sort(), [candidate.runId], "member sees only their tenant's run");

      await assert.rejects(
        assertRunAccess(foreignRun.runId, member.userId),
        /(Run|Dataset) not found/,
        "foreign run is indistinguishable from missing across tenants",
      );

      const comparison = await compareRunsForUser(baseline.runId, candidate.runId, member.userId);
      assert.equal(comparison.ok, true);
      assert.equal(comparison.alignment.shared, 8);
      assert.equal(comparison.overall.verdict, "improvement");
      const recall = comparison.metrics.find((m) => m.key === "recallAtK")!;
      assert.equal(recall.verdict, "improvement");
      assert.ok((recall.pValue ?? 1) < 0.05, `expected p < 0.05, got ${recall.pValue}`);

      await assert.rejects(
        compareRunsForUser(baseline.runId, foreignRun.runId, member.userId),
        /Run not found/,
        "cross-tenant comparison is rejected at the boundary",
      );
    } finally {
      await client.$disconnect();
    }
  });
});