import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "@/lib/ai/providers";
import { vectorStore } from "@/lib/vector";
import { revalidateSourcePage } from "@/lib/revalidation";
import type { ProviderType } from "@/lib/ai/types";

const BATCH_SIZE = 20;
const MAX_RETRIES = 3;
const EMBEDDING_TIMEOUT_MS = 60_000;
export const STALE_EMBEDDING_MS = 30 * 60 * 1000;

interface TokenAccount {
  model: string;
  inputTokens: number;
  totalTokens: number;
}

interface EmbeddingGuardError extends Error {
  retryable?: boolean;
}

export function validateEmbeddingResponse(embeddings: number[][], expectedCount: number): number {
  if (embeddings.length !== expectedCount) {
    throw new Error(
      `Embedding provider returned ${embeddings.length} vectors for ${expectedCount} chunks`,
    );
  }
  const dimensions = embeddings[0]?.length ?? 0;
  if (dimensions === 0 || embeddings.some((vector) => vector.length !== dimensions)) {
    throw new Error(
      `Embedding provider returned empty or inconsistent vector dimensions (expected ${dimensions})`,
    );
  }
  return dimensions;
}

async function assertKbEmbeddingDimension(
  knowledgeBaseId: string,
  documentId: string,
  dimensions: number,
  model: string,
): Promise<void> {
  const rows = await prisma.$queryRaw<{ dims: number }[]>`
    SELECT DISTINCT vector_dims(e."embedding")::int AS dims
    FROM "DocumentEmbedding" e
    JOIN "DocumentChunk" c ON c.id = e."chunkId"
    JOIN "Document" d ON d.id = c."documentId"
    WHERE d."knowledgeBaseId" = ${knowledgeBaseId}
      AND d."id" <> ${documentId}
  `;
  const known = rows.map((r) => r.dims);
  if (known.length > 0 && !known.includes(dimensions)) {
    const err = new Error(
      `Knowledge base already contains embeddings at dimension ${known.join("/")} — model "${model}" ` +
        `produces ${dimensions}-dimensional vectors. Reprocess the whole knowledge base at the new ` +
        `dimension before switching embedding models/providers.`,
    ) as EmbeddingGuardError;
    err.retryable = false;
    throw err;
  }
}

export async function recoverStaleEmbeddingDocuments(
  knowledgeBaseId: string,
  staleBefore: Date,
): Promise<number> {
  const result = await prisma.document.updateMany({
    where: {
      knowledgeBaseId,
      status: { in: ["EMBEDDING", "EMBEDDING_PENDING"] },
      updatedAt: { lt: staleBefore },
    },
    data: { status: "ERROR" },
  });
  return result.count;
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
  evictChunkIds?: string[],
): Promise<EmbeddingResult> {
  const doc = await prisma.document.findUnique({
    where: { id: documentId },
    select: { id: true, fileType: true, status: true, uploadedById: true, knowledgeBaseId: true },
  });

  if (!doc) throw new Error("Document not found");

  await recoverStaleEmbeddingDocuments(
    doc.knowledgeBaseId,
    new Date(Date.now() - STALE_EMBEDDING_MS),
  ).catch(() => {});

  await prisma.document.update({
    where: { id: documentId },
    data: { status: "EMBEDDING" },
  });

  const chunks = await prisma.documentChunk.findMany({
    where: {
      documentId,
      ...(evictChunkIds && evictChunkIds.length > 0
        ? { id: { notIn: evictChunkIds } }
        : {}),
    },
    orderBy: { index: "asc" },
    select: { id: true, content: true, index: true, tokenCount: true },
  });

  if (chunks.length === 0) {
    await prisma.document.update({
      where: { id: documentId },
      data: { status: "INDEXED" },
    });
    revalidateSourcePage(doc.knowledgeBaseId);
    return {
      documentId,
      chunkCount: 0,
      tokenAccount: { model: "", inputTokens: 0, totalTokens: 0 },
      model: "",
    };
  }

  const provider = getEmbeddingProvider(providerType);
  const model =
    provider.type === "gemini"
      ? process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004"
      : process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  let totalInputTokens = 0;
  let totalTokens = 0;
  let processedCount = 0;
  let expectedDimensions: number | null = null;
  const timeoutMs = Number(process.env.EMBEDDING_TIMEOUT_MS) || EMBEDDING_TIMEOUT_MS;

  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const texts = batch.map((c) => c.content);

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        let response: Awaited<ReturnType<typeof provider.generateEmbedding>>;
        try {
          response = await provider.generateEmbedding({
            input: texts,
            model,
            signal: controller.signal,
          });
        } catch (err) {
          if (controller.signal.aborted) {
            throw new Error(`Embedding request timed out after ${timeoutMs}ms`, { cause: err });
          }
          throw err;
        }

        if (response.usage) {
          totalInputTokens += response.usage.promptTokens;
          totalTokens += response.usage.totalTokens;
        }

        const dimensions = validateEmbeddingResponse(response.embeddings, batch.length);
        if (expectedDimensions !== null && dimensions !== expectedDimensions) {
          throw new Error(
            `Embedding dimension changed mid-document: ${expectedDimensions} → ${dimensions}`,
          );
        }
        if (expectedDimensions === null) {
          await assertKbEmbeddingDimension(doc.knowledgeBaseId, doc.id, dimensions, model);
        }
        expectedDimensions = dimensions;

        const entries = batch.map((chunk, idx) => ({
          chunkId: chunk.id,
          embedding: response.embeddings[idx],
        }));

        await vectorStore.bulkUpsertEmbeddings(entries, dimensions);

        await prisma.$transaction(
          batch.map((chunk) =>
            prisma.documentEmbedding.update({
              where: { chunkId: chunk.id },
              data: {
                model,
                dimensions,
                status: "completed",
              },
            }),
          ),
        );

        processedCount += batch.length;
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if ((lastError as EmbeddingGuardError).retryable === false) break;
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    if (lastError) throw lastError;
  }

  const replacedChunks = evictChunkIds && evictChunkIds.length > 0 ? evictChunkIds.length : 0;
  await prisma.$transaction(async (tx) => {
    if (replacedChunks > 0) {
      await tx.documentChunk.deleteMany({ where: { id: { in: evictChunkIds } } });
    }
    await tx.document.update({
      where: { id: documentId },
      data: { status: "INDEXED" },
    });

    if (doc.uploadedById) {
      await tx.documentActivity.create({
        data: {
          documentId,
          userId: doc.uploadedById,
          action: "EMBEDDED",
          details: {
            chunks: processedCount,
            model,
            inputTokens: totalInputTokens,
            replacedChunks,
          } as never,
        },
      });
    }
  });

  revalidateSourcePage(doc.knowledgeBaseId);

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
