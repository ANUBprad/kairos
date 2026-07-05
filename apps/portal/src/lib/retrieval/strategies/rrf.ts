import type { StrategyDocument, FusionInput, RRFParams } from "./types";

const DEFAULT_RRF_PARAMS: RRFParams = { k: 60 };

export function reciprocalRankFusion(
  inputs: FusionInput[],
  params: RRFParams = DEFAULT_RRF_PARAMS,
): StrategyDocument[] {
  const scores = new Map<string, { chunk: StrategyDocument; score: number; sources: string[] }>();

  for (const input of inputs) {
    const { chunks, weight, label } = input;

    for (let rank = 0; rank < chunks.length; rank++) {
      const chunk = chunks[rank];
      const rrfScore = weight / (params.k + rank + 1);
      const key = chunk.chunkId;

      if (scores.has(key)) {
        const existing = scores.get(key)!;
        existing.score += rrfScore;
        existing.sources.push(label);
      } else {
        scores.set(key, {
          chunk: { ...chunk },
          score: rrfScore,
          sources: [label],
        });
      }
    }
  }

  const results = Array.from(scores.values());
  results.sort((a, b) => b.score - a.score);

  return results.map((r) => ({
    ...r.chunk,
    similarity: Math.min(1, Math.max(0, r.score / (r.sources.length * 10))),
    metadata: {
      ...(r.chunk.metadata as Record<string, unknown> || {}),
      rrfScore: Math.round(r.score * 10000) / 10000,
      sources: r.sources,
    },
  }));
}

export function getFusionContributions(
  finalChunks: StrategyDocument[],
  inputs: FusionInput[],
): Record<string, { label: string; chunkCount: number; topContribution: number }> {
  const contributions: Record<string, { label: string; chunkCount: number; topContribution: number }> = {};

  for (const input of inputs) {
    const topChunks = finalChunks.filter((c) => {
      const sources = (c.metadata as Record<string, unknown>)?.sources as string[] | undefined;
      return sources?.includes(input.label);
    });

    const topPositions = topChunks.map((c) => finalChunks.indexOf(c));
    const avgPosition = topPositions.length > 0
      ? topPositions.reduce((a, b) => a + b, 0) / topPositions.length
      : 0;

    contributions[input.label] = {
      label: input.label,
      chunkCount: topChunks.length,
      topContribution: Math.round((1 - avgPosition / Math.max(finalChunks.length, 1)) * 100) / 100,
    };
  }

  return contributions;
}
