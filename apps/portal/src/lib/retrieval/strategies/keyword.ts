import { prisma } from "@/lib/prisma";
import { BM25 } from "./bm25";
import type { RetrievalStrategy, RetrievalContext, RetrievalResult, StrategyDocument } from "./types";

// The BM25 index cache is shared module-wide instead of per instance so one
// invalidation clears every copy — the standalone KeywordStrategy, the
// HybridStrategy's internal instance, and any ad-hoc ones. Keys are
// `${kbId}:${scopeKey}`.
const indexCache = new Map<string, { bm25: BM25; chunks: StrategyDocument[] }>();

export function clearKeywordIndexCache(kbId?: string): void {
  if (kbId) {
    for (const key of indexCache.keys()) {
      if (key === kbId || key.startsWith(`${kbId}:`)) indexCache.delete(key);
    }
    return;
  }
  indexCache.clear();
}

export class KeywordStrategy implements RetrievalStrategy {
  readonly name = "keyword";
  readonly description = "BM25 keyword-based retrieval";

  async retrieve(ctx: RetrievalContext): Promise<RetrievalResult> {
    const scopeKey = ctx.documentIds?.length ? [...ctx.documentIds].sort().join(",") : "all";
    const cacheKey = `${ctx.kbId}:${scopeKey}`;
    let indexEntry = indexCache.get(cacheKey);

    if (!indexEntry) {
      const chunks = await prisma.documentChunk.findMany({
        where: {
          document: {
            knowledgeBaseId: ctx.kbId,
            ...(ctx.documentIds?.length ? { id: { in: ctx.documentIds } } : {}),
            status: "INDEXED",
          },
        },
        select: {
          id: true,
          documentId: true,
          content: true,
          index: true,
          tokenCount: true,
          metadata: true,
          document: { select: { name: true } },
        },
      });

      const strategyDocs: StrategyDocument[] = chunks.map((c) => ({
        chunkId: c.id,
        documentId: c.documentId,
        content: c.content,
        index: c.index,
        tokenCount: c.tokenCount,
        metadata: { ...(c.metadata as Record<string, unknown> || {}), documentName: c.document.name },
        similarity: 0,
        source: "keyword",
      }));

      const bm25 = new BM25();
      bm25.build(strategyDocs.map((d) => d.content));

      indexEntry = { bm25, chunks: strategyDocs };
      indexCache.set(cacheKey, indexEntry);
    }

    const { bm25, chunks } = indexEntry;

    if (chunks.length === 0) {
      return { chunks: [], metadata: { bm25Stats: bm25.getStats() } };
    }

    const results = bm25.search(ctx.query, ctx.topK);

    const scoredChunks: StrategyDocument[] = results.map((r) => ({
      ...chunks[r.index],
      similarity: normalizeBM25Score(r.score),
      metadata: {
        ...(chunks[r.index].metadata as Record<string, unknown> || {}),
        bm25Score: Math.round(r.score * 10000) / 10000,
      },
    }));

    return {
      chunks: scoredChunks,
      metadata: { bm25Stats: bm25.getStats() },
    };
  }

  clearCache(kbId?: string): void {
    clearKeywordIndexCache(kbId);
  }
}

function normalizeBM25Score(score: number): number {
  return Math.min(1, Math.max(0, score / (score + 1)));
}
