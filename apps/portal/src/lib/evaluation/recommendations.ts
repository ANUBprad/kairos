export interface Recommendation {
  type: "success" | "warning" | "info";
  title: string;
  description: string;
  metric?: string;
  improvement?: string;
}

export interface StrategyConfig {
  label: string;
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  ndcg: number;
  hitRate: number;
  faithfulness?: number;
  latencyMs: number;
  chunkStrategy?: string;
  chunkSize?: number;
  topK?: number;
  embeddingModel?: string;
  retrievalStrategy?: string;
}

export function generateRecommendations(
  entries: StrategyConfig[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  if (entries.length < 2) {
    recs.push({
      type: "info",
      title: "Run More Experiments",
      description: "Run at least 2 benchmark campaigns to receive comparative recommendations.",
    });
    return recs;
  }

  const best = entries.reduce((a, b) =>
    (a.recallAtK + a.precisionAtK + a.mrr + a.ndcg) / 4 >
    (b.recallAtK + b.precisionAtK + b.mrr + b.ndcg) / 4 ? a : b,
  );

  const recallSorted = [...entries].sort((a, b) => b.recallAtK - a.recallAtK);
  const latencySorted = [...entries].sort((a, b) => a.latencyMs - b.latencyMs);

  recs.push({
    type: "success",
    title: "Best Overall Configuration",
    description: `${best.label} achieves the highest composite score with R@${best.recallAtK.toFixed(3)} and MRR@${best.mrr.toFixed(3)}.`,
    metric: "composite",
  });

  if (recallSorted[0].recallAtK > recallSorted[1].recallAtK * 1.1) {
    recs.push({
      type: "info",
      title: "Top Recall Strategy",
      description: `${recallSorted[0].label} leads recall by ${((recallSorted[0].recallAtK / recallSorted[1].recallAtK - 1) * 100).toFixed(0)}% over the next best.`,
      metric: "recallAtK",
    });
  }

  if (latencySorted[0].latencyMs < latencySorted[1].latencyMs * 0.7) {
    const pct = Math.round((1 - latencySorted[0].latencyMs / latencySorted[1].latencyMs) * 100);
    recs.push({
      type: "info",
      title: "Lowest Latency",
      description: `${latencySorted[0].label} is ${pct}% faster than the next best configuration.`,
      metric: "latency",
    });
  }

  const highRecallLowPrecision = entries.find((e) => e.recallAtK > 0.8 && e.precisionAtK < 0.4);
  if (highRecallLowPrecision) {
    recs.push({
      type: "warning",
      title: "Precision-Recall Tradeoff",
      description: `${highRecallLowPrecision.label} has high recall (${(highRecallLowPrecision.recallAtK * 100).toFixed(0)}%) but low precision (${(highRecallLowPrecision.precisionAtK * 100).toFixed(0)}%). Consider increasing similarity threshold or reranking.`,
      metric: "precisionAtK",
    });
  }

  const haveFaithfulness = entries.filter((e) => e.faithfulness != null);
  if (haveFaithfulness.length >= 2) {
    const faithSorted = [...haveFaithfulness].sort((a, b) => (b.faithfulness ?? 0) - (a.faithfulness ?? 0));
    if (faithSorted[0].faithfulness! < 0.7) {
      recs.push({
        type: "warning",
        title: "Hallucination Risk Detected",
        description: `Best faithfulness is only ${(faithSorted[0].faithfulness! * 100).toFixed(0)}%. Consider adding prompt constraints or improving context quality.`,
        metric: "faithfulness",
      });
    }
  }

  const chunkStrategies = new Set(entries.map((e) => e.chunkStrategy).filter(Boolean));
  if (chunkStrategies.size >= 2) {
    const byChunk: Record<string, number[]> = {};
    for (const e of entries) {
      const cs = e.chunkStrategy || "unknown";
      if (!byChunk[cs]) byChunk[cs] = [];
      byChunk[cs].push(e.recallAtK);
    }

    let bestChunk = "";
    let bestAvgRecall = 0;
    for (const [cs, recalls] of Object.entries(byChunk)) {
      const avg = recalls.reduce((s, r) => s + r, 0) / recalls.length;
      if (avg > bestAvgRecall) { bestAvgRecall = avg; bestChunk = cs; }
    }

    if (bestChunk) {
      recs.push({
        type: "info",
        title: `Best Chunking: ${bestChunk}`,
        description: `${bestChunk} chunking achieves the highest average recall (${(bestAvgRecall * 100).toFixed(0)}%) across experiments.`,
        metric: "chunkStrategy",
      });
    }
  }

  if (recs.length === 0) {
    recs.push({
      type: "info",
      title: "Balanced Performance",
      description: "All configurations perform similarly. Try varying chunk size, overlap, or embedding model for more differentiation.",
    });
  }

  return recs;
}
