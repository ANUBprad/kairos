import { prisma } from "@/lib/prisma";
import { vectorStore } from "@/lib/vector";
import { getEmbeddingProvider } from "@/lib/ai/providers";
import type { RetrievedChunk, ProviderType } from "@/lib/ai/types";

export interface RetrievalOptions {
  knowledgeBaseIds: string[];
  topK?: number;
  minSimilarity?: number;
  providerType?: ProviderType;
}

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  query: string;
  totalChunks: number;
}

export async function searchSimilar(
  query: string,
  options: RetrievalOptions,
): Promise<RetrievalResult> {
  const provider = getEmbeddingProvider(options.providerType);

  const response = await provider.generateEmbedding({
    input: query,
  });

  const queryEmbedding = response.embeddings[0];
  if (!queryEmbedding) {
    return { chunks: [], query, totalChunks: 0 };
  }

  const results = await vectorStore.similaritySearch(queryEmbedding, {
    knowledgeBaseIds: options.knowledgeBaseIds,
    topK: options.topK ?? 10,
    minSimilarity: options.minSimilarity ?? 0.7,
  });

  const docIds = [...new Set(results.map((r) => r.documentId))];
  const docs = docIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: docIds } },
        select: { id: true, name: true, metadata: true },
      })
    : [];

  const docMap = new Map(docs.map((d) => [d.id, d]));

  const chunks: RetrievedChunk[] = results.map((r) => {
    const doc = docMap.get(r.documentId);
    const chunkMeta = r.metadata as Record<string, unknown> | null;
    return {
      id: r.chunkId,
      content: r.content,
      index: r.index,
      tokenCount: r.tokenCount,
      documentId: r.documentId,
      documentName: doc?.name || "Unknown",
      similarity: r.similarity,
      pageNumber: (chunkMeta?.pageNumber as number) ?? (doc?.metadata as Record<string, unknown> | null)?.pages as number | null ?? null,
      metadata: chunkMeta,
    };
  });

  return { chunks, query, totalChunks: chunks.length };
}
