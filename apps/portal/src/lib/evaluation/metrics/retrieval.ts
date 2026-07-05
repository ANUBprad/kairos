import type { RetrievalMetrics } from "../types";

export function calculateRetrievalMetrics(
  retrievedChunkIds: string[],
  relevantChunkIds: string[],
  k: number,
): RetrievalMetrics {
  const topK = retrievedChunkIds.slice(0, k);
  const relevantSet = new Set(relevantChunkIds);

  const relevantRetrieved = topK.filter((id) => relevantSet.has(id));
  const totalRelevant = relevantChunkIds.length;

  const recallAtK = totalRelevant > 0 ? relevantRetrieved.length / totalRelevant : 0;
  const precisionAtK = k > 0 ? relevantRetrieved.length / k : 0;
  const hitRate = relevantRetrieved.length > 0 ? 1 : 0;

  const firstRelevantRank = topK.findIndex((id) => relevantSet.has(id));
  const reciprocalRank = firstRelevantRank >= 0 ? 1 / (firstRelevantRank + 1) : 0;
  const meanReciprocalRank = reciprocalRank;

  const ndcg = calculateNDCG(topK, relevantChunkIds, k);

  return {
    recallAtK: round(recallAtK),
    precisionAtK: round(precisionAtK),
    hitRate: round(hitRate),
    meanReciprocalRank: round(meanReciprocalRank),
    ndcg: round(ndcg),
    k,
  };
}

export function calculateAverageMetrics(
  allMetrics: RetrievalMetrics[],
): RetrievalMetrics {
  const n = allMetrics.length;
  if (n === 0) {
    return { recallAtK: 0, precisionAtK: 0, hitRate: 0, meanReciprocalRank: 0, ndcg: 0, k: 0 };
  }

  return {
    recallAtK: round(allMetrics.reduce((s, m) => s + m.recallAtK, 0) / n),
    precisionAtK: round(allMetrics.reduce((s, m) => s + m.precisionAtK, 0) / n),
    hitRate: round(allMetrics.reduce((s, m) => s + m.hitRate, 0) / n),
    meanReciprocalRank: round(allMetrics.reduce((s, m) => s + m.meanReciprocalRank, 0) / n),
    ndcg: round(allMetrics.reduce((s, m) => s + m.ndcg, 0) / n),
    k: allMetrics[0]?.k || 0,
  };
}

function calculateNDCG(
  rankedIds: string[],
  relevantIds: string[],
  k: number,
): number {
  const relevantSet = new Set(relevantIds);
  const topK = rankedIds.slice(0, k);

  let dcg = 0;
  for (let i = 0; i < topK.length; i++) {
    const rel = relevantSet.has(topK[i]) ? 1 : 0;
    dcg += rel / Math.log2(i + 2);
  }

  const idealRelevance = Math.min(relevantIds.length, k);
  let idcg = 0;
  for (let i = 0; i < idealRelevance; i++) {
    idcg += 1 / Math.log2(i + 2);
  }

  return idcg > 0 ? dcg / idcg : 0;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
