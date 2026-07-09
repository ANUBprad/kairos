import type { RetrievalComparison, RetrievalTrace } from "./types";

export function compareRetrievalTraces(
  traceA: RetrievalTrace,
  traceB: RetrievalTrace,
): RetrievalComparison {
  const chunksA = traceA.rerankedChunks.length > 0 ? traceA.rerankedChunks : traceA.retrievedChunks;
  const chunksB = traceB.rerankedChunks.length > 0 ? traceB.rerankedChunks : traceB.retrievedChunks;

  const idsA = new Set(chunksA.map((c) => c.chunkId));
  const idsB = new Set(chunksB.map((c) => c.chunkId));

  const overlapChunks = chunksA.filter((c) => idsB.has(c.chunkId)).map((c) => c.chunkId);
  const onlyInA = chunksA.filter((c) => !idsB.has(c.chunkId)).map((c) => c.chunkId);
  const onlyInB = chunksB.filter((c) => !idsA.has(c.chunkId)).map((c) => c.chunkId);

  const mapA = new Map(chunksA.map((c) => [c.chunkId, c.similarity]));
  const mapB = new Map(chunksB.map((c) => [c.chunkId, c.similarity]));

  const commonIds = overlapChunks;
  const similarityDifferences = commonIds.map((id) => ({
    chunkId: id,
    similarityA: mapA.get(id) ?? 0,
    similarityB: mapB.get(id) ?? 0,
    difference: (mapA.get(id) ?? 0) - (mapB.get(id) ?? 0),
  }));

  return {
    labelA: traceA.strategy,
    labelB: traceB.strategy,
    traceA,
    traceB,
    overlapChunks,
    onlyInA,
    onlyInB,
    similarityDifferences,
  };
}

export function getComparisonSummary(comparison: RetrievalComparison): {
  overlapCount: number;
  onlyInACount: number;
  onlyInBCount: number;
  avgSimilarityDiff: number;
  maxSimilarityDiff: number;
  jaccardSimilarity: number;
} {
  const unionSize = new Set([
    ...comparison.overlapChunks,
    ...comparison.onlyInA,
    ...comparison.onlyInB,
  ]).size;

  const jaccardSimilarity = unionSize > 0 ? comparison.overlapChunks.length / unionSize : 0;

  const diffs = comparison.similarityDifferences.map((d) => Math.abs(d.difference));
  const avgSimilarityDiff = diffs.length > 0 ? diffs.reduce((s, d) => s + d, 0) / diffs.length : 0;
  const maxSimilarityDiff = diffs.length > 0 ? Math.max(...diffs) : 0;

  return {
    overlapCount: comparison.overlapChunks.length,
    onlyInACount: comparison.onlyInA.length,
    onlyInBCount: comparison.onlyInB.length,
    avgSimilarityDiff: Math.round(avgSimilarityDiff * 10000) / 10000,
    maxSimilarityDiff: Math.round(maxSimilarityDiff * 10000) / 10000,
    jaccardSimilarity: Math.round(jaccardSimilarity * 10000) / 10000,
  };
}

export function getComparisonInsights(comparison: RetrievalComparison): string[] {
  const insights: string[] = [];
  const summary = getComparisonSummary(comparison);

  if (summary.jaccardSimilarity > 0.8) {
    insights.push(
      `High overlap (Jaccard = ${summary.jaccardSimilarity.toFixed(2)}). Both strategies retrieve mostly the same chunks.`,
    );
  } else if (summary.jaccardSimilarity < 0.3) {
    insights.push(
      `Low overlap (Jaccard = ${summary.jaccardSimilarity.toFixed(2)}). The strategies retrieve very different chunks. Consider combining them with hybrid search.`,
    );
  }

  if (summary.onlyInACount > 0) {
    insights.push(
      `${summary.onlyInACount} chunks are only retrieved by ${comparison.labelA}. These may be relevant chunks that ${comparison.labelB} misses.`,
    );
  }

  if (summary.onlyInBCount > 0) {
    insights.push(
      `${summary.onlyInBCount} chunks are only retrieved by ${comparison.labelB}. These may be relevant chunks that ${comparison.labelA} misses.`,
    );
  }

  if (summary.avgSimilarityDiff > 0.1) {
    insights.push(
      `Average similarity difference is ${summary.avgSimilarityDiff.toFixed(3)}. One strategy consistently assigns higher scores.`,
    );
  }

  return insights;
}
