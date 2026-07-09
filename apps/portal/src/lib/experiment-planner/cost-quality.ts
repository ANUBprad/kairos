import type {
  ExperimentRecommendation,
  ExperimentQueue,
} from "./types";

interface CostQualityInput {
  recommendations: ExperimentRecommendation[];
  budgetMs?: number;
  budgetTokens?: number;
  maxExperiments?: number;
  prioritizeQuality?: boolean;
}

export function planCostQuality(input: CostQualityInput): ExperimentQueue {
  const { recommendations, budgetMs, budgetTokens, maxExperiments = 10, prioritizeQuality = false } = input;

  const tradeoffs = recommendations.map((rec) => ({
    recommendation: rec,
    costPerImprovement: computeCostPerImprovement(rec),
    roi: computeROI(rec),
    efficiencyScore: computeEfficiencyScore(rec, prioritizeQuality),
  }));

  tradeoffs.sort((a, b) => b.efficiencyScore - a.efficiencyScore);

  const selected: ExperimentRecommendation[] = [];
  let totalCostMs = 0;
  let totalTokens = 0;

  for (const tradeoff of tradeoffs) {
    if (selected.length >= maxExperiments) break;

    const cost = tradeoff.recommendation.estimatedCost;
    const newCostMs = totalCostMs + cost.estimatedLatencyMs;
    const newTokens = totalTokens + cost.estimatedTokenCost;

    if (budgetMs && newCostMs > budgetMs) continue;
    if (budgetTokens && newTokens > budgetTokens) continue;

    selected.push(tradeoff.recommendation);
    totalCostMs = newCostMs;
    totalTokens = newTokens;
  }

  const totalEstimatedCost = selected.reduce(
    (s, r) => s + r.estimatedCost.estimatedTotalCost,
    0
  );

  const totalEstimatedTimeMs = selected.reduce(
    (s, r) => s + r.estimatedCost.estimatedLatencyMs,
    0
  );

  const expectedOverallImprovement = selected.reduce(
    (s, r) => s + r.expectedImprovement,
    0
  ) / (selected.length || 1);

  return {
    recommendations: selected,
    totalEstimatedCost,
    totalEstimatedTimeMs,
    expectedOverallImprovement,
  };
}

function computeCostPerImprovement(rec: ExperimentRecommendation): number {
  if (rec.expectedImprovement <= 0) return Infinity;
  return rec.estimatedCost.estimatedTotalCost / rec.expectedImprovement;
}

function computeROI(rec: ExperimentRecommendation): number {
  const cost = rec.estimatedCost.estimatedTotalCost;
  if (cost <= 0) return rec.expectedImprovement * 100;

  const improvement = rec.expectedImprovement;
  const confidence = rec.confidence;

  return (improvement * confidence) / cost;
}

function computeEfficiencyScore(
  rec: ExperimentRecommendation,
  prioritizeQuality: boolean
): number {
  const improvementScore = rec.expectedImprovement;
  const confidenceScore = rec.confidence;
  const costScore = 1 / (1 + rec.estimatedCost.estimatedTotalCost / 1000);
  const gainScore = rec.expectedInformationGain;

  if (prioritizeQuality) {
    return (
      improvementScore * 0.3 +
      confidenceScore * 0.3 +
      gainScore * 0.25 +
      costScore * 0.15
    );
  }

  return (
    improvementScore * 0.25 +
    confidenceScore * 0.2 +
    gainScore * 0.2 +
    costScore * 0.35
  );
}

export function estimateTotalCost(
  queue: ExperimentQueue
): {
  totalLatencyFormatted: string;
  totalTokensFormatted: string;
  totalCostFormatted: string;
  experimentsCount: number;
} {
  const totalMs = queue.totalEstimatedTimeMs;
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const seconds = Math.floor((totalMs % 60000) / 1000);

  let latencyFormatted: string;
  if (hours > 0) latencyFormatted = `${hours}h ${minutes}m`;
  else if (minutes > 0) latencyFormatted = `${minutes}m ${seconds}s`;
  else latencyFormatted = `${seconds}s`;

  const tokens = queue.recommendations.reduce(
    (s, r) => s + r.estimatedCost.estimatedTokenCost,
    0
  );

  return {
    totalLatencyFormatted: latencyFormatted,
    totalTokensFormatted: `${(tokens / 1000).toFixed(1)}K tokens`,
    totalCostFormatted: `$${(tokens * 0.000002).toFixed(4)}`,
    experimentsCount: queue.recommendations.length,
  };
}

export function optimizeQueueForBudget(
  recommendations: ExperimentRecommendation[],
  budgetMs: number,
  budgetTokens: number
): ExperimentQueue {
  const sorted = [...recommendations].sort((a, b) => {
    const roiA = computeROI(a);
    const roiB = computeROI(b);
    return roiB - roiA;
  });

  const selected: ExperimentRecommendation[] = [];
  let totalMs = 0;
  let totalTokens = 0;

  for (const rec of sorted) {
    const cost = rec.estimatedCost;
    if (totalMs + cost.estimatedLatencyMs <= budgetMs &&
        totalTokens + cost.estimatedTokenCost <= budgetTokens) {
      selected.push(rec);
      totalMs += cost.estimatedLatencyMs;
      totalTokens += cost.estimatedTokenCost;
    }
  }

  return {
    recommendations: selected,
    totalEstimatedCost: selected.reduce((s, r) => s + r.estimatedCost.estimatedTotalCost, 0),
    totalEstimatedTimeMs: totalMs,
    expectedOverallImprovement: selected.length > 0
      ? selected.reduce((s, r) => s + r.expectedImprovement, 0) / selected.length
      : 0,
  };
}
