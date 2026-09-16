import { compareMetrics } from "./significance";
import { assertRunAccess } from "./access";
import { getBenchmarkRun } from "./benchmark";

export type RegressionVerdict = "regression" | "improvement" | "no_significant_change" | "insufficient";

export type RegressionMetricSource = "retrievalMetrics" | "generationMetrics" | "latency";

export interface RegressionMetricDef {
  key: string;
  label: string;
  higherIsBetter: boolean;
  source: RegressionMetricSource;
}

// The metrics the portal run path actually persists per case. Directionality
// follows the metric definitions (all quality scores higher-is-better; latency
// is lower-is-better), never a global "higher wins".
export const REGRESSION_METRICS: RegressionMetricDef[] = [
  { key: "recallAtK", label: "Recall@K", higherIsBetter: true, source: "retrievalMetrics" },
  { key: "precisionAtK", label: "Precision@K", higherIsBetter: true, source: "retrievalMetrics" },
  { key: "hitRate", label: "Hit Rate", higherIsBetter: true, source: "retrievalMetrics" },
  { key: "meanReciprocalRank", label: "MRR", higherIsBetter: true, source: "retrievalMetrics" },
  { key: "ndcg", label: "nDCG", higherIsBetter: true, source: "retrievalMetrics" },
  { key: "faithfulness", label: "Faithfulness", higherIsBetter: true, source: "generationMetrics" },
  { key: "contextPrecision", label: "Context Precision", higherIsBetter: true, source: "generationMetrics" },
  { key: "contextRecall", label: "Context Recall", higherIsBetter: true, source: "generationMetrics" },
  { key: "answerRelevancy", label: "Answer Relevancy", higherIsBetter: true, source: "generationMetrics" },
  { key: "latencySearchMs", label: "Latency (search)", higherIsBetter: false, source: "latency" },
  { key: "totalLatencyMs", label: "Latency (total)", higherIsBetter: false, source: "latency" },
];

// Structural shapes so the pure logic runs on plain persisted values in unit
// tests and on Prisma rows in the real path.
export interface MetricObservation {
  questionId: string;
  retrievalMetrics?: Record<string, number | null> | null;
  generationMetrics?: Record<string, number | null> | null;
  latencySearchMs?: number | null;
  totalLatencyMs?: number | null;
}

export interface ComparisonRun {
  id: string;
  name: string | null;
  status: string;
  datasetId: string;
  createdAt: Date | string;
  dataset: { id: string; name: string };
  results: MetricObservation[];
}

export function extractMetricValue(result: MetricObservation, def: RegressionMetricDef): number | null {
  let value: number | null | undefined;
  if (def.source === "latency") {
    value = def.key === "latencySearchMs" ? result.latencySearchMs : result.totalLatencyMs;
  } else {
    const bag = def.source === "retrievalMetrics" ? result.retrievalMetrics : result.generationMetrics;
    value = bag ? bag[def.key] : undefined;
  }
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function pairMetricSamples(
  baselineResults: MetricObservation[],
  candidateResults: MetricObservation[],
  def: RegressionMetricDef,
): { pairs: Array<[number, number]> } {
  const candidateByQuestion = new Map(candidateResults.map((r) => [r.questionId, r]));
  const pairs: Array<[number, number]> = [];
  for (const baseline of baselineResults) {
    const candidate = candidateByQuestion.get(baseline.questionId);
    if (!candidate) continue;
    const baselineValue = extractMetricValue(baseline, def);
    const candidateValue = extractMetricValue(candidate, def);
    if (baselineValue === null || candidateValue === null) continue;
    pairs.push([baselineValue, candidateValue]);
  }
  return { pairs };
}

export interface QuestionAlignment {
  shared: number;
  baselineOnly: number;
  candidateOnly: number;
}

export function questionAlignment(
  baselineResults: MetricObservation[],
  candidateResults: MetricObservation[],
): QuestionAlignment {
  const baselineIds = new Set(baselineResults.map((r) => r.questionId));
  const candidateIds = new Set(candidateResults.map((r) => r.questionId));
  let shared = 0;
  let baselineOnly = 0;
  for (const id of baselineIds) {
    if (candidateIds.has(id)) shared++;
    else baselineOnly++;
  }
  let candidateOnly = 0;
  for (const id of candidateIds) {
    if (!baselineIds.has(id)) candidateOnly++;
  }
  return { shared, baselineOnly, candidateOnly };
}

export type CompatibilityIssue =
  | { reason: "same_run" }
  | { reason: "run_not_completed"; status: string; run: "baseline" | "candidate" }
  | { reason: "different_datasets" };

export function checkCompatibility(baseline: ComparisonRun, candidate: ComparisonRun): CompatibilityIssue | null {
  if (baseline.id === candidate.id) return { reason: "same_run" };
  if (baseline.status !== "completed") return { reason: "run_not_completed", status: baseline.status, run: "baseline" };
  if (candidate.status !== "completed") return { reason: "run_not_completed", status: candidate.status, run: "candidate" };
  if (baseline.datasetId !== candidate.datasetId) return { reason: "different_datasets" };
  return null;
}

export interface MetricComparisonOutcome {
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
  verdict: RegressionVerdict;
}

// Statistical verdicts come from significance.ts; unacceptable shifts are never
// called significant. The regression verdict is the product read of the stats.
export function evaluateMetricComparison(
  baselineValues: number[],
  candidateValues: number[],
  def: RegressionMetricDef,
  labelA: string,
  labelB: string,
): MetricComparisonOutcome {
  if (baselineValues.length < 2) {
    return {
      key: def.key,
      label: def.label,
      higherIsBetter: def.higherIsBetter,
      pairedCount: baselineValues.length,
      baselineMean: null,
      candidateMean: null,
      delta: null,
      pValue: null,
      testUsed: null,
      effectSizeMagnitude: null,
      ciLower: null,
      ciUpper: null,
      interpretation: null,
      verdict: "insufficient",
    };
  }

  const result = compareMetrics(baselineValues, candidateValues, def.label, labelA, labelB);
  const delta = result.meanDifference;
  let verdict: RegressionVerdict = "no_significant_change";
  if (result.significance.significant) {
    if (delta === 0) {
      verdict = "no_significant_change";
    } else if (def.higherIsBetter) {
      verdict = delta > 0 ? "improvement" : "regression";
    } else {
      verdict = delta > 0 ? "regression" : "improvement";
    }
  }

  return {
    key: def.key,
    label: def.label,
    higherIsBetter: def.higherIsBetter,
    pairedCount: baselineValues.length,
    baselineMean: result.meanA,
    candidateMean: result.meanB,
    delta,
    pValue: result.significance.pValue,
    testUsed: result.significance.testUsed,
    effectSizeMagnitude: result.effectSize.magnitude,
    ciLower: result.bootstrapCI.ciLower,
    ciUpper: result.bootstrapCI.ciUpper,
    interpretation: result.interpretation,
    verdict,
  };
}

export interface OverallVerdict {
  verdict: RegressionVerdict | "mixed";
  regressed: number;
  improved: number;
  unchanged: number;
  insufficient: number;
}

// An honest signal summary, not winner-by-majority: regression dominates only
// when nothing improved and an improvement dominates only when nothing regressed.
export function summarizeVerdicts(outcomes: MetricComparisonOutcome[]): OverallVerdict {
  let regressed = 0;
  let improved = 0;
  let unchanged = 0;
  let insufficient = 0;
  for (const outcome of outcomes) {
    if (outcome.verdict === "regression") regressed++;
    else if (outcome.verdict === "improvement") improved++;
    else if (outcome.verdict === "no_significant_change") unchanged++;
    else insufficient++;
  }
  let verdict: OverallVerdict["verdict"];
  if (regressed + improved + unchanged === 0) verdict = "insufficient";
  else if (regressed > 0 && improved === 0) verdict = "regression";
  else if (improved > 0 && regressed === 0) verdict = "improvement";
  else if (regressed === 0 && improved === 0) verdict = "no_significant_change";
  else verdict = "mixed";
  return { verdict, regressed, improved, unchanged, insufficient };
}

export interface RunSummary {
  runId: string;
  name: string | null;
  status: string;
  datasetId: string;
  datasetName: string;
  createdAt: string;
  observationCount: number;
}

export interface RegressionComparisonResult {
  ok: boolean;
  error?: CompatibilityIssue;
  baseline: RunSummary;
  candidate: RunSummary;
  alignment: QuestionAlignment;
  metrics: MetricComparisonOutcome[];
  overall: OverallVerdict;
}

function runSummary(run: ComparisonRun): RunSummary {
  return {
    runId: run.id,
    name: run.name,
    status: run.status,
    datasetId: run.datasetId,
    datasetName: run.dataset?.name ?? "Unnamed dataset",
    createdAt: run.createdAt instanceof Date ? run.createdAt.toISOString() : String(run.createdAt),
    observationCount: run.results.length,
  };
}

export function buildRegressionComparison(
  baseline: ComparisonRun,
  candidate: ComparisonRun,
): RegressionComparisonResult {
  const error = checkCompatibility(baseline, candidate);
  const alignment = questionAlignment(baseline.results, candidate.results);

  if (error) {
    return {
      ok: false,
      error,
      baseline: runSummary(baseline),
      candidate: runSummary(candidate),
      alignment,
      metrics: [],
      overall: { verdict: "insufficient", regressed: 0, improved: 0, unchanged: 0, insufficient: 0 },
    };
  }

  const metrics = REGRESSION_METRICS.map((def) => {
    const { pairs } = pairMetricSamples(baseline.results, candidate.results, def);
    return evaluateMetricComparison(
      pairs.map(([a]) => a),
      pairs.map(([, b]) => b),
      def,
      baseline.name || "Baseline",
      candidate.name || "Candidate",
    );
  });

  return {
    ok: true,
    baseline: runSummary(baseline),
    candidate: runSummary(candidate),
    alignment,
    metrics,
    overall: summarizeVerdicts(metrics),
  };
}

// Session-scoped server entry point: both runs must resolve through the shared
// access boundary, and any foreign/fabricated/deleted id fails identically so
// the comparison cannot probe another tenant's run existence.
export async function compareRunsForUser(
  baselineRunId: string,
  candidateRunId: string,
  userId: string,
): Promise<RegressionComparisonResult> {
  try {
    await assertRunAccess(baselineRunId, userId);
  } catch {
    throw new Error("Run not found");
  }
  try {
    await assertRunAccess(candidateRunId, userId);
  } catch {
    throw new Error("Run not found");
  }
  const [baseline, candidate] = await Promise.all([getBenchmarkRun(baselineRunId), getBenchmarkRun(candidateRunId)]);
  if (!baseline || !candidate) throw new Error("Run not found");
  return buildRegressionComparison(baseline as unknown as ComparisonRun, candidate as unknown as ComparisonRun);
}