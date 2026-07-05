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
