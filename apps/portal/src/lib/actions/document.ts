"use server";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { revalidatePath } from "next/cache";
import { getStorageProvider } from "@/lib/storage";
import { extractText } from "@/lib/extraction";
import { chunkText } from "@/lib/chunking";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import { logger } from "@/lib/logger";
import { serverTrackEvent } from "@/lib/telemetry/analytics-server";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeFilename } from "@/lib/validation";
import type { Prisma } from "@prisma/client";

const ALLOWED_EXTENSIONS = ["pdf", "txt", "md", "markdown", "csv", "docx"];

const MIME_MAP: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "text/csv": "csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_DOWNLOAD_SIZE = 15 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 60_000;
const MAX_BULK_OPERATIONS = 50;

function getFileType(name: string, mime: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  if (ALLOWED_EXTENSIONS.includes(ext)) return ext;
  return MIME_MAP[mime] || ext;
}

function fileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

async function getOrgFromKb(kbId: string, userId: string) {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: {
      project: {
        select: {
          organization: {
            select: {
              members: {
                where: { userId },
                select: { id: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!kb || kb.project.organization.members.length === 0) {
    throw new Error("Knowledge base not found");
  }

  return kb;
}

async function assertDocAccess(docId: string, userId: string) {
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    select: {
      id: true,
      name: true,
      fileType: true,
      size: true,
      fileHash: true,
      status: true,
      storageUrl: true,
      storageKey: true,
      storageProvider: true,
      metadata: true,
      knowledgeBaseId: true,
      uploadedById: true,
      createdAt: true,
      updatedAt: true,
      uploadedBy: { select: { id: true, name: true, image: true } },
      _count: { select: { chunks: true, versions: true, activities: true } },
    },
  });

  if (!doc) throw new Error("Document not found");

  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: doc.knowledgeBaseId },
    select: {
      project: {
        select: {
          organization: {
            select: {
              members: { where: { userId }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!kb || kb.project.organization.members.length === 0) {
    throw new Error("Document not found");
  }

  return doc;
}

async function logActivity(
  documentId: string,
  userId: string,
  action: string,
  details?: Record<string, unknown>,
) {
  try {
    await prisma.documentActivity.create({
      data: { documentId, userId, action, details: (details || {}) as never },
    });
  } catch {
    // Activity logging failure should not fail the user operation
  }
}

export async function uploadDocument(kbId: string, formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const rl = rateLimit(`upload:${session.user.id}`, RATE_LIMITS.upload);
  if (!rl.allowed) throw new Error("Rate limit exceeded. Please try again later.");

  await getOrgFromKb(kbId, session.user.id);

  const files = formData.getAll("files") as File[];
  if (files.length === 0) throw new Error("No files provided");

  // Phase 1 — Validate all files before uploading any
  const fileEntries: { file: File; buffer: Buffer; fileType: string; hash: string }[] = [];

  for (const file of files) {
    const fileType = getFileType(file.name, file.type);
    if (!ALLOWED_EXTENSIONS.includes(fileType)) {
      throw new Error(`File type "${fileType}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`);
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`"${file.name}" exceeds the 10MB size limit`);
    }

    if (file.size === 0) {
      throw new Error(`"${file.name}" is empty`);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = fileHash(buffer);

    const existing = await prisma.document.findFirst({
      where: { knowledgeBaseId: kbId, fileHash: hash },
      select: { id: true, name: true },
    });

    if (existing) {
      throw new Error(`"${file.name}" is a duplicate of "${existing.name}" (same content)`);
    }

    fileEntries.push({ file, buffer, fileType, hash });
  }

  // Phase 2 — Upload and create records
  const storage = getStorageProvider();
  const results: Prisma.DocumentGetPayload<{ include: { uploadedBy: true } }>[] = [];

  for (const { file, buffer, fileType, hash } of fileEntries) {
    const ext = file.name.split(".").pop() || "";
    const safeName = sanitizeFilename(file.name.replace(`.${ext}`, ""));
    const storageKey = `${kbId}/${Date.now()}-${safeName}`;

    const stored = await storage.upload(buffer, file.name, storageKey);

    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: {
          name: file.name,
          fileType,
          size: file.size,
          fileHash: hash,
          storageProvider: stored.provider,
          storageKey: stored.key,
          storageUrl: stored.url,
          status: "STORED",
          knowledgeBaseId: kbId,
          uploadedById: session.user.id,
          metadata: { mimeType: file.type, extension: ext },
        },
        include: { uploadedBy: true },
      });

      await tx.documentVersion.create({
        data: {
          version: 1,
          fileType,
          size: file.size,
          storageKey: stored.key,
          storageUrl: stored.url,
          documentId: created.id,
          uploadedById: session.user.id,
          metadata: { mimeType: file.type, fileHash: hash },
        },
      });

      await tx.documentActivity.create({
        data: {
          documentId: created.id,
          userId: session.user.id,
          action: "UPLOADED",
          details: { fileName: file.name, fileType, size: file.size, fileHash: hash } as never,
        },
      });

      return created;
    });

    results.push(doc);

    // Fire-and-forget processing
    processDocument(doc.id, fileType, buffer).catch((err) => {
      logger.error(`Processing failed for ${doc.id}`, { error: err instanceof Error ? err.message : "unknown" });
    });
  }

  serverTrackEvent("documents_uploaded", { count: results.length, kbId }, session.user.id);
  revalidatePath(`/app/knowledge-bases/${kbId}`);
  return results;
}

async function processDocument(docId: string, fileType: string, existingBuffer?: Buffer) {
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
      select: { id: true, storageUrl: true, knowledgeBaseId: true, fileType: true, metadata: true, uploadedById: true },
    });
    if (!doc) {
      logger.warn("[Init] Document not found, aborting", { docId });
      return;
    }

    logger.info("[Init] Starting pipeline", { docId, fileType, hasBuffer: !!existingBuffer });
    stage = "fetch";

    await prisma.document.update({
      where: { id: docId },
      data: { status: "EXTRACTING" },
    });

    let buffer = existingBuffer;

    if (!buffer && doc.storageUrl) {
      logger.info("[Download] Fetching from storage", { docId, storageUrl: doc.storageUrl });
      const t0 = Date.now();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(doc.storageUrl, { signal: controller.signal });
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
    } else if (buffer) {
      logger.info("[Download] Using provided buffer", { docId, bytes: buffer.byteLength });
    }

    if (!buffer) throw new Error("No file data available — no buffer provided and no storageUrl on document");

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
    const retrievalConfig = (kb?.retrievalConfig as { chunkStrategy?: string; chunkSize?: number; overlap?: number } | null) || {};
    const tChunk = Date.now();
    const chunks = chunkText(extraction.text, {
      strategy: (retrievalConfig.chunkStrategy as "recursive" | "sentence" | "fixed" | "markdown" | "semantic") || "recursive",
      chunkSize: retrievalConfig.chunkSize ?? 1000,
      overlap: retrievalConfig.overlap ?? 200,
    });
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
    logger.info("[Embedding] Queuing embedding generation (fire-and-forget)", { docId });
    generateEmbeddings(docId).catch((embedErr) => {
      const errMsg = embedErr instanceof Error ? embedErr.message : String(embedErr);
      const errStack = embedErr instanceof Error ? embedErr.stack : undefined;
      logger.error("[Embedding] Failed", { docId, error: errMsg, stack: errStack });

      prisma.document.update({
        where: { id: docId },
        data: {
          status: "ERROR",
          metadata: {
            ...meta,
            stage: "embed",
            error: errMsg,
            stack: errStack ?? null,
            timestamp: new Date().toISOString(),
            durationMs: Date.now() - pipelineStart,
          } as never,
        },
      }).catch(() => {});
    });

    meta.stage = "completed";
    meta.durationMs = Date.now() - pipelineStart;
    meta.extractedChars = extraction.metadata.characters;
    meta.pages = extraction.metadata.pages;
    meta.chunks = chunks.length;
    logger.info("[Completed] Pipeline finished", { docId, ...meta });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const errStack = err instanceof Error ? err.stack : undefined;
    const errName = err instanceof Error ? err.name : "Unknown";

    meta.stage = stage;
    meta.error = errMsg;
    meta.errorName = errName;
    meta.stack = errStack ?? null;
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

    await prisma.document.update({
      where: { id: docId },
      data: { status: "ERROR", metadata: meta as never },
    }).catch(() => {});
  }
}

export async function listDocuments(kbId: string) {
  const session = await getServerSession();
  if (!session) return [];

  await getOrgFromKb(kbId, session.user.id);

  return prisma.document.findMany({
    where: { knowledgeBaseId: kbId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      fileType: true,
      size: true,
      status: true,
      storageUrl: true,
      createdAt: true,
      metadata: true,
      uploadedBy: { select: { id: true, name: true, image: true } },
      _count: { select: { chunks: true } },
    },
  });
}

export async function getDocument(docId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");
  return assertDocAccess(docId, session.user.id);
}

export async function renameDocument(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const id = formData.get("id")?.toString();
  const name = formData.get("name")?.toString();

  if (!id || !name?.trim()) throw new Error("Invalid input");
  if (name.length > 255) throw new Error("Name is too long");

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, name: true, knowledgeBaseId: true },
  });
  if (!doc) throw new Error("Document not found");
  await getOrgFromKb(doc.knowledgeBaseId, session.user.id);

  const updated = await prisma.document.update({
    where: { id },
    data: { name: name.trim() },
    select: { id: true, name: true },
  });

  await logActivity(id, session.user.id, "RENAMED", { oldName: doc.name, newName: name.trim() });
  revalidatePath(`/app/knowledge-bases/${doc.knowledgeBaseId}`);

  return updated;
}

export async function deleteDocument(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const id = formData.get("id")?.toString();
  if (!id) throw new Error("ID is required");

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, name: true, knowledgeBaseId: true, storageKey: true },
  });
  if (!doc) throw new Error("Document not found");
  await getOrgFromKb(doc.knowledgeBaseId, session.user.id);

  await logActivity(id, session.user.id, "DELETED", { fileName: doc.name });

  const storage = getStorageProvider();
  storage.delete(doc.storageKey).catch(() => {});

  await prisma.document.delete({ where: { id } });

  revalidatePath(`/app/knowledge-bases/${doc.knowledgeBaseId}`);
}

export async function reprocessDocument(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const id = formData.get("id")?.toString();
  if (!id) throw new Error("ID is required");

  const doc = await prisma.document.findUnique({
    where: { id },
    select: { id: true, name: true, knowledgeBaseId: true, fileType: true },
  });
  if (!doc) throw new Error("Document not found");
  await getOrgFromKb(doc.knowledgeBaseId, session.user.id);

  await prisma.$transaction(async (tx) => {
    await tx.documentChunk.deleteMany({ where: { documentId: id } });
    await tx.document.update({
      where: { id },
      data: { status: "QUEUED" },
    });
  });

  await logActivity(id, session.user.id, "REPROCESSED", { fileName: doc.name });

  processDocument(id, doc.fileType).catch((err) => {
    logger.error(`Reprocessing failed for ${id}`, { error: err instanceof Error ? err.message : "unknown" });
  });

  revalidatePath(`/app/knowledge-bases/${doc.knowledgeBaseId}`);
  return { ...doc, status: "QUEUED" as const };
}

export async function bulkDeleteDocuments(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const ids = formData.getAll("ids") as string[];
  if (ids.length === 0) throw new Error("No documents selected");
  if (ids.length > MAX_BULK_OPERATIONS) throw new Error(`Cannot delete more than ${MAX_BULK_OPERATIONS} documents at once`);

  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true, knowledgeBaseId: true, name: true, storageKey: true, storageProvider: true },
  });

  if (docs.length === 0) throw new Error("No documents found");

  await getOrgFromKb(docs[0].knowledgeBaseId, session.user.id);

  const storage = getStorageProvider();
  for (const doc of docs) {
    storage.delete(doc.storageKey).catch(() => {});
  }

  await prisma.$transaction([
    prisma.documentActivity.createMany({
      data: docs.map((doc) => ({
        documentId: doc.id,
        userId: session.user.id,
        action: "DELETED",
        details: { fileName: doc.name },
      })),
    }),
    prisma.document.deleteMany({ where: { id: { in: ids } } }),
  ]);

  revalidatePath(`/app/knowledge-bases/${docs[0].knowledgeBaseId}`);
}

export async function bulkReprocessDocuments(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const ids = formData.getAll("ids") as string[];
  if (ids.length === 0) throw new Error("No documents selected");
  if (ids.length > MAX_BULK_OPERATIONS) throw new Error(`Cannot reprocess more than ${MAX_BULK_OPERATIONS} documents at once`);

  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true, knowledgeBaseId: true, fileType: true, name: true },
  });

  if (docs.length === 0) throw new Error("No documents found");

  await getOrgFromKb(docs[0].knowledgeBaseId, session.user.id);

  await prisma.$transaction(async (tx) => {
    for (const doc of docs) {
      await tx.documentChunk.deleteMany({ where: { documentId: doc.id } });
      await tx.document.update({
        where: { id: doc.id },
        data: { status: "QUEUED" },
      });
      await tx.documentActivity.create({
        data: {
          documentId: doc.id,
          userId: session.user.id,
          action: "REPROCESSED",
          details: { fileName: doc.name },
        },
      });
    }
  });

  for (const doc of docs) {
    processDocument(doc.id, doc.fileType).catch((err) => {
      logger.error(`Bulk reprocess failed for ${doc.id}`, { error: err instanceof Error ? err.message : "unknown" });
    });
  }

  revalidatePath(`/app/knowledge-bases/${docs[0].knowledgeBaseId}`);
}

export async function getDocumentPreviewContent(docId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const doc = await assertDocAccess(docId, session.user.id);

  const chunkCount = await prisma.documentChunk.count({
    where: { documentId: docId },
  });

  let content: string | null = null;
  let type: "pdf" | "docx" | "csv" | "text" | "markdown" = "text";

  if (doc.fileType === "pdf") type = "pdf";
  else if (doc.fileType === "docx") type = "docx";
  else if (doc.fileType === "csv") type = "csv";
  else if (doc.fileType === "md" || doc.fileType === "markdown") type = "markdown";

  if (chunkCount > 0) {
    const MAX_PREVIEW_CHARS = 200_000;
    const allContent = await prisma.documentChunk.findMany({
      where: { documentId: docId },
      orderBy: { index: "asc" },
      select: { content: true },
    });
    let charCount = 0;
    const parts: string[] = [];
    for (const chunk of allContent) {
      if (charCount + chunk.content.length > MAX_PREVIEW_CHARS) {
        parts.push(chunk.content.slice(0, MAX_PREVIEW_CHARS - charCount));
        break;
      }
      parts.push(chunk.content);
      charCount += chunk.content.length;
    }
    content = parts.join("\n\n");
  }

  return {
    content,
    chunkCount,
    status: doc.status,
    fileType: doc.fileType,
    storageUrl: doc.storageUrl,
    type,
    metadata: doc.metadata as Record<string, unknown> | null,
    uploadedBy: doc.uploadedBy?.name || "Unknown",
    createdAt: doc.createdAt.toISOString(),
    size: doc.size,
  };
}

export async function getDocumentDetails(docId: string) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const doc = await assertDocAccess(docId, session.user.id);

  const [chunks, versions, activities] = await Promise.all([
    prisma.documentChunk.findMany({
      where: { documentId: docId },
      orderBy: { index: "asc" },
      include: {
        embedding: {
          select: { id: true, model: true, dimensions: true, status: true, createdAt: true },
        },
      },
    }),
    prisma.documentVersion.findMany({
      where: { documentId: docId },
      orderBy: { version: "desc" },
      include: {
        uploadedBy: { select: { id: true, name: true, image: true } },
      },
    }),
    prisma.documentActivity.findMany({
      where: { documentId: docId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        user: { select: { id: true, name: true, image: true } },
      },
    }),
  ]);

  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: doc.knowledgeBaseId },
    select: { id: true, name: true, projectId: true },
  });

  return {
    ...doc,
    metadata: doc.metadata as Record<string, unknown> | null,
    knowledgeBase: kb || { id: doc.knowledgeBaseId, name: "Unknown", projectId: "" },
    chunks: chunks.map((c) => ({
      ...c,
      metadata: c.metadata as Record<string, unknown> | null,
    })),
    versions: versions.map((v) => ({
      ...v,
      metadata: v.metadata as Record<string, unknown> | null,
    })),
    activities: activities.map((a) => ({
      ...a,
      details: a.details as Record<string, unknown> | null,
    })),
  };
}

export async function updateDocumentMetadata(docId: string, metadata: Record<string, unknown>) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  await assertDocAccess(docId, session.user.id);

  const updated = await prisma.document.update({
    where: { id: docId },
    data: { metadata: metadata as never },
    select: { id: true, metadata: true },
  });

  await logActivity(docId, session.user.id, "METADATA_UPDATED", { fields: Object.keys(metadata) });
  revalidatePath(`/app/knowledge-bases`);

  return updated;
}
