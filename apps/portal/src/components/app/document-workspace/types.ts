export type DocumentStatus =
  | "QUEUED"
  | "UPLOADING"
  | "STORED"
  | "EXTRACTING"
  | "CHUNKING"
  | "EMBEDDING_PENDING"
  | "EMBEDDING"
  | "INDEXED"
  | "READY"
  | "ERROR";

export interface DocumentMetadata {
  mimeType?: string;
  extension?: string;
  extractedChars?: number;
  pages?: number;
  rows?: number;
  stage?: string;
  error?: string;
  stack?: string;
  durationMs?: number;
  startedAt?: string;
  timestamp?: string;
  [key: string]: unknown;
}

export interface DocumentVersion {
  id: string;
  version: number;
  fileType: string;
  size: number;
  storageKey: string;
  storageUrl: string | null;
  metadata: Record<string, unknown> | null;
  changeNote: string | null;
  createdAt: Date;
  uploadedBy: { id: string; name: string | null; image: string | null } | null;
}

export interface DocumentActivity {
  id: string;
  action: string;
  details: Record<string, unknown> | null;
  createdAt: Date;
  user: { id: string; name: string | null; image: string | null } | null;
}

export interface DocumentChunkData {
  id: string;
  content: string;
  index: number;
  tokenCount: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  embedding?: {
    id: string;
    model: string;
    dimensions: number;
    status: string;
    createdAt: Date;
  } | null;
}

export interface DocumentWithDetails {
  id: string;
  name: string;
  fileType: string;
  size: number;
  fileHash: string | null;
  storageProvider: string;
  storageKey: string;
  storageUrl: string | null;
  metadata: DocumentMetadata | null;
  status: DocumentStatus;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: { id: string; name: string | null; image: string | null } | null;
  knowledgeBase: {
    id: string;
    name: string;
    projectId: string;
  };
  _count: {
    chunks: number;
    versions: number;
    activities: number;
  };
}

export interface DocumentWithDetailsAndRelations extends DocumentWithDetails {
  chunks: DocumentChunkData[];
  versions: DocumentVersion[];
  activities: DocumentActivity[];
}

export interface ProcessingStage {
  id: string;
  label: string;
  status: "completed" | "active" | "pending" | "error" | "skipped";
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  error?: string;
  logs?: string[];
}

export interface KbStats {
  totalDocuments: number;
  totalChunks: number;
  totalSize: number;
  statusBreakdown: Record<DocumentStatus, number>;
  avgChunksPerDoc: number;
  lastUploadAt: string | null;
}
