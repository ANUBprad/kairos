import { compareMetrics } from "./significance";

export interface Recommendation {
  type: "success" | "warning" | "info";
  title: string;
  description: string;
  metric?: string;
  improvement?: string;
  significant?: boolean;
}

export interface EvidenceBackedRecommendation extends Recommendation {
  evidence: {
    metrics: Record<string, { value: number; ci?: [number, number] }>;
    significance?: {
      pValue: number;
      testUsed: string;
      effectSize: string;
    };
    explanation: string;
  };
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
  perQueryMetrics?: Record<string, number[]>;
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
    significant: true,
  });

  if (recallSorted.length >= 2 && recallSorted[0].perQueryMetrics && recallSorted[1].perQueryMetrics) {
    const topMetrics = recallSorted[0].perQueryMetrics;
    const secondMetrics = recallSorted[1].perQueryMetrics;
    const sharedKeys = Object.keys(topMetrics).filter((k) => k in secondMetrics);

    if (sharedKeys.length > 0) {
      const metricKey = sharedKeys.find((k) => k === "recallAtK") || sharedKeys[0];
      const baselineValues = secondMetrics[metricKey];
      const treatmentValues = topMetrics[metricKey];

      if (baselineValues.length >= 2 && treatmentValues.length >= 2) {
        const result = compareMetrics(
          baselineValues,
          treatmentValues,
          metricKey,
          recallSorted[1].label,
          recallSorted[0].label,
        );

        if (result.significance.significant) {
          recs.push({
            type: "info",
            title: "Top Recall Strategy (Statistically Significant)",
            description: `${recallSorted[0].label} significantly outperforms ${recallSorted[1].label} on recall (p=${result.significance.pValue.toFixed(4)}, effect=${result.effectSize.magnitude}). ${result.interpretation}`,
            metric: "recallAtK",
            improvement: `+${((result.meanDifference / result.meanA) * 100).toFixed(1)}%`,
            significant: true,
          });
        } else {
          recs.push({
            type: "info",
            title: "Top Recall Strategy (Not Significant)",
            description: `${recallSorted[0].label} has a higher recall than ${recallSorted[1].label}, but this improvement was observed but is not statistically significant (p=${result.significance.pValue.toFixed(4)}). ${result.interpretation}`,
            metric: "recallAtK",
            improvement: `+${((result.meanDifference / Math.max(result.meanA, 0.001)) * 100).toFixed(1)}%`,
            significant: false,
          });
        }
      }
    }
  }

  if (latencySorted.length >= 2) {
    const fastest = latencySorted[0];
    const secondFastest = latencySorted[1];
    const pct = Math.round((1 - fastest.latencyMs / secondFastest.latencyMs) * 100);
    if (pct > 30) {
      const hasPerQuery = fastest.perQueryMetrics && secondFastest.perQueryMetrics;
      let isSignificant = true;

      if (hasPerQuery) {
        const fastestLat = fastest.perQueryMetrics!.latencyMs || fastest.perQueryMetrics!.avgLatencyMs;
        const secondLat = secondFastest.perQueryMetrics!.latencyMs || secondFastest.perQueryMetrics!.avgLatencyMs;
        if (fastestLat && secondLat && fastestLat.length >= 2 && secondLat.length >= 2) {
          const result = compareMetrics(secondLat, fastestLat, "latencyMs", secondFastest.label, fastest.label);
          isSignificant = result.significance.significant;
        }
      }

      if (isSignificant) {
        recs.push({
          type: "info",
          title: "Lowest Latency",
          description: `${fastest.label} is ${pct}% faster than the next best configuration.`,
          metric: "latency",
          significant: true,
        });
      } else {
        recs.push({
          type: "info",
          title: "Lowest Latency (Not Significant)",
          description: `${fastest.label} appears ${pct}% faster than ${secondFastest.label}, but this improvement was observed but is not statistically significant.`,
          metric: "latency",
          significant: false,
        });
      }
    }
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

export function generateEvidenceBackedRecommendations(
  entries: StrategyConfig[],
): EvidenceBackedRecommendation[] {
  const recs: EvidenceBackedRecommendation[] = [];

  if (entries.length < 2) {
    recs.push({
      type: "info",
      title: "Run More Experiments",
      description: "Run at least 2 benchmark campaigns to receive comparative recommendations.",
      evidence: {
        metrics: {},
        explanation: "Insufficient data for evidence-backed analysis.",
      },
    });
    return recs;
  }

  const sorted = [...entries].sort((a, b) => {
    const scoreA = (a.recallAtK + a.precisionAtK + a.mrr + a.ndcg) / 4;
    const scoreB = (b.recallAtK + b.precisionAtK + b.mrr + b.ndcg) / 4;
    return scoreB - scoreA;
  });

  const best = sorted[0];
  const second = sorted[1];

  const bestMetrics: Record<string, { value: number }> = {
    "Recall@K": { value: best.recallAtK },
    "Precision@K": { value: best.precisionAtK },
    MRR: { value: best.mrr },
    nDCG: { value: best.ndcg },
    "Hit Rate": { value: best.hitRate },
  };

  let significanceResult: EvidenceBackedRecommendation["evidence"]["significance"] | undefined;
  let improvementPct = 0;

  if (best.perQueryMetrics && second.perQueryMetrics) {
    const secondMetrics = second.perQueryMetrics;
    const sharedKeys = Object.keys(best.perQueryMetrics).filter((k) => k in secondMetrics);
    const metricKey = sharedKeys.find((k) => k === "recallAtK") || sharedKeys[0];

    if (metricKey) {
      const baselineValues = second.perQueryMetrics[metricKey];
      const treatmentValues = best.perQueryMetrics[metricKey];

      if (baselineValues.length >= 2 && treatmentValues.length >= 2) {
        try {
          const result = compareMetrics(baselineValues, treatmentValues, metricKey, second.label, best.label);
          significanceResult = {
            pValue: result.significance.pValue,
            testUsed: result.significance.testUsed,
            effectSize: result.effectSize.magnitude,
          };
          improvementPct = result.meanA > 0 ? (result.meanDifference / result.meanA) * 100 : 0;
        } catch {
          // skip
        }
      }
    }
  }

  recs.push({
    type: "success",
    title: "Best Overall Configuration",
    description: `${best.label} achieves the highest composite score with R@${best.recallAtK.toFixed(3)}, P@${best.precisionAtK.toFixed(3)}, MRR@${best.mrr.toFixed(3)}, nDCG@${best.ndcg.toFixed(3)}.`,
    metric: "composite",
    significant: significanceResult?.pValue !== undefined ? significanceResult.pValue < 0.05 : undefined,
    improvement: improvementPct > 0 ? `+${improvementPct.toFixed(1)}%` : undefined,
    evidence: {
      metrics: bestMetrics,
      significance: significanceResult,
      explanation: significanceResult
        ? significanceResult.pValue < 0.05
          ? `${best.label} significantly outperforms ${second.label} on the primary metric (p = ${significanceResult.pValue.toFixed(4)}, effect = ${significanceResult.effectSize}).`
          : `While ${best.label} has higher scores, the difference is not statistically significant (p = ${significanceResult.pValue.toFixed(4)}).`
        : `${best.label} achieves the highest scores across all metrics.`,
    },
  });

  if (best.recallAtK > 0.7 && best.precisionAtK < 0.35) {
    recs.push({
      type: "warning",
      title: "Precision-Recall Imbalance",
      description: `${best.label} has strong recall (${(best.recallAtK * 100).toFixed(0)}%) but weak precision (${(best.precisionAtK * 100).toFixed(0)}%).`,
      metric: "precisionAtK",
      evidence: {
        metrics: {
          "Recall@K": { value: best.recallAtK },
          "Precision@K": { value: best.precisionAtK },
        },
        explanation: `The gap between recall and precision (${((best.recallAtK - best.precisionAtK) * 100).toFixed(0)} percentage points) suggests many irrelevant documents are retrieved. Reranking or a higher similarity threshold would improve precision without sacrificing recall.`,
      },
    });
  }

  const faithEntries = entries.filter((e) => e.faithfulness != null);
  if (faithEntries.length >= 2) {
    const bestFaith = faithEntries.reduce((a, b) => (a.faithfulness ?? 0) > (b.faithfulness ?? 0) ? a : b);
    if (bestFaith.faithfulness !== undefined && bestFaith.faithfulness < 0.7) {
      recs.push({
        type: "warning",
        title: "Hallucination Risk",
        description: `Best faithfulness is ${(bestFaith.faithfulness * 100).toFixed(0)}% across configurations.`,
        metric: "faithfulness",
        evidence: {
          metrics: {
            Faithfulness: { value: bestFaith.faithfulness },
          },
          explanation: "Low faithfulness indicates generated answers may contain information not supported by retrieved context. Consider adding answer constraints or improving context quality.",
        },
      });
    }
  }

  if (best.latencyMs > 2000) {
    recs.push({
      type: "warning",
      title: "High Latency",
      description: `${best.label} has ${best.latencyMs.toFixed(0)}ms average latency.`,
      metric: "latency",
      evidence: {
        metrics: {
          "Avg Latency (ms)": { value: best.latencyMs },
        },
        explanation: `Latency above 2 seconds may impact user experience. Consider reducing top-K, using a faster embedding model, or optimizing the retrieval pipeline.`,
      },
    });
  }

  return recs;
}
