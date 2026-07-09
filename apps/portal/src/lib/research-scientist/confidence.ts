import type { BenchmarkRunData, Finding, Threat, Evidence } from "./types";

interface ConfidenceFactors {
  benchmarkCount: number;
  statisticalSignificance: number;
  confidenceIntervals: number;
  effectSizes: number;
  reproducibility: number;
  metricConsistency: number;
  experimentCoverage: number;
}

export function computeResearchConfidence(
  runs: BenchmarkRunData[],
  findings: Finding[],
  threats: Threat[],
  allEvidence: Evidence[],
): number {
  const factors = computeConfidenceFactors(runs, findings, threats, allEvidence);

  const weights = {
    benchmarkCount: 0.15,
    statisticalSignificance: 0.25,
    confidenceIntervals: 0.15,
    effectSizes: 0.15,
    reproducibility: 0.10,
    metricConsistency: 0.10,
    experimentCoverage: 0.10,
  };

  const score =
    factors.benchmarkCount * weights.benchmarkCount +
    factors.statisticalSignificance * weights.statisticalSignificance +
    factors.confidenceIntervals * weights.confidenceIntervals +
    factors.effectSizes * weights.effectSizes +
    factors.reproducibility * weights.reproducibility +
    factors.metricConsistency * weights.metricConsistency +
    factors.experimentCoverage * weights.experimentCoverage;

  return Math.round(Math.min(1, Math.max(0, score)) * 100) / 100;
}

function computeConfidenceFactors(
  runs: BenchmarkRunData[],
  findings: Finding[],
  threats: Threat[],
  allEvidence: Evidence[],
): ConfidenceFactors {
  const benchmarkCount = normalizeBenchmarkCount(runs.length);
  const statisticalSignificance = computeSignificanceScore(allEvidence);
  const confidenceIntervals = computeCIScore(allEvidence);
  const effectSizes = computeEffectSizeScore(allEvidence);
  const reproducibility = computeReproducibilityScore(runs);
  const metricConsistency = computeMetricConsistencyScore(findings);
  const experimentCoverage = computeExperimentCoverageScore(threats);

  return {
    benchmarkCount,
    statisticalSignificance,
    confidenceIntervals,
    effectSizes,
    reproducibility,
    metricConsistency,
    experimentCoverage,
  };
}

function normalizeBenchmarkCount(count: number): number {
  if (count >= 20) return 1.0;
  if (count >= 10) return 0.9;
  if (count >= 5) return 0.7;
  if (count >= 3) return 0.5;
  if (count >= 2) return 0.3;
  return 0.1;
}

function computeSignificanceScore(evidence: Evidence[]): number {
  if (evidence.length === 0) return 0.5;

  const significant = evidence.filter((e) => e.pValue < 0.05);
  const ratio = significant.length / evidence.length;

  const avgSig = significant.length > 0
    ? significant.reduce((s, e) => s + (1 - e.pValue), 0) / significant.length
    : 0;

  return Math.min(1, ratio * 0.6 + avgSig * 0.4);
}

function computeCIScore(evidence: Evidence[]): number {
  if (evidence.length === 0) return 0.5;

  const narrowCI = evidence.filter((e) => {
    const width = e.confidenceInterval[1] - e.confidenceInterval[0];
    return width < 0.1;
  });

  return Math.min(1, narrowCI.length / Math.max(evidence.length, 1));
}

function computeEffectSizeScore(evidence: Evidence[]): number {
  if (evidence.length === 0) return 0.5;

  const large = evidence.filter((e) => e.effectMagnitude === "large").length;
  const moderate = evidence.filter((e) => e.effectMagnitude === "medium").length;

  return Math.min(1, (large * 1.0 + moderate * 0.5) / Math.max(evidence.length, 1));
}

function computeReproducibilityScore(runs: BenchmarkRunData[]): number {
  if (runs.length < 2) return 0.3;

  const sameDataset = new Set(runs.map((r) => r.datasetName)).size === 1;
  const hasPerQuery = runs.some((r) => r.results.length > 5);

  let score = 0.5;
  if (sameDataset) score += 0.2;
  if (hasPerQuery) score += 0.3;

  return Math.min(1, score);
}

function computeMetricConsistencyScore(findings: Finding[]): number {
  if (findings.length === 0) return 0.5;

  const tradeoffs = findings.filter((f) => f.category === "tradeoff");
  const anomalies = findings.filter((f) => f.category === "anomaly");

  let score = 0.8;
  score -= tradeoffs.length * 0.1;
  score -= anomalies.length * 0.05;

  return Math.max(0.2, Math.min(1, score));
}

function computeExperimentCoverageScore(threats: Threat[]): number {
  const highThreats = threats.filter((t) => t.impact === "high");
  const medThreats = threats.filter((t) => t.impact === "medium");

  let score = 1.0;
  score -= highThreats.length * 0.15;
  score -= medThreats.length * 0.05;

  return Math.max(0.2, Math.min(1, score));
}

export function getConfidenceLabel(score: number): string {
  if (score >= 0.9) return "Very High";
  if (score >= 0.8) return "High";
  if (score >= 0.6) return "Moderate";
  if (score >= 0.4) return "Low";
  return "Very Low";
}

export function getConfidenceColor(score: number): string {
  if (score >= 0.8) return "text-emerald-500";
  if (score >= 0.6) return "text-yellow-500";
  if (score >= 0.4) return "text-orange-500";
  return "text-red-500";
}
