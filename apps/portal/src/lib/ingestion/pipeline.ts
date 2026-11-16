import { prisma } from "@/lib/prisma";
import { getStorageProvider } from "@/lib/storage";
import { extractText } from "@/lib/extraction";
import { chunkText } from "@/lib/chunking";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { logger } from "@/lib/logger";
import { fetchArticle } from "@/lib/ingestion/url";
import { fetchYouTubeTranscript } from "@/lib/ingestion/youtube";
import { mergeFailureMetadata } from "@/lib/ingestion/processing-metadata";
import { revalidateSourcePage } from "@/lib/revalidation";
import type { Prisma } from "@prisma/client";

const MAX_DOWNLOAD_SIZE = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;

export interface StagedSwap {
  evictChunkIds: string[];
  revertIdentity?: {
    name?: string;
    sourceUrl?: string | null;
    fileHash?: string | null;
    size?: number | null;
    metadata?: Record<string, unknown> | null;
  };
}

export interface ProcessOutcome {
  ok: boolean;
  error?: string;
  // The previous indexed content is still usable; only this attempt failed.
  retainedPreviousContent?: boolean;
}

// If a mutation was staged (evictChunkIds passed), a pipeline failure must not
// destroy the last known-good content: while every old chunk still exists, the
// candidate chunks are dropped and the document returns to INDEXED so retrieval
// keeps handing out the previous good version. Only when the staged swap has
// already happened do we fall through to the plain ERROR state.
async function rollbackOrError(
  docId: string,
  staged: StagedSwap | undefined,
  meta: Record<string, unknown>,
  errMsg: string,
  stage: string,
): Promise<"retained" | "error"> {
  const evictChunkIds = staged?.evictChunkIds;

  const docRow = await prisma.document
    .findUnique({
      where: { id: docId },
      select: { metadata: true, uploadedById: true, knowledgeBaseId: true },
    })
    .catch(() => null);

  if (evictChunkIds && evictChunkIds.length > 0) {
    const remaining = await prisma.documentChunk
      .count({ where: { id: { in: evictChunkIds } } })
      .catch(() => -1);

    if (remaining === evictChunkIds.length) {
      const revertIdentity = staged?.revertIdentity;
      const baseMeta = revertIdentity?.metadata ?? (docRow?.metadata ?? {});
      try {
        await prisma.$transaction(async (tx) => {
          await tx.documentChunk.deleteMany({
            where: { documentId: docId, id: { notIn: evictChunkIds } },
          });
          const data: Prisma.DocumentUncheckedUpdateInput = {
            status: "INDEXED",
            metadata: {
              ...(baseMeta as Record<string, unknown>),
              stage: "failed",
              lastProcessFailedAt: new Date().toISOString(),
              lastProcessError: errMsg,
              retainedPreviousContent: true,
            } as never,
          };
          if (revertIdentity?.name !== undefined) data.name = revertIdentity.name;
          if (revertIdentity?.sourceUrl !== undefined) data.sourceUrl = revertIdentity.sourceUrl;
          if (revertIdentity?.fileHash !== undefined) data.fileHash = revertIdentity.fileHash;
          if (revertIdentity?.size !== undefined) data.size = revertIdentity.size;
          await tx.document.update({ where: { id: docId }, data });
          if (docRow?.uploadedById) {
            await tx.documentActivity.create({
              data: {
                documentId: docId,
                userId: docRow.uploadedById,
                action: "PROCESS_FAILED",
                details: { error: errMsg, stage, retainedPreviousContent: true } as never,
              },
            });
          }
        });
        revalidateSourcePage(docRow?.knowledgeBaseId);
        logger.warn("[Pipeline] Failed update — restored previous known-good content", {
          docId,
          stage,
          error: errMsg,
        });
        return "retained";
      } catch (rollbackErr) {
        logger.error("[Pipeline] Rollback failed", {
          docId,
          error: rollbackErr instanceof Error ? rollbackErr.message : "unknown",
        });
      }
    }
  }

  await prisma.document
    .update({
      where: { id: docId },
      data: {
        status: "ERROR",
        metadata: mergeFailureMetadata(
          docRow?.metadata as Record<string, unknown> | null,
          meta,
          errMsg,
        ) as never,
      },
    })
    .catch(() => {});
  revalidateSourcePage(docRow?.knowledgeBaseId);
  return "error";
}

export async function processDocument(docId: string, fileType: string, existingBuffer?: Buffer, staged?: StagedSwap): Promise<ProcessOutcome> {
  const pipelineStart = Date.now();
  let stage = "init";

  const meta: Record<string, unknown> = {
    stage: "init",
    startedAt: new Date().toISOString(),
    fileType,
    bufferProvided: !!existingBuffer,
  };

  try {
    const doc = await prisma.document.findUnique({
      where: { id: docId },
      select: { id: true, storageKey: true, knowledgeBaseId: true, fileType: true, metadata: true, uploadedById: true, sourceType: true, sourceUrl: true },
    });
    if (!doc) {
      logger.warn("[Init] Document not found, aborting", { docId });
      return { ok: false, error: "Document not found" };
    }

    logger.info("[Init] Starting pipeline", { docId, fileType, hasBuffer: !!existingBuffer });
    stage = "fetch";

    await prisma.document.update({
      where: { id: docId },
      data: { status: "EXTRACTING" },
    });

    let buffer = existingBuffer;

    if (!buffer && doc.storageKey) {
      logger.info("[Download] Fetching from storage via signed URL", { docId });
      const t0 = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        // Objects are authenticated; the public URL is no longer fetchable.
        // Resolve a short-lived signed URL from the trusted DB key instead.
        const signedUrl = await getStorageProvider().getSignedUrl(doc.storageKey);
        const res = await fetch(signedUrl, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText} fetching from storage`);

        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_DOWNLOAD_SIZE) {
          throw new Error(`File too large: ${contentLength} bytes (max: ${MAX_DOWNLOAD_SIZE})`);
        }

        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) {
          throw new Error("Downloaded file is empty (0 bytes)");
        }
        if (arrayBuffer.byteLength > MAX_DOWNLOAD_SIZE) {
          throw new Error(`Downloaded file too large: ${arrayBuffer.byteLength} bytes`);
        }
        buffer = Buffer.from(arrayBuffer);
        logger.info("[Download] Complete", { docId, bytes: buffer.byteLength, ms: Date.now() - t0 });
      } catch (fetchErr) {
        clearTimeout(timeout);
        if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
          throw new Error(`Download timed out after ${FETCH_TIMEOUT_MS / 1000}s`, { cause: fetchErr });
        }
        throw fetchErr;
      }
    } else if (!buffer && doc.sourceType === "URL" && doc.sourceUrl) {
      logger.info("[Download] Re-fetching source URL", { docId, sourceUrl: doc.sourceUrl });
      try {
        const article = await fetchArticle(doc.sourceUrl);
        buffer = Buffer.from(article.markdown, "utf8");
        logger.info("[Download] Source URL fetched", { docId, bytes: buffer.byteLength, chars: article.markdown.length });
      } catch (refetchErr) {
        const reason = refetchErr instanceof Error ? refetchErr.message : "unknown";
        logger.warn("[Download] Source URL re-fetch failed", { docId, reason });
        throw new Error(`Failed to re-fetch source URL: ${reason}`, { cause: refetchErr });
      }
    } else if (!buffer && doc.sourceType === "YOUTUBE" && doc.sourceUrl) {
      logger.info("[Download] Re-fetching YouTube transcript", { docId, sourceUrl: doc.sourceUrl });
      try {
        const transcript = await fetchYouTubeTranscript(doc.sourceUrl);
        buffer = Buffer.from(transcript.text, "utf8");
        logger.info("[Download] YouTube transcript fetched", { docId, bytes: buffer.byteLength, chars: transcript.text.length });
      } catch (refetchErr) {
        const reason = refetchErr instanceof Error ? refetchErr.message : "unknown";
        logger.warn("[Download] YouTube transcript re-fetch failed", { docId, reason });
        throw new Error(`Failed to re-fetch YouTube transcript: ${reason}`, { cause: refetchErr });
      }
    } else if (buffer) {
      logger.info("[Download] Using provided buffer", { docId, bytes: buffer.byteLength });
    }

    if (!buffer) throw new Error("No file data available — no buffer, storage key, or source URL on document");

    stage = "extract";
    logger.info("[Extraction] Converting buffer → ArrayBuffer", {
      docId,
      bufferByteLength: buffer.byteLength,
      bufferByteOffset: buffer.byteOffset,
      underlyingABLength: buffer.buffer.byteLength,
    });

    const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;

    logger.info("[Extraction] Starting extraction", { docId, arrayBufferByteLength: arrayBuffer.byteLength });
    const extraction = await extractText(arrayBuffer, fileType);
    if (!extraction.text.trim()) {
      throw new Error("No readable text was extracted from this document. Scanned PDFs may require OCR before ingestion.");
    }
    logger.info("[Extraction] Success", { docId, chars: extraction.metadata.characters, pages: extraction.metadata.pages });

    const existingMeta = doc.metadata as Record<string, unknown> | null;
    await prisma.document.update({
      where: { id: docId },
      data: {
        metadata: {
          ...(existingMeta || {}),
          extractedChars: extraction.metadata.characters,
          pages: extraction.metadata.pages ?? null,
          rows: extraction.metadata.rows ?? null,
        } as never,
      },
    });

    stage = "chunk";
    await prisma.document.update({
      where: { id: docId },
      data: { status: "CHUNKING" },
    });

    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: doc.knowledgeBaseId },
      select: { retrievalConfig: true },
    });
    const retrievalConfig = (kb?.retrievalConfig as {
      chunkStrategy?: string;
      chunkSize?: number;
      chunkOverlap?: number;
      // Legacy field name written by an older settings UI.
      overlap?: number;
    } | null) || {};
    const tChunk = Date.now();
    const chunks = chunkText(extraction.text, {
      strategy: (retrievalConfig.chunkStrategy as "recursive" | "sentence" | "fixed" | "markdown" | "semantic") || "recursive",
      chunkSize: retrievalConfig.chunkSize ?? 1000,
      overlap: retrievalConfig.chunkOverlap ?? retrievalConfig.overlap ?? 200,
    });
    if (chunks.length === 0) {
      throw new Error("Document extraction produced no indexable chunks");
    }
    logger.info("[Chunking] Complete", { docId, chunks: chunks.length, ms: Date.now() - tChunk });

    stage = "store";
    logger.info("[Database] Writing chunks", { docId, chunkCount: chunks.length });
    const tDb = Date.now();
    await prisma.$transaction(async (tx) => {
      await tx.documentChunk.createMany({
        data: chunks.map((chunk) => ({
          content: chunk.content,
          index: chunk.index,
          tokenCount: chunk.tokenCount,
          metadata: (chunk.metadata || {}) as never,
          documentId: docId,
        })),
      });

      await tx.document.update({
        where: { id: docId },
        data: { status: "EMBEDDING_PENDING" },
      });

      await tx.documentActivity.create({
        data: {
          documentId: docId,
          userId: doc.uploadedById || "",
          action: "PROCESSED",
          details: { chunks: chunks.length, characters: extraction.metadata.characters } as never,
        },
      });
    });
    logger.info("[Database] Write complete", { docId, ms: Date.now() - tDb });

    stage = "embed";
    logger.info("[Embedding] Generating embeddings before completing the job", { docId });
    const stagedEvictIds = staged?.evictChunkIds;
    const embeddingResult = await generateEmbeddings(docId, undefined, stagedEvictIds);

    meta.stage = "completed";
    meta.durationMs = Date.now() - pipelineStart;
    meta.extractedChars = extraction.metadata.characters;
    meta.pages = extraction.metadata.pages;
    meta.chunks = chunks.length;
    meta.embeddedChunks = embeddingResult.chunkCount;
    logger.info("[Completed] Ingestion and indexing finished", { docId, ...meta });
    return { ok: true };
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    const errName = err instanceof Error ? err.name : "Unknown";

    meta.stage = stage;
    meta.error = errMsg;
    meta.errorName = errName;
    meta.timestamp = new Date().toISOString();
    meta.durationMs = Date.now() - pipelineStart;

    logger.error(`[Pipeline] Failed at stage "${stage}"`, {
      docId,
      stage,
      error: errMsg,
      errorName: errName,
      stack: errStack,
      durationMs: meta.durationMs,
    });

    const disposition = await rollbackOrError(docId, staged, meta, errMsg, stage);
    // Failure is now durable in the document row (ERROR + stage metadata).
    return {
      ok: false,
      error: errMsg,
      retainedPreviousContent: disposition === "retained",
    };
  }
}

// URL, YouTube, and pasted-text sources are immutable snapshots once ingested.
// Rebuilding from stored chunks lets retry/reprocess succeed even when the
// third-party page or caption track is gone.
export async function reconstructTextSourceBuffers(documentIds: string[]): Promise<Map<string, Buffer>> {
  const buffers = new Map<string, Buffer>();
  if (documentIds.length === 0) return buffers;

  const rows = await prisma.documentChunk.findMany({
    where: { documentId: { in: documentIds } },
    orderBy: { index: "asc" },
    select: { documentId: true, content: true },
  });
  const partsByDoc = new Map<string, string[]>();
  for (const row of rows) {
    const parts = partsByDoc.get(row.documentId) ?? [];
    parts.push(row.content);
    partsByDoc.set(row.documentId, parts);
  }
  for (const documentId of documentIds) {
    const parts = partsByDoc.get(documentId);
    if (parts && parts.length > 0) {
      buffers.set(documentId, Buffer.from(parts.join("\n\n"), "utf8"));
    }
  }
  return buffers;
}
