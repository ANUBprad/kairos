import { prisma } from "@/lib/prisma";
import type { ArtifactStatus, Prisma } from "@prisma/client";
import {
  canTransitionArtifactStatus,
  normalizeArtifactSourceIds,
  toLearningArtifactData,
  type CreateLearningArtifactInput,
  type LearningArtifactData,
  type ListLearningArtifactsFilters,
} from "./types";

export async function createLearningArtifact(
  input: CreateLearningArtifactInput,
): Promise<LearningArtifactData> {
  const artifact = await prisma.learningArtifact.create({
    data: {
      knowledgeBaseId: input.knowledgeBaseId,
      type: input.type,
      status: input.status ?? "PENDING",
      name: input.name ?? null,
      sourceIds: normalizeArtifactSourceIds(input.sourceIds),
      content: input.content,
      metadata: input.metadata,
      schemaVersion: input.schemaVersion ?? 1,
      createdById: input.createdById ?? null,
    },
  });
  return toLearningArtifactData(artifact);
}

export async function getLearningArtifact(id: string): Promise<LearningArtifactData | null> {
  const artifact = await prisma.learningArtifact.findUnique({ where: { id } });
  return artifact ? toLearningArtifactData(artifact) : null;
}

// Workspace-scoped read. The artifact id alone must never authorize a read —
// the knowledge base acts as the tenant boundary, so a cross-KB id resolves
// to "missing" rather than leaking a foreign artifact.
export async function getLearningArtifactInKb(
  id: string,
  knowledgeBaseId: string,
): Promise<LearningArtifactData | null> {
  const artifact = await prisma.learningArtifact.findFirst({
    where: { id, knowledgeBaseId },
  });
  return artifact ? toLearningArtifactData(artifact) : null;
}

export async function listLearningArtifacts(
  knowledgeBaseId: string,
  filters: ListLearningArtifactsFilters = {},
): Promise<LearningArtifactData[]> {
  const artifacts = await prisma.learningArtifact.findMany({
    where: {
      knowledgeBaseId,
      ...(filters.type ? { type: filters.type } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return artifacts.map(toLearningArtifactData);
}

export async function updateLearningArtifactStatus(
  id: string,
  status: ArtifactStatus,
): Promise<LearningArtifactData> {
  const existing = await prisma.learningArtifact.findUnique({
    where: { id },
    select: { status: true },
  });
  if (!existing) {
    throw new Error("Learning artifact not found");
  }
  if (!canTransitionArtifactStatus(existing.status, status)) {
    throw new Error(`Cannot transition artifact from ${existing.status} to ${status}`);
  }
  const updated = await prisma.learningArtifact.update({ where: { id }, data: { status } });
  return toLearningArtifactData(updated);
}

export async function updateLearningArtifactContent(
  id: string,
  content: Prisma.InputJsonValue,
  options?: { metadata?: Prisma.InputJsonValue; schemaVersion?: number },
): Promise<LearningArtifactData> {
  const updated = await prisma.learningArtifact.update({
    where: { id },
    data: {
      content,
      ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
      ...(options?.schemaVersion !== undefined ? { schemaVersion: options.schemaVersion } : {}),
    },
  });
  return toLearningArtifactData(updated);
}

// Atomically persists the final payload and transitions to COMPLETED in a
// single guarded UPDATE, so a concurrent writer can never clobber an artifact
// that is no longer mid-generation (already COMPLETED or FAILED).
export async function completeLearningArtifact(
  id: string,
  content: Prisma.InputJsonValue,
  options?: { metadata?: Prisma.InputJsonValue; schemaVersion?: number },
): Promise<LearningArtifactData> {
  const updated = await prisma.learningArtifact.updateMany({
    where: { id, status: "PROCESSING" },
    data: {
      status: "COMPLETED",
      content,
      ...(options?.metadata !== undefined ? { metadata: options.metadata } : {}),
      ...(options?.schemaVersion !== undefined ? { schemaVersion: options.schemaVersion } : {}),
    },
  });
  if (updated.count === 0) {
    throw new Error("Learning artifact not found or not in PROCESSING state");
  }
  const artifact = await prisma.learningArtifact.findUnique({ where: { id } });
  if (!artifact) throw new Error("Learning artifact not found");
  return toLearningArtifactData(artifact);
}

// Marks a failed generation as FAILED, preserving any metadata already set so
// the error joins provenance rather than replacing it.
export async function failLearningArtifact(
  id: string,
  message?: string,
): Promise<LearningArtifactData> {
  const existing = await prisma.learningArtifact.findUnique({
    where: { id },
    select: { status: true, metadata: true },
  });
  if (!existing) throw new Error("Learning artifact not found");
  if (existing.status !== "PROCESSING") {
    throw new Error("Learning artifact not in PROCESSING state");
  }
  const metadata = (existing.metadata as Record<string, unknown> | null) ?? {};
  const updated = await prisma.learningArtifact.update({
    where: { id },
    data: {
      status: "FAILED",
      ...(message
        ? { metadata: { ...metadata, error: message } as Prisma.InputJsonValue }
        : {}),
    },
  });
  return toLearningArtifactData(updated);
}