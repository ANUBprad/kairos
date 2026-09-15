import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";

export const MAX_TEXT_CHARS = 200_000;
export const MAX_TEXT_TITLE_CHARS = 255;

export interface NormalizedTextInput {
  name: string;
  title: string;
  content: string;
}

export function normalizeTextInput(title: string, content: string): NormalizedTextInput {
  const trimmedTitle = title.trim();
  const trimmedContent = content.trim();

  if (!trimmedContent) {
    throw new Error("Text source cannot be empty");
  }
  if (trimmedContent.length > MAX_TEXT_CHARS) {
    throw new Error(`Text source is too large (max ${MAX_TEXT_CHARS.toLocaleString("en-US")} characters)`);
  }
  if (trimmedTitle.length > MAX_TEXT_TITLE_CHARS) {
    throw new Error(`Title is too long (max ${MAX_TEXT_TITLE_CHARS} characters)`);
  }

  const firstLine =
    trimmedContent
      .split("\n")
      .map((line) => line.trim())
      .find((line) => line.length > 0) || "";
  const fallbackName = firstLine ? firstLine.slice(0, 80) : "Untitled text note";

  return {
    name: (trimmedTitle || fallbackName).slice(0, MAX_TEXT_TITLE_CHARS),
    title: trimmedTitle,
    content: trimmedContent,
  };
}

export function textDocumentFileHash(title: string, content: string): string {
  return createHash("sha256").update(`${title}\n${content}`, "utf8").digest("hex");
}

export function buildTextDocumentData(params: {
  kbId: string;
  userId: string;
  title: string;
  content: string;
}): Prisma.DocumentUncheckedCreateInput {
  const normalized = normalizeTextInput(params.title, params.content);
  const buffer = Buffer.from(normalized.content, "utf8");
  return {
    name: normalized.name,
    fileType: "txt",
    size: buffer.byteLength,
    fileHash: textDocumentFileHash(normalized.title, normalized.content),
    sourceType: "TEXT",
    sourceUrl: null,
    status: "STORED",
    storageProvider: null,
    storageKey: null,
    storageUrl: null,
    knowledgeBaseId: params.kbId,
    uploadedById: params.userId,
    metadata: {
      mimeType: "text/plain",
      source: "text",
      title: normalized.title,
    },
  };
}