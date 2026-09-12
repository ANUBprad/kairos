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