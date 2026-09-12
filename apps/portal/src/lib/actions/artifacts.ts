"use server";

import type { ArtifactStatus, ArtifactType } from "@prisma/client";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { getServerSession } from "@/lib/server/auth-utils";
import { generateLearningArtifact } from "@/lib/artifacts/engine";
import { getLearningArtifactInKb, listLearningArtifacts } from "@/lib/artifacts/persistence";
import type { LearningArtifactData } from "@/lib/artifacts/types";

// Application contract for the artifact Studio. The engine authenticates the
// session, authorizes the knowledge base, validates the source scope and
// traces the run; this action only pins the SUMMARY capability and its typed
// public signature. All database access happens below through the artifact
// layer, never in this file.
export async function generateSummaryArtifact(
  knowledgeBaseId: string,
  sourceIds: string[],
  name?: string,
): Promise<LearningArtifactData> {
  return generateLearningArtifact({
    knowledgeBaseId,
    artifactType: "SUMMARY",
    sourceIds,
    name,
  });
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
  return artifact;
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

  return listLearningArtifacts(knowledgeBaseId, filters);
}