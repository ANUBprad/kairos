"use server";

import type { ArtifactStatus, ArtifactType } from "@prisma/client";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { getServerSession } from "@/lib/server/auth-utils";
import { generateLearningArtifact, regenerateLearningArtifact } from "@/lib/artifacts/engine";
import {
  getLearningArtifactInKb,
  listLearningArtifacts,
  deleteLearningArtifact,
} from "@/lib/artifacts/persistence";
import { toWorkspaceArtifactData } from "@/lib/artifacts/dto";
import { collectArtifactMediaKeys } from "@/lib/artifacts/interrupt";
import { getStorageProvider } from "@/lib/storage";
import { logError } from "@/lib/errors";
import type { LearningArtifactData, LearningArtifactWithStudy } from "@/lib/artifacts/types";
import { getStudyProgressForUser } from "@/lib/study";

// Application contract for the artifact Studio. The engine authenticates the
// session, authorizes the knowledge base, validates the source scope and
// traces the run; these actions only pin the supported capabilities and their
// typed public signatures, routing every return through the client-safety
// projection so media storage references never reach the browser.
// All database access happens below through the artifact layer, never here.
export async function generateSummaryArtifact(
  knowledgeBaseId: string,
  sourceIds: string[],
  name?: string,
): Promise<LearningArtifactData> {
  return toWorkspaceArtifactData(
    await generateLearningArtifact({
      knowledgeBaseId,
      artifactType: "SUMMARY",
      sourceIds,
      name,
    }),
  );
}

export async function generateReportArtifact(
  knowledgeBaseId: string,
  sourceIds: string[],
  name?: string,
): Promise<LearningArtifactData> {
  return toWorkspaceArtifactData(
    await generateLearningArtifact({
      knowledgeBaseId,
      artifactType: "REPORT",
      sourceIds,
      name,
    }),
  );
}

export async function generateQuizArtifact(
  knowledgeBaseId: string,
  sourceIds: string[],
  name?: string,
): Promise<LearningArtifactData> {
  return toWorkspaceArtifactData(
    await generateLearningArtifact({
      knowledgeBaseId,
      artifactType: "QUIZ",
      sourceIds,
      name,
    }),
  );
}

export async function generateFlashcardsArtifact(
  knowledgeBaseId: string,
  sourceIds: string[],
  name?: string,
): Promise<LearningArtifactData> {
  return toWorkspaceArtifactData(
    await generateLearningArtifact({
      knowledgeBaseId,
      artifactType: "FLASHCARDS",
      sourceIds,
      name,
    }),
  );
}

export async function generateMindmapArtifact(
  knowledgeBaseId: string,
  sourceIds: string[],
  name?: string,
): Promise<LearningArtifactData> {
  return toWorkspaceArtifactData(
    await generateLearningArtifact({
      knowledgeBaseId,
      artifactType: "MINDMAP",
      sourceIds,
      name,
    }),
  );
}

export async function generateTakeawaysArtifact(
  knowledgeBaseId: string,
  sourceIds: string[],
  name?: string,
): Promise<LearningArtifactData> {
  return toWorkspaceArtifactData(
    await generateLearningArtifact({
      knowledgeBaseId,
      artifactType: "TAKEAWAYS",
      sourceIds,
      name,
    }),
  );
}

export async function generatePodcastArtifact(
  knowledgeBaseId: string,
  sourceIds: string[],
  name?: string,
): Promise<LearningArtifactData> {
  return toWorkspaceArtifactData(
    await generateLearningArtifact({
      knowledgeBaseId,
      artifactType: "PODCAST",
      sourceIds,
      name,
    }),
  );
}

export async function getLearningArtifactForWorkspace(
  knowledgeBaseId: string,
  artifactId: string,
): Promise<LearningArtifactData> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  if (!(await canAccessKnowledgeBase(session.user.id, knowledgeBaseId))) {
    throw new Error("Knowledge base not found");
  }

  const artifact = await getLearningArtifactInKb(artifactId, knowledgeBaseId);
  if (!artifact) throw new Error("Artifact not found");
  return toWorkspaceArtifactData(artifact);
}

export async function listLearningArtifactsForWorkspace(
  knowledgeBaseId: string,
  filters?: { type?: ArtifactType; status?: ArtifactStatus },
): Promise<LearningArtifactWithStudy[]> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  if (!(await canAccessKnowledgeBase(session.user.id, knowledgeBaseId))) {
    throw new Error("Knowledge base not found");
  }

  const [artifacts, progress] = await Promise.all([
    listLearningArtifacts(knowledgeBaseId, filters),
    getStudyProgressForUser(session.user.id, knowledgeBaseId),
  ]);
  return artifacts.map((artifact) => ({
    ...toWorkspaceArtifactData(artifact),
    study: progress[artifact.id] ?? null,
  }));
}

// Regenerates an existing artifact. Only the id + KB are accepted from the
// caller; the source scope and type come from the stored row and are revalidated
// by the engine. The original artifact is never mutated — a fresh artifact row
// carries the result, linked via metadata.parentArtifactId.
export async function regenerateLearningArtifactForWorkspace(
  knowledgeBaseId: string,
  artifactId: string,
): Promise<LearningArtifactData> {
  return toWorkspaceArtifactData(
    await regenerateLearningArtifact({ knowledgeBaseId, artifactId }),
  );
}

// Deletes an artifact and best-effort-cleans its stored media (podcast audio +
// interruption audio). Authorization is KB-scoped and the foreign-id path is a
// safe "not found" — the deletion never leaks another KB's artifact existence.
// The DB row is the atomic delete; media cleanup happens after with exact keys
// captured from this artifact's own metadata, so a failed cleanup can never
// touch another artifact's media and never resurrects the artifact.
export async function deleteLearningArtifactForWorkspace(
  knowledgeBaseId: string,
  artifactId: string,
): Promise<void> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  if (!(await canAccessKnowledgeBase(session.user.id, knowledgeBaseId))) {
    throw new Error("Knowledge base not found");
  }

  const deleted = await deleteLearningArtifact(knowledgeBaseId, artifactId);
  if (!deleted) throw new Error("Artifact not found");

  const mediaKeys = collectArtifactMediaKeys(deleted.metadata);
  if (mediaKeys.length === 0) return;

  let storage;
  try {
    storage = getStorageProvider();
  } catch (providerError) {
    logError("artifact.delete.storage-provider", providerError, { artifactId: deleted.id });
    return;
  }
  for (const key of mediaKeys) {
    try {
      await storage.delete(key);
    } catch (cleanupError) {
      // Never log the storage key itself — the reference may be sensitive.
      logError("artifact.delete.media-cleanup", cleanupError, { artifactId: deleted.id });
    }
  }
}