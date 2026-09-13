"use server";

import type { ArtifactStatus, ArtifactType } from "@prisma/client";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { getServerSession } from "@/lib/server/auth-utils";
import { generateLearningArtifact } from "@/lib/artifacts/engine";
import { getLearningArtifactInKb, listLearningArtifacts } from "@/lib/artifacts/persistence";
import { toWorkspaceArtifactData } from "@/lib/artifacts/dto";
import type { LearningArtifactData } from "@/lib/artifacts/types";

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
): Promise<LearningArtifactData[]> {
  const session = await getServerSession();
  if (!session) throw new Error("Not authenticated");

  if (!(await canAccessKnowledgeBase(session.user.id, knowledgeBaseId))) {
    throw new Error("Knowledge base not found");
  }

  return (await listLearningArtifacts(knowledgeBaseId, filters)).map(toWorkspaceArtifactData);
}