import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "@/lib/ai/providers";
import { PgVectorStore } from "@/lib/vector";
import { revalidateSourcePage } from "@/lib/revalidation";
import { getRetrievalConfig } from "@/lib/retrieval/service";
import { resolveEmbeddingModel, assertIndexableEmbeddingModel } from "@/lib/retrieval/embedding-models";
import type { ProviderType } from "@/lib/ai/types";
import { parseRetryAfter } from "@/lib/ai/errors";

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

/**
 * A failure that retrying cannot fix (bad request, missing model, malformed or
 * non-finite vectors, a dimension change mid-document). Retrying it only wastes
 * provider quota and delays the explicit error state.
 */
class PermanentEmbeddingError extends Error {
  readonly retryable = false;

  constructor(message: string) {
    super(message);
    this.name = "PermanentEmbeddingError";
  }
}

/** Failures that are worth another attempt: rate limits, server faults, timeouts. */
const BACKOFF_BASE_MS = 1_000;
const BACKOFF_CAP_MS = 30_000;

function httpStatus(err: unknown): number | undefined {
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" ? status : undefined;
}

function retryAfterMsOf(err: unknown): number | undefined {
  const direct = (err as { retryAfterMs?: unknown }).retryAfterMs;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return Math.max(0, direct);
  }
  const headers = (err as { headers?: { get?: (name: string) => string | null } })
    .headers;
  if (headers && typeof headers.get === "function") {
    return parseRetryAfter(headers.get("retry-after"));
  }
  return undefined;
}

/**
 * Decide whether an embedding failure may be retried. Rate limits (429) and
 * server faults (5xx) are transient, as are timeouts and network errors that
 * arrive without an HTTP status. Every other 4xx — a bad request, bad key, or
 * missing model — is permanent and must fail fast.
 */
export function isTransientEmbeddingError(err: unknown): boolean {
  const guard = err as EmbeddingGuardError;
  if (guard.retryable === false) return false;
  if (guard.retryable === true) return true;
  const status = httpStatus(err);
  if (status === undefined) return true;
  if (status === 429) return true;
  return status >= 500;
}

/**
 * Exponential backoff with full jitter, never less than the server's
 * `Retry-After` and never more than the cap, so a hostile or buggy
 * `Retry-After` cannot stall ingestion indefinitely.
 */
export function computeBackoffMs(attempt: number, retryAfterMs?: number): number {
  const exponential = Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** attempt);
  const jittered = Math.random() * exponential;
  const honored =
    retryAfterMs !== undefined ? Math.min(BACKOFF_CAP_MS, retryAfterMs) : 0;
  return Math.min(BACKOFF_CAP_MS, Math.max(jittered, honored));
}

export function validateEmbeddingResponse(embeddings: number[][], expectedCount: number): number {
  if (embeddings.length !== expectedCount) {
    throw new PermanentEmbeddingError(
      `Embedding provider returned ${embeddings.length} vectors for ${expectedCount} chunks`,
    );
  }
  const dimensions = embeddings[0]?.length ?? 0;
  if (dimensions === 0 || embeddings.some((vector) => vector.length !== dimensions)) {
    throw new PermanentEmbeddingError(
      `Embedding provider returned empty or inconsistent vector dimensions (expected ${dimensions})`,
    );
  }
  if (embeddings.some((vector) => vector.some((value) => !Number.isFinite(value)))) {
    throw new PermanentEmbeddingError(
      "Embedding provider returned a non-finite value (NaN/Infinity) in a vector",
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

  // Index with the knowledge base's own provider/model so the vectors written
  // here are the ones a later query will be embedded with.
  const kbConfig = await getRetrievalConfig(doc.knowledgeBaseId);
  const { provider: resolvedProvider, model } = resolveEmbeddingModel(
    providerType || kbConfig.embeddingProvider,
    kbConfig.embeddingModel,
  );
  const provider = getEmbeddingProvider(resolvedProvider);

  try {
    assertIndexableEmbeddingModel(model);
  } catch (err) {
    const guarded = err as EmbeddingGuardError;
    guarded.retryable = false;
    throw guarded;
  }

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
          throw new PermanentEmbeddingError(
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

        // The vector and the model/dimension that describe it commit together.
        // Written separately, a crash in between leaves a vector carrying the
        // schema defaults (text-embedding-3-small / 1536) whatever it really is.
        await prisma.$transaction(async (tx) => {
          await new PgVectorStore(tx).bulkUpsertEmbeddings(entries, dimensions);

          const updated = await tx.documentEmbedding.updateMany({
            where: { chunkId: { in: batch.map((c) => c.id) } },
            data: { model, dimensions, status: "completed" },
          });
          if (updated.count !== batch.length) {
            throw new PermanentEmbeddingError(
              `Embedding metadata update covered ${updated.count} of ${batch.length} chunks`,
            );
          }
        });

        processedCount += batch.length;
        lastError = null;
        break;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (!isTransientEmbeddingError(lastError)) break;
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) =>
            setTimeout(r, computeBackoffMs(attempt, retryAfterMsOf(lastError))),
          );
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
