import type {
  ConfigurationSpace,
  CoverageAnalysis,
} from "./types";
import { configToKey, getExploredConfigs, generateAllCombinations } from "./config-space";

export function calculateCoverage(
  space: ConfigurationSpace,
  runs: Array<{ config: Record<string, unknown> }>
): CoverageAnalysis {
  const explored = getExploredConfigs(runs);
  const allCombinations = generateAllCombinations(space);

  const exploredCombinations = allCombinations.filter((combo) =>
    explored.has(configToKey(combo))
  );

  const coverageScore = space.totalCombinations > 0
    ? exploredCombinations.length / space.totalCombinations
    : 0;

  const dimensionCoverage = space.dimensions.map((dim) => {
    const exploredValues = new Set<string | number | boolean>();
    for (const run of runs) {
      const val = run.config[dim.name];
      if (val !== undefined && val !== null) {
        exploredValues.add(val as string | number | boolean);
      }
    }

    return {
      dimension: dim.name,
      exploredValues: exploredValues.size,
      totalValues: dim.values.length,
      coverage: dim.values.length > 0 ? exploredValues.size / dim.values.length : 0,
    };
  });

  const unexplored = allCombinations.filter((combo) =>
    !explored.has(configToKey(combo))
  );

  const unexploredSorted = unexplored.sort((a, b) => {
    const scoreA = calculateCombinationPotential(a, runs, space);
    const scoreB = calculateCombinationPotential(b, runs, space);
    return scoreB - scoreA;
  });

  return {
    totalCombinations: space.totalCombinations,
    exploredCombinations: exploredCombinations.length,
    coverageScore,
    dimensionCoverage,
    unexploredCombinations: unexploredSorted.slice(0, 20),
  };
}

function calculateCombinationPotential(
  config: Record<string, string | number | boolean>,
  runs: Array<{ config: Record<string, unknown> }>,
  space: ConfigurationSpace
): number {
  let potential = 0;

  for (const dim of space.dimensions) {
    const val = config[dim.name];
    if (val === undefined) continue;

    const countForValue = runs.filter((r) => r.config[dim.name] === val).length;
    const rarity = 1 / (1 + countForValue);
    potential += rarity;
  }

  return potential / space.dimensions.length;
}

export function identifyCoverageGaps(
  coverage: CoverageAnalysis,
  space: ConfigurationSpace,
  runs: Array<{ config: Record<string, unknown> }>
): Array<{
  dimension: string;
  gapType: "missing_value" | "sparse_region" | "unexplored_cluster";
  description: string;
  severity: "high" | "medium" | "low";
}> {
  const gaps: Array<{
    dimension: string;
    gapType: "missing_value" | "sparse_region" | "unexplored_cluster";
    description: string;
    severity: "high" | "medium" | "low";
  }> = [];

  for (const dimCov of coverage.dimensionCoverage) {
    const dim = space.dimensions.find((d) => d.name === dimCov.dimension);
    if (!dim) continue;

    if (dimCov.coverage < 0.5) {
      gaps.push({
        dimension: dimCov.dimension,
        gapType: "missing_value",
        description: `Only ${dimCov.exploredValues}/${dimCov.totalValues} values explored for ${dimCov.dimension}`,
        severity: dimCov.coverage < 0.25 ? "high" : "medium",
      });
    }

    if (dim.type === "numeric" && dim.values.length > 2) {
      const exploredNums = dim.values.filter((v) =>
        runs.some((r) => r.config[dimCov.dimension] === v)
      ).map(Number);

      if (exploredNums.length >= 2) {
        const sorted = [...exploredNums].sort((a, b) => a - b);
        const gaps_in_range: number[] = [];

        for (let i = 0; i < sorted.length - 1; i++) {
          const gap = sorted[i + 1] - sorted[i];
          if (gap > 1) {
            gaps_in_range.push(gap);
          }
        }

        if (gaps_in_range.length > 0) {
          gaps.push({
            dimension: dimCov.dimension,
            gapType: "sparse_region",
            description: `Gaps detected in numeric range for ${dimCov.dimension}`,
            severity: "medium",
          });
        }
      }
    }
  }

  if (coverage.coverageScore < 0.1) {
    gaps.push({
      dimension: "overall",
      gapType: "unexplored_cluster",
      description: `Overall coverage is only ${(coverage.coverageScore * 100).toFixed(1)}%`,
      severity: "high",
    });
  }

  return gaps;
}
