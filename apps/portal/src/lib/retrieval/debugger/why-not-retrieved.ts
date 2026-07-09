import type { WhyNotRetrieved } from "./types";
import { cosineSimilarity } from "./retrieval-trace";

export interface WhyNotAnalysis {
  query: string;
  threshold: number;
  topSimilarity: number;
  notRetrieved: WhyNotRetrieved[];
  summary: {
    totalNotRetrieved: number;
    averageSimilarity: number;
    maxSimilarity: number;
    minSimilarity: number;
  };
}

export function analyzeWhyNotRetrieved(
  queryEmbedding: number[],
  allChunks: Array<{
    chunkId: string;
    content: string;
    documentName: string;
    embedding: number[];
  }>,
  retrievedChunkIds: Set<string>,
  threshold: number,
): WhyNotAnalysis {
  const notRetrievedChunks = allChunks
    .filter((c) => !retrievedChunkIds.has(c.chunkId))
    .map((c) => {
      const similarity = cosineSimilarity(queryEmbedding, c.embedding);
      let reason: string;

      if (similarity < threshold) {
        reason = `Similarity ${similarity.toFixed(3)} is below threshold ${threshold.toFixed(3)}`;
      } else if (similarity >= threshold) {
        reason = `Similarity ${similarity.toFixed(3)} meets threshold but was not ranked in top-K`;
      } else {
        reason = "Unknown reason";
      }

      return {
        chunkId: c.chunkId,
        content: c.content,
        documentName: c.documentName,
        actualSimilarity: similarity,
        reason,
        threshold,
        topSimilarity: 0,
        rank: 0,
      };
    })
    .sort((a, b) => b.actualSimilarity - a.actualSimilarity);

  const topSimilarity = notRetrievedChunks.length > 0 ? notRetrievedChunks[0].actualSimilarity : 0;

  const enriched = notRetrievedChunks.map((c) => ({
    ...c,
    topSimilarity,
  }));

  const similarities = enriched.map((c) => c.actualSimilarity);
  const avgSimilarity = similarities.length > 0
    ? similarities.reduce((s, v) => s + v, 0) / similarities.length
    : 0;

  return {
    query: "",
    threshold,
    topSimilarity,
    notRetrieved: enriched,
    summary: {
      totalNotRetrieved: enriched.length,
      averageSimilarity: Math.round(avgSimilarity * 10000) / 10000,
      maxSimilarity: enriched.length > 0 ? enriched[0].actualSimilarity : 0,
      minSimilarity: enriched.length > 0 ? enriched[enriched.length - 1].actualSimilarity : 0,
    },
  };
}

export function categorizeNotRetrieved(
  analysis: WhyNotAnalysis,
): {
  belowThreshold: WhyNotRetrieved[];
  aboveThresholdNotRanked: WhyNotRetrieved[];
} {
  const belowThreshold = analysis.notRetrieved.filter(
    (c) => c.actualSimilarity < c.threshold,
  );
  const aboveThresholdNotRanked = analysis.notRetrieved.filter(
    (c) => c.actualSimilarity >= c.threshold,
  );

  return { belowThreshold, aboveThresholdNotRanked };
}

export function getWhyNotRetrievedInsights(analysis: WhyNotAnalysis): string[] {
  const insights: string[] = [];
  const { belowThreshold, aboveThresholdNotRanked } = categorizeNotRetrieved(analysis);

  if (aboveThresholdNotRanked.length > 0) {
    insights.push(
      `${aboveThresholdNotRanked.length} chunks have similarity above the threshold but were not ranked in the top-K. Consider increasing top-K to include them.`,
    );
  }

  if (belowThreshold.length > 0) {
    const avgBelow = belowThreshold.reduce((s, c) => s + c.actualSimilarity, 0) / belowThreshold.length;
    insights.push(
      `${belowThreshold.length} chunks are below the similarity threshold (avg: ${avgBelow.toFixed(3)}). These may need better embedding models or different chunking strategies.`,
    );
  }

  if (analysis.summary.maxSimilarity > analysis.threshold * 0.9) {
    insights.push(
      `Some chunks have similarity close to the threshold. Consider lowering the threshold slightly to capture more relevant results.`,
    );
  }

  if (analysis.notRetrieved.length === 0) {
    insights.push("All chunks with sufficient similarity were retrieved. The retrieval is working well.");
  }

  return insights;
}
