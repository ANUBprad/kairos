import { compareMetrics } from "../evaluation/significance";
import type { Evidence, BenchmarkRunData } from "./types";

const METRIC_LABELS: Record<string, string> = {
  avgRecallAtK: "Recall@K",
  avgPrecisionAtK: "Precision@K",
  avgMRR: "MRR",
  avgNDCG: "nDCG",
  avgHitRate: "Hit Rate",
  avgLatencyMs: "Latency",
  avgFaithfulness: "Faithfulness",
  avgAnswerRelevancy: "Answer Relevancy",
  avgContextPrecision: "Context Precision",
  avgContextRecall: "Context Recall",
  avgAnswerCorrectness: "Answer Correctness",
};

const CORE_METRICS = [
  "avgRecallAtK", "avgPrecisionAtK", "avgMRR", "avgNDCG", "avgHitRate",
];

export function generateEvidence(
  runs: BenchmarkRunData[],
  metricA: string,
  metricB: string,
  configA: string,
  configB: string,
): Evidence | null {
  const runA = runs.find((r) => (r.name ?? "Unnamed") === configA);
  const runB = runs.find((r) => (r.name ?? "Unnamed") === configB);

  if (!runA || !runB) return null;

  const perQueryA = extractPerQueryMetric(runA, metricA);
  const perQueryB = extractPerQueryMetric(runB, metricA);

  if (perQueryA.length < 2 || perQueryB.length < 2) return null;

  try {
    const result = compareMetrics(perQueryB, perQueryA, metricA, configB, configA);

    const metricKey = metricA.replace("avg", "").replace("AtK", "@K");
    const label = METRIC_LABELS[metricA] ?? metricKey;

    return {
      metric: label,
      configs: [configA, configB],
      pValue: result.significance.pValue,
      confidenceInterval: [result.bootstrapCI.ciLower, result.bootstrapCI.ciUpper],
      effectSize: result.effectSize.value,
      effectMagnitude: result.effectSize.magnitude,
      benchmarkIds: [runA.id, runB.id],
      reasoning: result.interpretation,
      improvement: result.meanDifference,
      improvementPct: result.meanA > 0 ? (result.meanDifference / result.meanA) * 100 : 0,
    };
  } catch {
    return null;
  }
}

export function generateAllPairwiseEvidence(
  runs: BenchmarkRunData[],
): Evidence[] {
  const evidence: Evidence[] = [];
  const configNames = runs.map((r) => r.name ?? "Unnamed");

  for (let i = 0; i < configNames.length; i++) {
    for (let j = i + 1; j < configNames.length; j++) {
      for (const metric of CORE_METRICS) {
        const ev = generateEvidence(runs, metric, metric, configNames[i], configNames[j]);
        if (ev) evidence.push(ev);
      }
    }
  }

  return evidence;
}

export function extractPerQueryMetric(run: BenchmarkRunData, metricKey: string): number[] {
  const values: number[] = [];
  const baseMetric = metricKey.replace("avg", "");

  for (const result of run.results) {
    const metrics = result.retrievalMetrics ?? {};
    const val = metrics[baseMetric] ?? metrics[metricKey];
    if (typeof val === "number") values.push(val);
  }

  if (values.length > 0) return values;

  if (run.aggregatedMetrics && typeof run.aggregatedMetrics[metricKey] === "number") {
    return [run.aggregatedMetrics[metricKey]];
  }

  return values;
}

export function getMetricValue(run: BenchmarkRunData, metric: string): number | null {
  if (run.aggregatedMetrics && typeof run.aggregatedMetrics[metric] === "number") {
    return run.aggregatedMetrics[metric];
  }
  return null;
}

export function getBestConfigForMetric(
  runs: BenchmarkRunData[],
  metric: string,
): { config: string; value: number } | null {
  let best: { config: string; value: number } | null = null;

  for (const run of runs) {
    const val = getMetricValue(run, metric);
    if (val !== null && (best === null || val > best.value)) {
      best = { config: run.name ?? "Unnamed", value: val };
    }
  }

  return best;
}

export function computeStatisticalPower(evidence: Evidence[]): number {
  if (evidence.length === 0) return 0;

  const significant = evidence.filter((e) => e.pValue < 0.05);
  const largeEffect = evidence.filter((e) => e.effectMagnitude === "large");
  const moderateEffect = evidence.filter((e) => e.effectMagnitude === "medium");

  const sigRatio = significant.length / evidence.length;
  const effectRatio = (largeEffect.length * 1.0 + moderateEffect.length * 0.5) / evidence.length;

  return Math.round((sigRatio * 0.6 + effectRatio * 0.4) * 100) / 100;
}

export function formatPValue(p: number): string {
  if (p < 0.001) return "p < 0.001";
  if (p < 0.01) return `p = ${p.toFixed(3)}`;
  return `p = ${p.toFixed(3)}`;
}

export function formatCI(ci: [number, number]): string {
  return `95% CI [${(ci[0] * 100).toFixed(1)}%, ${(ci[1] * 100).toFixed(1)}%]`;
}

export function formatEffectSize(d: number, magnitude: string): string {
  return `d = ${d.toFixed(2)} (${magnitude})`;
}

export function getMetricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key;
}
