import type { ExperimentRecommendation, ExperimentCostEstimate, ConfigurationDimension } from "./types";
import { estimateUncertainty, computeUncertaintyReduction } from "./uncertainty";
import { estimateInformationGain } from "./information-gain";

interface PrioritizationInput {
  candidates: Array<Record<string, string | number | boolean>>;
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number>; costMs?: number }>;
  dimensions: ConfigurationDimension[];
  metrics: string[];
  objectives: string[];
  budgetMs?: number;
  budgetTokens?: number;
}

export function prioritizeExperiments(input: PrioritizationInput): ExperimentRecommendation[] {
  const { candidates, runs, dimensions, metrics, objectives, budgetMs, budgetTokens } = input;

  const recommendations: ExperimentRecommendation[] = [];

  for (let i = 0; i < candidates.length; i++) {
    const config = candidates[i];

    const improvement = estimateExpectedImprovement(config, runs, dimensions, metrics);
    const infoGain = estimateInformationGain(config, runs, dimensions, metrics);
    const cost = estimateExperimentCost(config, runs, dimensions);
    const uncertaintyReduction = computeUncertaintyReduction(config, runs, dimensions, metrics);

    const withinBudget = checkBudget(cost, budgetMs, budgetTokens);
    if (!withinBudget) continue;

    const paretoOptimal = checkParetoOptimality(config, runs, objectives);

    const confidence = computeConfidence(config, runs, dimensions, infoGain, uncertaintyReduction);

    const priority = determinePriority(improvement, confidence, infoGain.expectedGain, paretoOptimal);

    const statisticalBasis = generateStatisticalBasis(config, runs, dimensions, metrics);

    const rationale = generateRationale(config, improvement, infoGain, paretoOptimal, confidence);

    recommendations.push({
      id: `rec-${i}`,
      rank: 0,
      config,
      expectedImprovement: improvement,
      confidence,
      statisticalBasis,
      expectedInformationGain: infoGain.expectedGain,
      estimatedCost: cost,
      priority,
      rationale,
      affectedMetrics: infoGain.affectedMetrics,
      paretoOptimal,
    });
  }

  recommendations.sort((a, b) => {
    const scoreA = a.expectedImprovement * a.confidence + a.expectedInformationGain * 0.3;
    const scoreB = b.expectedImprovement * b.confidence + b.expectedInformationGain * 0.3;
    return scoreB - scoreA;
  });

  recommendations.forEach((rec, i) => {
    rec.rank = i + 1;
  });

  return recommendations.slice(0, 20);
}

function estimateExpectedImprovement(
  config: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metrics: string[]
): number {
  if (runs.length === 0) return 0.5;

  let maxMetric = "";
  let maxMean = 0;

  for (const metric of metrics) {
    const values = runs.map((r) => r.metrics[metric] ?? 0);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    if (mean > maxMean) {
      maxMean = mean;
      maxMetric = metric;
    }
  }

  if (!maxMetric) return 0.5;

  const uncertainty = estimateUncertainty(config, runs, dimensions, maxMetric);

  const neighbors = findNeighbors(config, runs, dimensions, 3);
  const neighborValues = neighbors.map((n) => n.run.metrics[maxMetric] ?? 0);
  const maxNeighbor = Math.max(...neighborValues);

  const improvement = uncertainty.predictedValue - maxNeighbor;
  const normalizedImprovement = Math.max(0, Math.min(1, improvement + 0.5));

  return normalizedImprovement;
}

function findNeighbors(
  config: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  k: number
): Array<{ run: typeof runs[0]; distance: number }> {
  const distances = runs.map((run) => ({
    run,
    distance: computeDistance(config, run.config as Record<string, string | number | boolean>, dimensions),
  }));

  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, k);
}

function computeDistance(
  a: Record<string, string | number | boolean>,
  b: Record<string, string | number | boolean>,
  dimensions: ConfigurationDimension[]
): number {
  let sumSq = 0;
  let count = 0;

  for (const dim of dimensions) {
    const valA = a[dim.name];
    const valB = b[dim.name];

    if (valA === undefined || valB === undefined) continue;

    if (dim.type === "numeric" && typeof valA === "number" && typeof valB === "number") {
      const range = Math.max(...dim.values.map(Number)) - Math.min(...dim.values.map(Number));
      const norm = range > 0 ? (valA - valB) / range : 0;
      sumSq += norm * norm;
    } else {
      sumSq += valA === valB ? 0 : 1;
    }
    count++;
  }

  return count > 0 ? Math.sqrt(sumSq / count) : 0;
}

function estimateExperimentCost(
  config: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; costMs?: number }>,
  dimensions: ConfigurationDimension[]
): ExperimentCostEstimate {
  let baseLatency = 1000;
  let baseTokens = 1000;

  if (config.topK && typeof config.topK === "number") {
    baseLatency += config.topK * 100;
    baseTokens += config.topK * 200;
  }

  if (config.reranker && config.reranker !== "none") {
    baseLatency += 500;
    baseTokens += 500;
  }

  if (config.chunkSize && typeof config.chunkSize === "number") {
    baseTokens = Math.floor(baseTokens * (config.chunkSize / 512));
  }

  const similarRuns = runs.filter((r) => {
    let similarCount = 0;
    for (const dim of dimensions) {
      if (r.config[dim.name] === config[dim.name]) similarCount++;
    }
    return similarCount >= dimensions.length * 0.7;
  });

  if (similarRuns.length > 0) {
    const avgCost = similarRuns.reduce((s, r) => s + (r.costMs ?? baseLatency), 0) / similarRuns.length;
    baseLatency = avgCost;
  }

  const costFactors = [];
  if (config.topK && typeof config.topK === "number") {
    costFactors.push({ factor: `topK=${config.topK}`, contribution: config.topK * 100 });
  }
  if (config.reranker && config.reranker !== "none") {
    costFactors.push({ factor: "reranking", contribution: 500 });
  }
  costFactors.push({ factor: "base", contribution: baseLatency - costFactors.reduce((s, f) => s + f.contribution, 0) });

  return {
    config,
    estimatedLatencyMs: baseLatency,
    estimatedTokenCost: baseTokens,
    estimatedTotalCost: baseLatency + baseTokens * 0.001,
    costFactors,
  };
}

function checkBudget(
  cost: ExperimentCostEstimate,
  budgetMs?: number,
  budgetTokens?: number
): boolean {
  if (budgetMs && cost.estimatedLatencyMs > budgetMs) return false;
  if (budgetTokens && cost.estimatedTokenCost > budgetTokens) return false;
  return true;
}

function checkParetoOptimality(
  config: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  objectives: string[]
): boolean {
  if (runs.length === 0 || objectives.length < 2) return false;

  const configObj: Record<string, number> = {};
  for (const obj of objectives) {
    configObj[obj] = estimateMetricForConfig(config, runs, obj);
  }

  for (const run of runs) {
    let dominated = true;
    let strictlyBetter = false;

    for (const obj of objectives) {
      const runVal = run.metrics[obj] ?? 0;
      const configVal = configObj[obj] ?? 0;

      if (runVal < configVal) {
        dominated = false;
        break;
      }
      if (runVal > configVal) strictlyBetter = true;
    }

    if (dominated && strictlyBetter) return false;
  }

  return true;
}

function estimateMetricForConfig(
  config: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  metric: string
): number {
  if (runs.length === 0) return 0;

  let weightedSum = 0;
  let weightSum = 0;

  for (const run of runs) {
    const dist = computeDistance(config, run.config as Record<string, string | number | boolean>, []);
    const weight = 1 / (1 + dist);
    weightedSum += (run.metrics[metric] ?? 0) * weight;
    weightSum += weight;
  }

  return weightSum > 0 ? weightedSum / weightSum : 0;
}

function computeConfidence(
  config: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  infoGain: { expectedGain: number },
  uncertaintyReduction: { reduction: number }
): number {
  if (runs.length === 0) return 0.3;

  let confidence = 0.5;

  const neighbors = findNeighbors(config, runs, dimensions, 3);
  if (neighbors.length >= 3) {
    confidence += 0.2;
  }

  confidence += infoGain.expectedGain * 0.2;

  confidence += Math.min(0.1, uncertaintyReduction.reduction);

  return Math.min(1, confidence);
}

function determinePriority(
  improvement: number,
  confidence: number,
  infoGain: number,
  paretoOptimal: boolean
): "high" | "medium" | "low" {
  const score = improvement * 0.4 + confidence * 0.3 + infoGain * 0.2 + (paretoOptimal ? 0.1 : 0);

  if (score > 0.7) return "high";
  if (score > 0.4) return "medium";
  return "low";
}

function generateStatisticalBasis(
  config: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  _metrics: string[]
): string {
  if (runs.length === 0) return "No prior experiments for comparison";

  const neighbors = findNeighbors(config, runs, dimensions, 3);

  if (neighbors.length === 0) return "No similar experiments found";

  const neighborConfigs = neighbors.map((n) => {
    const parts: string[] = [];
    for (const dim of dimensions) {
      const val = n.run.config[dim.name];
      if (val !== undefined) parts.push(`${dim.name}=${String(val)}`);
    }
    return parts.join(", ");
  });

  return `Based on ${neighbors.length} nearest neighbors: ${neighborConfigs.join("; ")}`;
}

function generateRationale(
  config: Record<string, string | number | boolean>,
  improvement: number,
  infoGain: { gainType: string; reasoning: string },
  paretoOptimal: boolean,
  confidence: number
): string {
  const parts: string[] = [];

  if (improvement > 0.3) {
    parts.push(`Expected ${(improvement * 100).toFixed(1)}% improvement`);
  }

  parts.push(infoGain.reasoning);

  if (paretoOptimal) {
    parts.push("Pareto-optimal configuration");
  }

  if (confidence > 0.7) {
    parts.push("High confidence prediction");
  }

  return parts.join(". ");
}
