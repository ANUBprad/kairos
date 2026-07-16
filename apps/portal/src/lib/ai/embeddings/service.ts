import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "@/lib/ai/providers";
import { vectorStore } from "@/lib/vector";
import type { ProviderType } from "@/lib/ai/types";

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;

interface TokenAccount {
  model: string;
  inputTokens: number;
  totalTokens: number;
}

export interface EmbeddingResult {
  documentId: string;
  chunkCount: number;
  tokenAccount: TokenAccount;
  model: string;
}

export async function generateEmbeddings(
  documentId: string,
  providerType?: ProviderType,
): Promise<EmbeddingResult> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, fileType: true, status: true, uploadedById: true },
  });

  if (!doc) throw new Error("Document not found");

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "EMBEDDING" },
  });

  const chunks = await prisma.documentChunk.findMany({
    where: { documentId },
    orderBy: { index: "asc" },
    select: { id: true, content: true, index: true, tokenCount: true },
  });

  if (chunks.length === 0) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "INDEXED" },
    });
    return {
      documentId,
      chunkCount: 0,
      tokenAccount: { model: "", inputTokens: 0, totalTokens: 0 },
      model: "",
    };
  }

  const provider = getEmbeddingProvider(providerType);
  const model =
    providerType === "gemini"
      ? process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004"
      : process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  let totalInputTokens = 0;
  let totalTokens = 0;
  let processedCount = 0;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const response = await provider.generateEmbedding({
          input: texts,
          model,
        });

        if (response.usage) {
          totalInputTokens += response.usage.promptTokens;
          totalTokens += response.usage.totalTokens;
        }

        const entries = batch.map((chunk, idx) => ({
          chunkId: chunk.id,
          embedding: response.embeddings[idx],
        }));

        const dimensions = response.embeddings[0]?.length || 1536;
        await vectorStore.bulkUpsertEmbeddings(entries, dimensions);

        for (let idx = 0; idx < batch.length; idx++) {
          const chunk = batch[idx];
          await prisma.documentEmbedding.update({
            where: { chunkId: chunk.id },
            data: {
              model,
              dimensions: response.embeddings[idx]?.length || 1536,
              status: "completed",
            },
          });
        }

        processedCount += batch.length;
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      }
    }

    if (lastError) throw lastError;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "INDEXED" },
  });

  if (doc.uploadedById) {
    await prisma.documentActivity.create({
      data: {
        documentId,
        userId: doc.uploadedById,
        action: "EMBEDDED",
        details: {
          chunks: processedCount,
          model,
          inputTokens: totalInputTokens,
        } as never,
      },
    });
  }

  return {
    documentId,
    chunkCount: processedCount,
    tokenAccount: {
      model,
      inputTokens: totalInputTokens,
      totalTokens,
    },
    model,
  };
}
