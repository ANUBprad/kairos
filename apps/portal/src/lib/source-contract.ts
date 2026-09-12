import type { DocumentSourceType, DocumentStatus, Prisma } from "@prisma/client";

export const SOURCE_TYPE_VALUES: ReadonlyArray<DocumentSourceType> = ["FILE", "TEXT", "URL", "YOUTUBE"];

export const SOURCE_STATUS_VALUES: ReadonlyArray<DocumentStatus> = [
  "QUEUED",
  "UPLOADING",
  "STORED",
  "EXTRACTING",
  "CHUNKING",
  "EMBEDDING_PENDING",
  "EMBEDDING",
  "INDEXED",
  "READY",
  "ERROR",
];

export interface SourceListFilters {
  sourceType?: string;
  status?: string;
}

export interface SourceListItem {
  id: string;
  name: string;
  sourceType: DocumentSourceType;
  sourceUrl: string | null;
  fileType: string;
  size: number | null;
  status: DocumentStatus;
  storageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  metadata: unknown;
  uploadedBy: { id: string; name: string | null; image: string | null } | null;
  _count: { chunks: number };
}

export function parseSourceTypeFilter(value: string | undefined): DocumentSourceType | undefined {
  if (value === undefined || value === "") return undefined;
  if (!SOURCE_TYPE_VALUES.includes(value as DocumentSourceType)) {
    throw new Error("Invalid source type filter");
  }
  return value as DocumentSourceType;
}

export function parseStatusFilter(value: string | undefined): DocumentStatus | undefined {
  if (value === undefined || value === "") return undefined;
  if (!SOURCE_STATUS_VALUES.includes(value as DocumentStatus)) {
    throw new Error("Invalid status filter");
  }
  return value as DocumentStatus;
}

export function resolveSourceListOrder(): Array<{ createdAt: "desc" } | { id: "desc" }> {
  return [{ createdAt: "desc" }, { id: "desc" }];
}

export function resolveSourceWhere(kbId: string, filters?: SourceListFilters): Prisma.DocumentWhereInput {
  const where: Prisma.DocumentWhereInput = { knowledgeBaseId: kbId };
  const sourceType = parseSourceTypeFilter(filters?.sourceType);
  const status = parseStatusFilter(filters?.status);
  if (sourceType) where.sourceType = sourceType;
  if (status) where.status = status;
  return where;
}

export function assertSameKnowledgeBase(docs: { knowledgeBaseId: string }[]): string {
  if (docs.length === 0) throw new Error("No documents found");
  const kbId = docs[0].knowledgeBaseId;
  if (docs.some((doc) => doc.knowledgeBaseId !== kbId)) {
    throw new Error("All documents must belong to the same knowledge base");
  }
  return kbId;
}