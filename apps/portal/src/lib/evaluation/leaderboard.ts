import { compareMetrics, groupEquivalentConfigurations } from "./significance";
import type { ScientificLeaderboardEntry, LeaderboardTier } from "./types";

export interface LeaderboardEntry {
  rank: number;
  label: string;
  recallAtK: number;
  precisionAtK: number;
  hitRate: number;
  mrr: number;
  ndcg: number;
  faithfulness?: number;
  latencyMs: number;
  overallScore: number;
  isBest: boolean;
}

export function computeOverallScore(
  recall: number,
  precision: number,
  hitRate: number,
  mrr: number,
  ndcg: number,
  latencyMs: number,
  faithfulness?: number,
): number {
  const retrievalScore = (recall + precision + hitRate + mrr + ndcg) / 5;
  const genScore = faithfulness != null ? faithfulness : 0.5;
  const latencyPenalty = Math.min(1, latencyMs / 5000);
  const baseScore = retrievalScore * 0.5 + genScore * 0.3 + (1 - latencyPenalty) * 0.2;
  return Math.round(baseScore * 10000) / 100;
}

export function generateLeaderboard(
  entries: Array<{
    label: string;
    aggregatedMetrics: Record<string, number> | null;
  }>,
): LeaderboardEntry[] {
  const scored = entries.map((e) => {
    const m = e.aggregatedMetrics || {};
    const overallScore = computeOverallScore(
      m.avgRecallAtK ?? 0,
      m.avgPrecisionAtK ?? 0,
      m.avgHitRate ?? 0,
      m.avgMRR ?? 0,
      m.avgNDCG ?? 0,
      m.avgLatencyMs ?? 9999,
      m.avgFaithfulness,
    );
    return {
      label: e.label,
      recallAtK: m.avgRecallAtK ?? 0,
      precisionAtK: m.avgPrecisionAtK ?? 0,
      hitRate: m.avgHitRate ?? 0,
      mrr: m.avgMRR ?? 0,
      ndcg: m.avgNDCG ?? 0,
      faithfulness: m.avgFaithfulness,
      latencyMs: m.avgLatencyMs ?? 0,
      overallScore,
    };
  });

  scored.sort((a, b) => b.overallScore - a.overallScore);
  const bestScore = scored.length > 0 ? scored[0].overallScore : 0;

  return scored.map((s, i) => ({
    ...s,
    rank: i + 1,
    isBest: s.overallScore >= bestScore && i === 0,
  }));
}

export function generateScientificLeaderboard(
  entries: Array<{
    label: string;
    aggregatedMetrics: Record<string, number> | null;
    perQueryMetrics?: Record<string, number[]>;
  }>,
  alpha = 0.05,
): { entries: ScientificLeaderboardEntry[]; tiers: LeaderboardTier[] } {
  const scored = entries.map((e) => {
    const m = e.aggregatedMetrics || {};
    const overallScore = computeOverallScore(
      m.avgRecallAtK ?? 0,
      m.avgPrecisionAtK ?? 0,
      m.avgHitRate ?? 0,
      m.avgMRR ?? 0,
      m.avgNDCG ?? 0,
      m.avgLatencyMs ?? 9999,
      m.avgFaithfulness,
    );
    return {
      label: e.label,
      overallScore,
      recallAtK: m.avgRecallAtK ?? 0,
      precisionAtK: m.avgPrecisionAtK ?? 0,
      hitRate: m.avgHitRate ?? 0,
      mrr: m.avgMRR ?? 0,
      ndcg: m.avgNDCG ?? 0,
      faithfulness: m.avgFaithfulness,
      latencyMs: m.avgLatencyMs ?? 0,
      perQueryMetrics: e.perQueryMetrics ?? {},
    };
  });

  scored.sort((a, b) => b.overallScore - a.overallScore);

  const tiers = scored.length > 0 && scored[0].perQueryMetrics && Object.keys(scored[0].perQueryMetrics).length > 0
    ? groupEquivalentConfigurations(
        scored.map((s) => ({
          label: s.label,
          perQueryMetrics: Object.fromEntries(
            Object.entries(s.perQueryMetrics).map(([k, v]) => [k, v as number[]])
          ),
        })),
        "overallScore",
        alpha,
      )
    : scored.map((_, i) => ({ tier: i + 1, labels: [scored[i].label] }));

  const tierMap = new Map<string, number>();
  for (const tier of tiers) {
    for (const label of tier.labels) {
      tierMap.set(label, tier.tier);
    }
  }

  const result: ScientificLeaderboardEntry[] = scored.map((s, i) => {
    let adjacentComparison: ScientificLeaderboardEntry["adjacentComparison"];

    if (i > 0) {
      const prev = scored[i - 1];
      const prevMetrics = prev.perQueryMetrics;
      const currMetrics = s.perQueryMetrics;
      const sharedKeys = Object.keys(prevMetrics).filter((k) => k in currMetrics);

      if (sharedKeys.length > 0 && prevMetrics[sharedKeys[0]]?.length >= 2) {
        const metricKey = sharedKeys.find((k) => k === "recallAtK") || sharedKeys[0];
        const comp = compareMetrics(
          prevMetrics[metricKey],
          currMetrics[metricKey],
          metricKey,
          prev.label,
          s.label,
          alpha,
        );
        adjacentComparison = {
          significant: comp.significance.significant,
          pValue: comp.significance.pValue,
          ciLower: comp.bootstrapCI.ciLower,
          ciUpper: comp.bootstrapCI.ciUpper,
          effectSize: comp.effectSize.value,
          effectMagnitude: comp.effectSize.magnitude,
        };
      }
    }

    return {
      rank: i + 1,
      label: s.label,
      overallScore: s.overallScore,
      isBest: i === 0,
      recallAtK: s.recallAtK,
      precisionAtK: s.precisionAtK,
      hitRate: s.hitRate,
      mrr: s.mrr,
      ndcg: s.ndcg,
      faithfulness: s.faithfulness,
      latencyMs: s.latencyMs,
      tier: tierMap.get(s.label) ?? i + 1,
      adjacentComparison,
    };
  });

  return { entries: result, tiers };
}
