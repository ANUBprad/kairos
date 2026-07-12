"use server";

import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "@/lib/server/auth-utils";
import { revalidatePath } from "next/cache";
import { getStorageProvider } from "@/lib/storage";
import { extractText } from "@/lib/extraction";
import { chunkText } from "@/lib/chunking";
import { generateEmbeddings } from "@/lib/ai/embeddings";
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
      _count: { select: { chunks: true } },
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
  await prisma.documentActivity.create({
    data: { documentId, userId, action, details: (details || {}) as never },
  });
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

    const doc = await prisma.document.create({
      data: {
        name: file.name,
        fileType,
        size: file.size,
        fileHash: hash,
        storageProvider: stored.provider,
        storageKey: stored.key,
        storageUrl: stored.url,
        status: "UPLOADING",
        knowledgeBaseId: kbId,
        uploadedById: session.user.id,
        metadata: { mimeType: file.type, extension: ext },
      },
      include: { uploadedBy: true },
    });

    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "STORED" },
    });

    await prisma.documentVersion.create({
      data: {
        version: 1,
        fileType,
        size: file.size,
        storageKey: stored.key,
        storageUrl: stored.url,
        documentId: doc.id,
        uploadedById: session.user.id,
        metadata: { mimeType: file.type, fileHash: hash },
      },
    });

    await logActivity(doc.id, session.user.id, "UPLOADED", {
      fileName: file.name,
      fileType,
      size: file.size,
      fileHash: hash,
    });

    results.push(doc);

    // Fire-and-forget processing
    processDocument(doc.id, fileType, buffer).catch((err) => {
      console.error(`Processing failed for ${doc.id}:`, err);
    });
  }

  revalidatePath(`/app/knowledge-bases/${kbId}`);
  return results;
}

async function processDocument(docId: string, fileType: string, existingBuffer?: Buffer) {
  try {
    const doc = await prisma.document.findUnique({ where: { id: docId } });
    if (!doc) return;

    await prisma.document.update({
      where: { id: docId },
      data: { status: "EXTRACTING" },
    });

    let buffer = existingBuffer;

    if (!buffer && doc.storageUrl) {
      const res = await fetch(doc.storageUrl);
      if (!res.ok) throw new Error(`Failed to fetch file from storage: ${res.statusText}`);
      const arrayBuffer = await res.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    }

    if (!buffer) throw new Error("No file data available for processing");

    const extraction = await extractText(buffer.buffer.slice(0), fileType);

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

    await prisma.document.update({
      where: { id: docId },
      data: { status: "CHUNKING" },
    });

    const kb = await prisma.knowledgeBase.findUnique({
      where: { id: doc.knowledgeBaseId },
      select: { retrievalConfig: true },
    });
    const retrievalConfig = (kb?.retrievalConfig as { chunkStrategy?: string; chunkSize?: number; overlap?: number } | null) || {};
    const chunks = chunkText(extraction.text, {
      strategy: (retrievalConfig.chunkStrategy as "recursive" | "sentence" | "fixed" | "markdown" | "semantic") || "recursive",
      chunkSize: retrievalConfig.chunkSize ?? 1000,
      overlap: retrievalConfig.overlap ?? 200,
    });

    for (const chunk of chunks) {
      await prisma.documentChunk.create({
        data: {
          content: chunk.content,
          index: chunk.index,
          tokenCount: chunk.tokenCount,
          metadata: (chunk.metadata || {}) as never,
          documentId: docId,
        },
      });
    }

    await prisma.document.update({
      where: { id: docId },
      data: { status: "EMBEDDING_PENDING" },
    });

    await logActivity(docId, doc.uploadedById || "", "PROCESSED", {
      chunks: chunks.length,
      characters: extraction.metadata.characters,
    });

    // Fire-and-forget embedding generation
    generateEmbeddings(docId).catch((embedErr) => {
      console.error(`Embedding failed for ${docId}:`, embedErr);
    });
  } catch (err) {
    console.error(`Processing error for ${docId}:`, err);
    await prisma.document.update({
      where: { id: docId },
      data: { status: "ERROR" },
    }).catch(() => {});
  } finally {
    revalidatePath(`/app`);
  }
}

export async function listDocuments(kbId: string) {
  const session = await getServerSession();
  if (!session) return [];

  await getOrgFromKb(kbId, session.user.id);

  return prisma.document.findMany({
    where: { knowledgeBaseId: kbId },
    orderBy: { createdAt: "desc" },
    include: {
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

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new Error("Document not found");
  await getOrgFromKb(doc.knowledgeBaseId, session.user.id);

  const updated = await prisma.document.update({
    where: { id },
    data: { name: name.trim() },
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

  const doc = await prisma.document.findUnique({ where: { id } });
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

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc) throw new Error("Document not found");
  await getOrgFromKb(doc.knowledgeBaseId, session.user.id);

  await prisma.documentChunk.deleteMany({ where: { documentId: id } });

  const updated = await prisma.document.update({
    where: { id },
    data: { status: "QUEUED" },
  });

  await logActivity(id, session.user.id, "REPROCESSED", { fileName: doc.name });

  processDocument(id, doc.fileType).catch((err) => {
    console.error(`Reprocessing failed for ${id}:`, err);
  });

  revalidatePath(`/app/knowledge-bases/${doc.knowledgeBaseId}`);
  return updated;
}

export async function bulkDeleteDocuments(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const ids = formData.getAll("ids") as string[];
  if (ids.length === 0) throw new Error("No documents selected");

  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true, knowledgeBaseId: true, name: true, storageKey: true, storageProvider: true },
  });

  if (docs.length === 0) throw new Error("No documents found");

  await getOrgFromKb(docs[0].knowledgeBaseId, session.user.id);

  const storage = getStorageProvider();
  for (const doc of docs) {
    await logActivity(doc.id, session.user.id, "DELETED", { fileName: doc.name });
    storage.delete(doc.storageKey).catch(() => {});
  }

  await prisma.document.deleteMany({ where: { id: { in: ids } } });

  revalidatePath(`/app/knowledge-bases/${docs[0].knowledgeBaseId}`);
}

export async function bulkReprocessDocuments(formData: FormData) {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  const ids = formData.getAll("ids") as string[];
  if (ids.length === 0) throw new Error("No documents selected");

  const docs = await prisma.document.findMany({
    where: { id: { in: ids } },
    select: { id: true, knowledgeBaseId: true, fileType: true, name: true },
  });

  if (docs.length === 0) throw new Error("No documents found");

  await getOrgFromKb(docs[0].knowledgeBaseId, session.user.id);

  for (const doc of docs) {
    await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });
    await prisma.document.update({
      where: { id: doc.id },
      data: { status: "QUEUED" },
    });
    await logActivity(doc.id, session.user.id, "REPROCESSED", { fileName: doc.name });

    processDocument(doc.id, doc.fileType).catch((err) => {
      console.error(`Bulk reprocess failed for ${doc.id}:`, err);
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
    const allContent = await prisma.documentChunk.findMany({
      where: { documentId: docId },
      orderBy: { index: "asc" },
      select: { content: true },
    });
    content = allContent.map((c) => c.content).join("\n\n");
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
