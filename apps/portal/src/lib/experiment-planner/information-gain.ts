import type { InformationGainEstimate, ConfigurationDimension } from "./types";
import { configDistance } from "./config-space";

export function estimateInformationGain(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metrics: string[]
): InformationGainEstimate {
  const explorationGain = computeExplorationGain(target, runs, dimensions);
  const exploitationGain = computeExploitationGain(target, runs, dimensions, metrics);
  const uncertaintyReduction = computeUncertaintyReductionGain(target, runs, dimensions, metrics);

  const gains = [
    { type: "exploration" as const, gain: explorationGain },
    { type: "exploitation" as const, gain: exploitationGain },
    { type: "uncertainty_reduction" as const, gain: uncertaintyReduction },
  ];

  gains.sort((a, b) => b.gain - a.gain);
  const best = gains[0];

  const reasoning = generateReasoning(target, best.type, runs, dimensions);

  const affectedMetrics = identifyAffectedMetrics(target, runs, dimensions, metrics);

  return {
    config: target,
    expectedGain: best.gain,
    gainType: best.type,
    reasoning,
    affectedMetrics,
  };
}

function computeExplorationGain(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown> }>,
  dimensions: ConfigurationDimension[]
): number {
  if (runs.length === 0) return 1;

  let minDist = Infinity;
  for (const run of runs) {
    const dist = configDistance(
      target,
      run.config as Record<string, string | number | boolean>,
      dimensions
    );
    minDist = Math.min(minDist, dist);
  }

  const explorationGain = Math.min(1, minDist);

  let novelDimensions = 0;
  for (const dim of dimensions) {
    const val = target[dim.name];
    if (val === undefined) continue;

    const seen = runs.some((r) => r.config[dim.name] === val);
    if (!seen) novelDimensions++;
  }

  const noveltyBonus = dimensions.length > 0 ? novelDimensions / dimensions.length : 0;

  return Math.min(1, explorationGain * 0.7 + noveltyBonus * 0.3);
}

function computeExploitationGain(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metrics: string[]
): number {
  if (runs.length === 0) return 0.5;

  const neighbors = findClosestRuns(target, runs, dimensions, 3);

  let potentialImprovement = 0;

  for (const metric of metrics) {
    const promisingConfig = isPromisingConfig(target, runs, dimensions, metric);
    if (promisingConfig) {
      potentialImprovement += 0.3;
    }

    const interpolation = interpolateImprovement(target, neighbors, dimensions, metric);
    potentialImprovement += interpolation;
  }

  return Math.min(1, potentialImprovement / metrics.length);
}

function computeUncertaintyReductionGain(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics?: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  _metrics: string[]
): number {
  if (runs.length === 0) return 1;

  const runsWithMetrics = runs.map((r) => ({
    ...r,
    metrics: r.metrics ?? {},
  }));

  const neighbors = findClosestRuns(target, runsWithMetrics, dimensions, 5);

  let uncertainty = 0;
  for (const { distance } of neighbors) {
    uncertainty += distance;
  }
  uncertainty = neighbors.length > 0 ? uncertainty / neighbors.length : 1;

  return Math.min(1, uncertainty);
}

function findClosestRuns(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  k: number
): Array<{ run: typeof runs[0]; distance: number }> {
  const distances = runs.map((run) => ({
    run,
    distance: configDistance(
      target,
      run.config as Record<string, string | number | boolean>,
      dimensions
    ),
  }));

  distances.sort((a, b) => a.distance - b.distance);
  return distances.slice(0, k);
}

function isPromisingConfig(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metric: string
): boolean {
  const neighbors = findClosestRuns(target, runs, dimensions, 3);
  if (neighbors.length < 2) return false;

  const values = neighbors.map((n) => n.run.metrics[metric] ?? 0);
  const trend = values[values.length - 1] - values[0];

  return trend > 0;
}

function interpolateImprovement(
  target: Record<string, string | number | boolean>,
  neighbors: Array<{ run: { config: Record<string, unknown>; metrics: Record<string, number> }; distance: number }>,
  dimensions: ConfigurationDimension[],
  metric: string
): number {
  if (neighbors.length === 0) return 0;

  let weightedSum = 0;
  let weightSum = 0;

  for (const { run, distance } of neighbors) {
    const weight = 1 / (1 + distance);
    weightedSum += (run.metrics[metric] ?? 0) * weight;
    weightSum += weight;
  }

  const predicted = weightSum > 0 ? weightedSum / weightSum : 0;
  return Math.min(1, Math.max(0, predicted));
}

function generateReasoning(
  target: Record<string, string | number | boolean>,
  gainType: "exploration" | "exploitation" | "uncertainty_reduction",
  runs: Array<{ config: Record<string, unknown> }>,
  dimensions: ConfigurationDimension[]
): string {
  const novelDims: string[] = [];
  for (const dim of dimensions) {
    const val = target[dim.name];
    if (val === undefined) continue;
    const seen = runs.some((r) => r.config[dim.name] === val);
    if (!seen) novelDims.push(`${dim.name}=${String(val)}`);
  }

  switch (gainType) {
    case "exploration":
      return novelDims.length > 0
        ? `Explores untested values: ${novelDims.join(", ")}`
        : `Explores a new region of the configuration space`;
    case "exploitation":
      return `Builds on promising trends from nearby experiments`;
    case "uncertainty_reduction":
      return `Reduces uncertainty by sampling an under-explored area`;
  }
}

function identifyAffectedMetrics(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metrics: string[]
): string[] {
  if (runs.length === 0) return metrics;

  const affected: string[] = [];

  for (const metric of metrics) {
    const neighbors = findClosestRuns(target, runs, dimensions, 3);
    if (neighbors.length < 2) {
      affected.push(metric);
      continue;
    }

    const values = neighbors.map((n) => n.run.metrics[metric] ?? 0);
    const variance = computeVariance(values);

    if (variance > 0.01) {
      affected.push(metric);
    }
  }

  return affected.length > 0 ? affected : metrics.slice(0, 2);
}

function computeVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

export function rankByInformationGain(
  candidates: Array<Record<string, string | number | boolean>>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metrics: string[]
): InformationGainEstimate[] {
  const estimates = candidates.map((config) =>
    estimateInformationGain(config, runs, dimensions, metrics)
  );

  estimates.sort((a, b) => b.expectedGain - a.expectedGain);
  return estimates;
}
