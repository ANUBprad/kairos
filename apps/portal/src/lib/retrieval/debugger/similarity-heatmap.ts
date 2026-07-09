import type { SimilarityMatrix } from "./types";
import { cosineSimilarity } from "./retrieval-trace";

export interface HeatmapCell {
  chunkId: string;
  content: string;
  documentName: string;
  similarity: number;
  rank: number;
}

export function buildSimilarityMatrix(
  queryEmbedding: number[],
  chunks: Array<{ chunkId: string; content: string; documentName: string; embedding: number[] }>,
): SimilarityMatrix {
  const chunksWithSimilarity = chunks.map((c) => ({
    ...c,
    similarity: cosineSimilarity(queryEmbedding, c.embedding),
  }));

  return {
    query: "",
    chunks: chunksWithSimilarity,
    queryEmbedding,
  };
}

export function getHeatmapCells(matrix: SimilarityMatrix): HeatmapCell[] {
  return matrix.chunks
    .map((c, i) => ({
      chunkId: c.chunkId,
      content: c.content,
      documentName: c.documentName,
      similarity: c.similarity,
      rank: i + 1,
    }))
    .sort((a, b) => b.similarity - a.similarity);
}

export function similarityToColor(similarity: number): string {
  if (similarity >= 0.9) return "bg-emerald-500";
  if (similarity >= 0.8) return "bg-emerald-400";
  if (similarity >= 0.7) return "bg-green-400";
  if (similarity >= 0.6) return "bg-yellow-400";
  if (similarity >= 0.5) return "bg-orange-400";
  if (similarity >= 0.4) return "bg-red-400";
  return "bg-red-500";
}

export function similarityToOpacity(similarity: number): number {
  return Math.max(0.3, Math.min(1, similarity));
}

export function getSimilarityDistribution(chunks: Array<{ similarity: number }>): {
  mean: number;
  std: number;
  min: number;
  max: number;
  histogram: Array<{ bucket: string; count: number }>;
} {
  const similarities = chunks.map((c) => c.similarity);
  const n = similarities.length;
  if (n === 0) return { mean: 0, std: 0, min: 0, max: 0, histogram: [] };

  const mean = similarities.reduce((s, v) => s + v, 0) / n;
  const variance = similarities.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1 || 1);
  const std = Math.sqrt(variance);

  const buckets = [
    { label: "0.0-0.2", min: 0, max: 0.2 },
    { label: "0.2-0.4", min: 0.2, max: 0.4 },
    { label: "0.4-0.6", min: 0.4, max: 0.6 },
    { label: "0.6-0.8", min: 0.6, max: 0.8 },
    { label: "0.8-1.0", min: 0.8, max: 1.01 },
  ];

  const histogram = buckets.map((b) => ({
    bucket: b.label,
    count: similarities.filter((s) => s >= b.min && s < b.max).length,
  }));

  return {
    mean: Math.round(mean * 10000) / 10000,
    std: Math.round(std * 10000) / 10000,
    min: Math.min(...similarities),
    max: Math.max(...similarities),
    histogram,
  };
}
