import type { ParetoPoint, ParetoFrontier } from "./types";

export function generateParetoFrontier(
  runs: Array<{ id: string; config: Record<string, unknown>; metrics: Record<string, number> }>,
  objectives: string[]
): ParetoFrontier {
  if (objectives.length < 2) {
    throw new Error("Pareto frontier requires at least 2 objectives");
  }

  const points: ParetoPoint[] = runs.map((run) => ({
    id: run.id,
    config: run.config as Record<string, string | number | boolean>,
    objectives: Object.fromEntries(
      objectives.map((obj) => [obj, run.metrics[obj] ?? 0])
    ),
    isDominated: false,
    rank: 0,
  }));

  const dominanceMap = new Map<string, Set<string>>();

  for (const p of points) {
    dominanceMap.set(p.id, new Set());
  }

  for (let i = 0; i < points.length; i++) {
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;

      const pi = points[i];
      const pj = points[j];

      if (dominates(pi, pj)) {
        dominanceMap.get(pi.id)?.add(pj.id);
      } else if (dominates(pj, pi)) {
        dominanceMap.get(pj.id)?.add(pi.id);
      }
    }
  }

  for (const point of points) {
    const dominatedBy = Array.from(dominanceMap.entries())
      .filter(([_, dominators]) => dominators.has(point.id))
      .map(([id]) => id);

    if (dominatedBy.length > 0) {
      point.isDominated = true;
    }
  }

  const frontierPoints = points.filter((p) => !p.isDominated);

  assignRanks(points, objectives);

  return {
    points,
    frontierPoints,
    dimensions: objectives,
    dominatedCount: points.length - frontierPoints.length,
    frontierCount: frontierPoints.length,
  };
}

function dominates(a: ParetoPoint, b: ParetoPoint): boolean {
  let atLeastOneBetter = false;

  for (const key of Object.keys(a.objectives)) {
    const valA = a.objectives[key];
    const valB = b.objectives[key];

    if (valA < valB) return false;
    if (valA > valB) atLeastOneBetter = true;
  }

  return atLeastOneBetter;
}

function assignRanks(points: ParetoPoint[], objectives: string[]): void {
  const sorted = [...points].sort((a, b) => {
    for (const obj of objectives) {
      const diff = (b.objectives[obj] ?? 0) - (a.objectives[obj] ?? 0);
      if (Math.abs(diff) > 1e-10) return diff;
    }
    return 0;
  });

  let currentRank = 1;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1];
      const curr = sorted[i];
      let different = false;
      for (const obj of objectives) {
        if (Math.abs((prev.objectives[obj] ?? 0) - (curr.objectives[obj] ?? 0)) > 1e-10) {
          different = true;
          break;
        }
      }
      if (different) currentRank++;
    }
    const point = points.find((p) => p.id === sorted[i].id);
    if (point) point.rank = currentRank;
  }
}

export function findKneePoint(frontier: ParetoFrontier): ParetoPoint | null {
  if (frontier.frontierPoints.length === 0) return null;

  const dimensions = frontier.dimensions;
  if (dimensions.length !== 2) return null;

  const [dim1, dim2] = dimensions;

  const points = frontier.frontierPoints.map((p) => ({
    point: p,
    x: p.objectives[dim1] ?? 0,
    y: p.objectives[dim2] ?? 0,
  }));

  const minX = Math.min(...points.map((p) => p.x));
  const maxX = Math.max(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const maxY = Math.max(...points.map((p) => p.y));

  const rangeX = maxX - minX;
  const rangeY = maxY - minY;

  if (rangeX === 0 || rangeY === 0) return points[0].point;

  let maxDist = -1;
  let kneePoint = points[0].point;

  for (const p of points) {
    const nx = (p.x - minX) / rangeX;
    const ny = (p.y - minY) / rangeY;

    const dist = Math.abs(nx - ny) / Math.SQRT2;
    if (dist > maxDist) {
      maxDist = dist;
      kneePoint = p.point;
    }
  }

  return kneePoint;
}

export function computeHypervolume(frontier: ParetoFrontier, referencePoint: Record<string, number>): number {
  if (frontier.frontierPoints.length === 0) return 0;

  const dimensions = frontier.dimensions;
  if (dimensions.length === 2) {
    return computeHypervolume2D(frontier, referencePoint);
  }

  return computeHypervolumeApprox(frontier, referencePoint);
}

function computeHypervolume2D(frontier: ParetoFrontier, referencePoint: Record<string, number>): number {
  const [dim1, dim2] = frontier.dimensions;
  const refX = referencePoint[dim1] ?? 0;
  const refY = referencePoint[dim2] ?? 0;

  const sorted = [...frontier.frontierPoints]
    .map((p) => ({ x: p.objectives[dim1] ?? 0, y: p.objectives[dim2] ?? 0 }))
    .sort((a, b) => a.x - b.x);

  let volume = 0;
  let currentY = refY;

  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    const width = refX - p.x;
    const height = currentY - p.y;

    if (width > 0 && height > 0) {
      volume += width * height;
      currentY = p.y;
    }
  }

  return volume;
}

function computeHypervolumeApprox(frontier: ParetoFrontier, referencePoint: Record<string, number>): number {
  const samples = 1000;
  let dominated = 0;

  for (let i = 0; i < samples; i++) {
    const point: Record<string, number> = {};
    for (const dim of frontier.dimensions) {
      const ref = referencePoint[dim] ?? 1;
      point[dim] = Math.random() * ref;
    }

    const isDominated = frontier.frontierPoints.some((p) => {
      return frontier.dimensions.every((dim) => (p.objectives[dim] ?? 0) >= point[dim]);
    });

    if (isDominated) dominated++;
  }

  const totalVolume = Object.values(referencePoint).reduce((v, r) => v * r, 1);
  return (dominated / samples) * totalVolume;
}
