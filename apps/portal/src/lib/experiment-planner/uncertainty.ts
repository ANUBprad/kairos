import type {
  ConfigurationDimension,
  UncertaintyEstimate,
} from "./types";
import { configDistance } from "./config-space";

export function estimateUncertainty(
  target: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metric: string
): UncertaintyEstimate {
  const neighbors = findNeighbors(target, runs, dimensions, 5);

  if (neighbors.length === 0) {
    return {
      config: target,
      metric,
      predictedValue: 0,
      uncertainty: 1,
      confidenceInterval: [-1, 1],
      nearbyExperiments: 0,
      distanceToNearest: Infinity,
    };
  }

  let weightedSum = 0;
  let weightSum = 0;

  for (const { run, distance } of neighbors) {
    const weight = 1 / (1 + distance);
    const value = run.metrics[metric] ?? 0;
    weightedSum += value * weight;
    weightSum += weight;
  }

  const predictedValue = weightSum > 0 ? weightedSum / weightSum : 0;

  let varianceSum = 0;
  for (const { run, distance } of neighbors) {
    const weight = 1 / (1 + distance);
    const value = run.metrics[metric] ?? 0;
    varianceSum += weight * (value - predictedValue) ** 2;
  }

  const uncertainty = weightSum > 0
    ? Math.sqrt(varianceSum / weightSum)
    : 1;

  const ciWidth = 1.96 * uncertainty;

  return {
    config: target,
    metric,
    predictedValue,
    uncertainty,
    confidenceInterval: [
      Math.max(0, predictedValue - ciWidth),
      Math.min(1, predictedValue + ciWidth),
    ],
    nearbyExperiments: neighbors.length,
    distanceToNearest: neighbors[0]?.distance ?? Infinity,
  };
}

function findNeighbors(
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

export function estimateUncertainties(
  configs: Array<Record<string, string | number | boolean>>,
  runs: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metrics: string[]
): UncertaintyEstimate[] {
  const uncertainties: UncertaintyEstimate[] = [];

  for (const config of configs) {
    for (const metric of metrics) {
      uncertainties.push(estimateUncertainty(config, runs, dimensions, metric));
    }
  }

  return uncertainties;
}

export function computeUncertaintyReduction(
  target: Record<string, string | number | boolean>,
  currentRuns: Array<{ config: Record<string, unknown>; metrics: Record<string, number> }>,
  dimensions: ConfigurationDimension[],
  metrics: string[]
): {
  currentUncertainty: number;
  projectedUncertainty: number;
  reduction: number;
  reductionPct: number;
} {
  let currentTotal = 0;
  let projectedTotal = 0;

  for (const metric of metrics) {
    const current = estimateUncertainty(target, currentRuns, dimensions, metric);
    currentTotal += current.uncertainty;

    const projectedRuns = [
      ...currentRuns,
      {
        config: target,
        metrics: {},
        id: "projected",
        timestamp: new Date().toISOString(),
      },
    ];
    const projected = estimateUncertainty(target, projectedRuns, dimensions, metric);
    projectedTotal += projected.uncertainty;
  }

  const currentUncertainty = metrics.length > 0 ? currentTotal / metrics.length : 0;
  const projectedUncertainty = metrics.length > 0 ? projectedTotal / metrics.length : 0;
  const reduction = currentUncertainty - projectedUncertainty;
  const reductionPct = currentUncertainty > 0 ? (reduction / currentUncertainty) * 100 : 0;

  return {
    currentUncertainty,
    projectedUncertainty,
    reduction,
    reductionPct,
  };
}
