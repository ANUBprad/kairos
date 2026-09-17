// Headless proof that the regression tracking command and its quality gate work
// end to end against a migrated database: seed an org chain with an immutable
// dataset version, track a comparison, re-track it (idempotency), reject a
// foreign pair, read the persisted comparison back through the org boundary,
// evaluate the configured quality gate (PASS path), prove a deliberately
// failing policy is blocked deterministically, and emit both machine-readable
// results as a JSON artifact. Exit code is non-zero on any failure so CI sees
// tracking or gating break. The gate runs on the persisted snapshot only, never
// on a fresh comparison, so the outcome is deterministic.
//
// Policy: KAIROS_QUALITY_GATE_POLICY env var (JSON) or the documented default.
//
// Usage: KAIROS_TEST_DATABASE_URL=postgresql://... node --import tsx scripts/verify-regression-tracking.ts
import { randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { prisma } from "@/lib/prisma";
import { createBenchmarkDatasetVersion } from "@/lib/evaluation/benchmark";
import {
  trackRegressionComparison,
  getBenchmarkRegressionForOrg,
  type MachineRegressionResult,
} from "@/lib/evaluation/regression-tracking";
import {
  evaluateQualityGate,
  parseQualityGatePolicyJson,
  DEFAULT_QUALITY_GATE_POLICY,
  type QualityGatePolicy,
} from "@/lib/evaluation/quality-gate";

const BASELINE_RECALL = [0.1, 0.2, 0.25, 0.3, 0.15, 0.35, 0.2, 0.25];
const CANDIDATE_RECALL = [0.6, 0.5, 0.7, 0.55, 0.8, 0.65, 0.7, 0.6];

function loadPolicy(): QualityGatePolicy {
  const raw = process.env.KAIROS_QUALITY_GATE_POLICY;
  if (raw) {
    const parsed = parseQualityGatePolicyJson(raw);
    if (!parsed.policy) {
      throw new Error(`invalid KAIROS_QUALITY_GATE_POLICY: ${parsed.errors.join("; ")}`);
    }
    return parsed.policy;
  }
  return DEFAULT_QUALITY_GATE_POLICY;
}

async function main() {
  const memberUserId = randomUUID();
  const foreignUserId = randomUUID();
  const orgId = randomUUID();
  const foreignOrgId = randomUUID();
  const runIds: string[] = [];
  const datasetIds: string[] = [];

  try {
    await prisma.user.createMany({
      data: [
        { id: memberUserId, email: `verify-${randomUUID()}@test.local`, name: "Verify Member" },
        { id: foreignUserId, email: `verify-${randomUUID()}@test.local`, name: "Verify Foreign" },
      ],
    });
    await prisma.organization.createMany({
      data: [
        { id: orgId, name: "Verify Org", slug: `verify-${randomUUID()}`, ownerId: memberUserId },
        { id: foreignOrgId, name: "Verify Foreign Org", slug: `verify-foreign-${randomUUID()}`, ownerId: foreignUserId },
      ],
    });
    const project = await prisma.project.create({
      data: { name: "Verify Project", slug: `verify-${randomUUID()}`, organizationId: orgId },
      select: { id: true },
    });
    const kb = await prisma.knowledgeBase.create({
      data: { name: "Verify KB", projectId: project.id, retrievalConfig: {} },
      select: { id: true },
    });
    const rootDs = await prisma.benchmarkDataset.create({
      data: {
        name: `verify-root-${randomUUID()}`,
        knowledgeBaseId: kb.id,
        questions: { create: BASELINE_RECALL.map((_, i) => ({ question: `verify-q-${i}` })) },
      },
      include: { questions: true },
    });
    const version = await createBenchmarkDatasetVersion(rootDs.id);
    datasetIds.push(rootDs.id, version.id);

    const baseline = await prisma.benchmarkRun.create({
      data: { name: "verify baseline", status: "completed", configSnapshot: {}, datasetId: version.id },
      select: { id: true },
    });
    const candidate = await prisma.benchmarkRun.create({
      data: { name: "verify candidate", status: "completed", configSnapshot: {}, datasetId: version.id },
      select: { id: true },
    });
    runIds.push(baseline.id, candidate.id);

    await prisma.benchmarkResult.createMany({
      data: version.questions.map((q, i) => ({
        runId: baseline.id,
        questionId: q.id,
        retrievalMetrics: {
          recallAtK: BASELINE_RECALL[i],
          precisionAtK: BASELINE_RECALL[i],
          hitRate: BASELINE_RECALL[i],
          meanReciprocalRank: BASELINE_RECALL[i],
          ndcg: BASELINE_RECALL[i],
        },
        generationMetrics: {
          faithfulness: BASELINE_RECALL[i],
          contextPrecision: 0.5,
          contextRecall: 0.5,
          answerRelevancy: 0.4,
        },
        latencySearchMs: 400,
        totalLatencyMs: 700,
      })),
    });
    await prisma.benchmarkResult.createMany({
      data: version.questions.map((q, i) => ({
        runId: candidate.id,
        questionId: q.id,
        retrievalMetrics: {
          recallAtK: CANDIDATE_RECALL[i],
          precisionAtK: CANDIDATE_RECALL[i],
          hitRate: CANDIDATE_RECALL[i],
          meanReciprocalRank: CANDIDATE_RECALL[i],
          ndcg: CANDIDATE_RECALL[i],
        },
        generationMetrics: {
          faithfulness: CANDIDATE_RECALL[i],
          contextPrecision: 0.5,
          contextRecall: 0.5,
          answerRelevancy: 0.4,
        },
        latencySearchMs: 400,
        totalLatencyMs: 700,
      })),
    });

    // 1. Track the in-tenant comparison.
    const tracked = await trackRegressionComparison({ baselineRunId: baseline.id, candidateRunId: candidate.id }, orgId);
    assertCompatible(tracked.machine);
    assertMachineFinite(tracked.machine);
    if (tracked.record.datasetId !== version.id) throw new Error(`record dataset ${tracked.record.datasetId} != version ${version.id}`);
    if (tracked.record.overallVerdict !== "improvement") throw new Error(`expected improvement, got ${tracked.record.overallVerdict}`);

    // 2. Repeating the same pair is idempotent.
    const again = await trackRegressionComparison({ baselineRunId: baseline.id, candidateRunId: candidate.id }, orgId);
    if (again.record.id !== tracked.record.id) throw new Error("re-tracking created a second record");
    const count = await prisma.benchmarkRegression.count({ where: { baselineRunId: baseline.id, candidateRunId: candidate.id } });
    if (count !== 1) throw new Error(`expected 1 record, got ${count}`);

    // 3. A foreign organization cannot read this org's runs.
    await expectRunNotFound(() =>
      trackRegressionComparison({ baselineRunId: baseline.id, candidateRunId: candidate.id }, foreignOrgId),
    );

    // 4. The persisted comparison is readable through the org boundary and the
    //    quality gate passes under the configured policy.
    const policy = loadPolicy();
    const persisted = await getBenchmarkRegressionForOrg(tracked.record.id, orgId);
    if (!persisted) throw new Error("persisted regression not readable by the owning org");
    const gate = evaluateQualityGate(persisted.machine, policy);
    if (gate.outcome !== "PASS") {
      throw new Error(`expected quality gate PASS under ${policy.name}, got ${gate.outcome}: ${gate.reason ?? JSON.stringify(gate.errors)}`);
    }
    if (gate.blocked) throw new Error(`expected gate not blocked under ${policy.name}`);

    // 5. A foreign organization cannot read this org's persisted regression,
    //    and the gate outcome is deterministic over the same snapshot.
    const foreignRead = await getBenchmarkRegressionForOrg(tracked.record.id, foreignOrgId);
    if (foreignRead !== null) throw new Error("foreign org read the owning org's persisted regression");
    const gateAgain = evaluateQualityGate(persisted.machine, policy);
    if (JSON.stringify(gateAgain) !== JSON.stringify(gate)) throw new Error("quality gate outcome is not deterministic");

    // 6. A deliberately failing policy is blocked on the same persisted
    //    snapshot: proves the FAIL -> non-zero exit path headlessly.
    const failingPolicy: QualityGatePolicy = {
      version: 1,
      name: "verify-failing",
      onInsufficient: "block",
      onIncompatible: "block",
      metrics: [{ metric: "recallAtK", min: 0.99 }],
    };
    const gateFailing = evaluateQualityGate(persisted.machine, failingPolicy);
    if (gateFailing.outcome !== "FAIL") throw new Error(`expected FAIL under failing policy, got ${gateFailing.outcome}`);
    if (!gateFailing.blocked) throw new Error("expected failing gate to be blocked");

    const output = {
      ok: true,
      datasetVersionId: version.id,
      baselineRunId: baseline.id,
      candidateRunId: candidate.id,
      record: tracked.record,
      result: tracked.machine,
      qualityGate: { policy, gate },
    };
    writeFileSync("regression-tracking-result.json", JSON.stringify(output, null, 2));
    console.log(`REGRESSION-TRACKING-OK record=${tracked.record.id}`);
    console.log(`QUALITY-GATE-OK policy=${policy.name} outcome=${gate.outcome} blocked=false`);
    console.log(JSON.stringify(tracked.machine, null, 2));
  } catch (error) {
    console.error("REGRESSION-TRACKING-FAILED", error);
    process.exitCode = 1;
  } finally {
    await prisma.benchmarkRegression.deleteMany({ where: { OR: [{ baselineRunId: { in: runIds } }, { candidateRunId: { in: runIds } }] } });
    await prisma.benchmarkRun.deleteMany({ where: { id: { in: runIds } } });
    await prisma.benchmarkDataset.deleteMany({ where: { id: { in: datasetIds } } });
    await prisma.organization.deleteMany({ where: { OR: [{ id: orgId }, { id: foreignOrgId }] } });
    await prisma.user.deleteMany({ where: { OR: [{ id: memberUserId }, { id: foreignUserId }] } });
    await prisma.$disconnect();
  }
}

function assertCompatible(machine: MachineRegressionResult) {
  if (!machine.ok || machine.state !== "compatible") throw new Error(`expected compatible comparison, got ${machine.state}`);
  if (machine.error !== null) throw new Error(`unexpected error ${JSON.stringify(machine.error)}`);
  if (machine.metrics.length !== 11) throw new Error(`expected 11 metrics, got ${machine.metrics.length}`);
}

function assertMachineFinite(machine: MachineRegressionResult) {
  const json = JSON.stringify(machine);
  if (/NaN|Infinity|undefined/.test(json)) throw new Error("machine output contains non-finite values");
}

async function expectRunNotFound(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    if (error instanceof Error && error.message === "Run not found") return;
    throw new Error(`expected Run not found, got ${error}`);
  }
  throw new Error("foreign pair was not rejected");
}

void main();