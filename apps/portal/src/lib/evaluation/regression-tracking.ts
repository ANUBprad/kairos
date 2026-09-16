import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  buildRegressionComparison,
  type ComparisonRun,
  type RegressionComparisonResult,
} from "./regression";

export interface RegressionTrackingInput {
  baselineRunId: string;
  candidateRunId: string;
}

export type MachineRegressionState = "compatible" | "incompatible" | "insufficient";

export interface MachineRegressionRunSummary {
  runId: string;
  name: string | null;
  status: string;
  datasetId: string;
  datasetName: string;
  createdAt: string;
  observationCount: number;
}

export interface MachineRegressionMetric {
  key: string;
  label: string;
  higherIsBetter: boolean;
  pairedCount: number;
  baselineMean: number | null;
  candidateMean: number | null;
  delta: number | null;
  pValue: number | null;
  testUsed: string | null;
  effectSizeMagnitude: string | null;
  ciLower: number | null;
  ciUpper: number | null;
  interpretation: string | null;
  verdict: string;
}

// Deterministic machine-readable snapshot of a regression comparison. It is a
// pure function of the Slice B engine output: stable field set and metric
// order, no timestamps, and non-finite statistics become explicit nulls so the
// serialized form is always valid JSON without NaN/Infinity.
export interface MachineRegressionResult {
  ok: boolean;
  state: MachineRegressionState;
  error: { reason: string; status?: string; run?: "baseline" | "candidate" } | null;
  baseline: MachineRegressionRunSummary;
  candidate: MachineRegressionRunSummary;
  alignment: { shared: number; baselineOnly: number; candidateOnly: number };
  overall: { verdict: string; regressed: number; improved: number; unchanged: number; insufficient: number };
  metrics: MachineRegressionMetric[];
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function serializeRegressionComparison(result: RegressionComparisonResult): MachineRegressionResult {
  const state: MachineRegressionState = result.ok
    ? result.overall.verdict === "insufficient"
      ? "insufficient"
      : "compatible"
    : "incompatible";

  const error =
    result.error?.reason === "run_not_completed"
      ? { reason: result.error.reason, status: result.error.status, run: result.error.run }
      : result.error
        ? { reason: result.error.reason }
        : null;

  return {
    ok: result.ok,
    state,
    error,
    baseline: { ...result.baseline },
    candidate: { ...result.candidate },
    alignment: { ...result.alignment },
    overall: { ...result.overall },
    metrics: result.metrics.map((m) => ({
      key: m.key,
      label: m.label,
      higherIsBetter: m.higherIsBetter,
      pairedCount: m.pairedCount,
      baselineMean: finiteOrNull(m.baselineMean),
      candidateMean: finiteOrNull(m.candidateMean),
      delta: finiteOrNull(m.delta),
      pValue: finiteOrNull(m.pValue),
      testUsed: m.testUsed,
      effectSizeMagnitude: m.effectSizeMagnitude,
      ciLower: finiteOrNull(m.ciLower),
      ciUpper: finiteOrNull(m.ciUpper),
      interpretation: m.interpretation,
      verdict: m.verdict,
    })),
  };
}

// Runs anchored to a knowledge base are scoped to the API key's organization;
// standalone datasets (no knowledge base) remain global, matching the shared
// access boundary. Foreign, fabricated, and deleted ids resolve identically,
// so the API cannot probe another tenant's run existence.
function regressionRunWhere(runId: string, organizationId: string) {
  return {
    id: runId,
    dataset: {
      OR: [{ knowledgeBaseId: null }, { knowledgeBase: { project: { organizationId } } }],
    },
  };
}

async function resolveRegressionRun(runId: string, organizationId: string) {
  return prisma.benchmarkRun.findFirst({
    where: regressionRunWhere(runId, organizationId),
    include: {
      dataset: { select: { id: true, name: true } },
      results: {
        select: {
          questionId: true,
          retrievalMetrics: true,
          generationMetrics: true,
          latencySearchMs: true,
          totalLatencyMs: true,
        },
      },
    },
  });
}

export interface TrackedRegression {
  record: {
    id: string;
    baselineRunId: string;
    candidateRunId: string;
    datasetId: string;
    overallVerdict: string;
    comparedAt: string;
    createdAt: string;
    updatedAt: string;
  };
  result: RegressionComparisonResult;
  machine: MachineRegressionResult;
}

// Entry point used by automation (API route and CI). The ordered pair is the
// identity of the tracking record: repeating the same pair recomputes and
// overwrites the single row, so CI retries never stack duplicates. A reversed
// pair is a distinct comparison in the opposite direction.
export async function trackRegressionComparison(
  input: RegressionTrackingInput,
  organizationId: string,
): Promise<TrackedRegression> {
  const { baselineRunId, candidateRunId } = input;

  const [baseline, candidate] = await Promise.all([
    resolveRegressionRun(baselineRunId, organizationId),
    resolveRegressionRun(candidateRunId, organizationId),
  ]);
  if (!baseline || !candidate) throw new Error("Run not found");

  const result = buildRegressionComparison(
    baseline as unknown as ComparisonRun,
    candidate as unknown as ComparisonRun,
  );
  const machine = serializeRegressionComparison(result);
  const overallVerdict = result.ok ? result.overall.verdict : "incompatible";

  const row = await prisma.benchmarkRegression.upsert({
    where: { baselineRunId_candidateRunId: { baselineRunId, candidateRunId } },
    create: {
      baselineRunId,
      candidateRunId,
      datasetId: baseline.datasetId,
      overallVerdict,
      result: machine as unknown as Prisma.InputJsonObject,
    },
    update: {
      datasetId: baseline.datasetId,
      overallVerdict,
      result: machine as unknown as Prisma.InputJsonObject,
    },
  });

  return {
    record: {
      id: row.id,
      baselineRunId: row.baselineRunId,
      candidateRunId: row.candidateRunId,
      datasetId: row.datasetId,
      overallVerdict: row.overallVerdict,
      comparedAt: row.updatedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    },
    result,
    machine,
  };
}