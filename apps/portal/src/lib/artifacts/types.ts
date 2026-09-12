import { isValidEntityId } from "@/lib/validation";
import type { ArtifactType, ArtifactStatus, Prisma } from "@prisma/client";

export const ARTIFACT_TYPE_VALUES: ReadonlyArray<ArtifactType> = [
  "SUMMARY",
  "REPORT",
  "QUIZ",
  "FLASHCARDS",
  "MINDMAP",
  "TAKEAWAYS",
  "PODCAST",
];

export const ARTIFACT_STATUS_VALUES: ReadonlyArray<ArtifactStatus> = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
];

export function parseArtifactType(value: string | undefined | null): ArtifactType {
  if (value && (ARTIFACT_TYPE_VALUES as readonly string[]).includes(value)) {
    return value as ArtifactType;
  }
  throw new Error("Invalid artifact type");
}

export function parseArtifactStatus(value: string | undefined | null): ArtifactStatus {
  if (value && (ARTIFACT_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as ArtifactStatus;
  }
  throw new Error("Invalid artifact status");
}

const STATUS_TRANSITIONS: Readonly<Record<ArtifactStatus, ReadonlyArray<ArtifactStatus>>> = {
  PENDING: ["PROCESSING"],
  PROCESSING: ["COMPLETED", "FAILED"],
  COMPLETED: [],
  FAILED: [],
};

export function canTransitionArtifactStatus(from: ArtifactStatus, to: ArtifactStatus): boolean {
  return STATUS_TRANSITIONS[from].includes(to);
}

// Snapshot of the exact document scope an artifact was generated from.
// Returns a fresh, deduped array of valid ids (order preserved) so the stored
// snapshot never aliases caller-owned arrays or carries junk ids.
export function normalizeArtifactSourceIds(ids: readonly unknown[]): string[] {
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const id of ids) {
    if (typeof id === "string" && isValidEntityId(id) && !seen.has(id)) {
      seen.add(id);
      valid.push(id);
    }
  }
  return valid;
}

export interface CreateLearningArtifactInput {
  knowledgeBaseId: string;
  type: ArtifactType;
  sourceIds: string[];
  name?: string;
  status?: ArtifactStatus;
  content?: Prisma.InputJsonValue;
  metadata?: Prisma.InputJsonValue;
  schemaVersion?: number;
  createdById?: string;
}

export interface ListLearningArtifactsFilters {
  type?: ArtifactType;
  status?: ArtifactStatus;
}

export interface LearningArtifactRow {
  id: string;
  type: ArtifactType;
  status: ArtifactStatus;
  name: string | null;
  schemaVersion: number;
  sourceIds: string[];
  content: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  knowledgeBaseId: string;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LearningArtifactData {
  id: string;
  knowledgeBaseId: string;
  type: ArtifactType;
  status: ArtifactStatus;
  name: string | null;
  sourceIds: string[];
  schemaVersion: number;
  content: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
  createdById: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Persistence rows are never returned to callers directly; map through this so
// artifact code depends on the DTO shape, not on Prisma row layout. sourceIds
// is copied so the DTO never aliases the persisted array.
export function toLearningArtifactData(row: LearningArtifactRow): LearningArtifactData {
  return {
    id: row.id,
    knowledgeBaseId: row.knowledgeBaseId,
    type: row.type,
    status: row.status,
    name: row.name,
    sourceIds: [...row.sourceIds],
    schemaVersion: row.schemaVersion,
    content: row.content,
    metadata: row.metadata,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Artifacts are authorized through their KnowledgeBase; an artifact id alone
// must never authorize a cross-workspace read/write.
export function artifactBelongsToKb(artifact: { knowledgeBaseId: string }, kbId: string): boolean {
  return artifact.knowledgeBaseId === kbId;
}