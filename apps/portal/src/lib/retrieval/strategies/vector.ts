import { getEmbeddingProvider } from "@/lib/ai/providers";
import { vectorStore } from "@/lib/vector";
import { prisma } from "@/lib/prisma";
import type { RetrievalStrategy, RetrievalContext, RetrievalResult, StrategyDocument } from "./types";

export class VectorStrategy implements RetrievalStrategy {
  readonly name = "vector";
  readonly description = "Standard vector similarity search using embeddings";

  async retrieve(ctx: RetrievalContext): Promise<RetrievalResult> {
    const provider = getEmbeddingProvider(ctx.embeddingProvider as never);

    const embedResponse = await provider.generateEmbedding({
      input: ctx.query,
      model: ctx.embeddingModel || undefined,
    });

    const queryEmbedding = embedResponse.embeddings[0];
    if (!queryEmbedding) {
      return { chunks: [], metadata: { error: "Failed to generate embedding" } };
    }

    const results = await vectorStore.similaritySearch(queryEmbedding, {
      knowledgeBaseIds: [ctx.kbId],
      topK: ctx.topK,
      minSimilarity: ctx.minSimilarity,
    });

    const docIds = [...new Set(results.map((r) => r.documentId))];
    const docs = docIds.length > 0
      ? await prisma.document.findMany({
          where: { id: { in: docIds } },
          select: { id: true, name: true, metadata: true },
        })
      : [];

    const docMap = new Map(docs.map((d) => [d.id, d]));

    const chunks: StrategyDocument[] = results.map((r) => {
      const doc = docMap.get(r.documentId);
      return {
        chunkId: r.chunkId,
        documentId: r.documentId,
        content: r.content,
        index: r.index,
        tokenCount: r.tokenCount,
        metadata: { ...(r.metadata as Record<string, unknown> || {}), documentName: doc?.name },
        similarity: r.similarity,
        source: "vector",
      };
    });

    return {
      chunks,
      metadata: {
        embeddingModel: ctx.embeddingModel,
        dimensions: queryEmbedding.length,
      },
    };
  }
}
