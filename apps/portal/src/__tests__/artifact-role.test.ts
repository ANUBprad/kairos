import { it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";

const client = {
  user: { findUnique: async () => ({ id: "user" }) },
  knowledgeBase: { findUnique: async () => ({ project: { organization: { members: [{ id: "member", role: "VIEWER" }] } } }) },
  learningArtifact: {
    findFirst: async () => { throw new Error("Artifact mutation reached"); },
    updateMany: async () => { throw new Error("Artifact mutation reached"); },
  },
  document: { findMany: async () => { throw new Error("Artifact mutation reached"); } },
};
(globalThis as unknown as { prisma: PrismaClient }).prisma = client as unknown as PrismaClient;

it("viewers retain KB reads but cannot mutate shared artifacts", async () => {
  process.env.KAIROS_DEMO_MODE = "true";
  process.env.AI_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "test-dummy-key-do-not-call";
  const { canAccessKnowledgeBase } = await import("@/lib/ai/chat/access");
  const { deleteLearningArtifactForWorkspace, recoverStaleLearningArtifactsForWorkspace } = await import("@/lib/actions/artifacts");
  const { generateLearningArtifactForUser, regenerateLearningArtifactForUser } = await import("@/lib/artifacts/engine");
  const { generatePodcastInterruptionForUser } = await import("@/lib/artifacts/interrupt-service");
  assert.equal(await canAccessKnowledgeBase("user", "kb"), true);
  for (const action of [
    () => deleteLearningArtifactForWorkspace("kb", "artifact"),
    () => recoverStaleLearningArtifactsForWorkspace("kb"),
    () => generateLearningArtifactForUser({ userId: "user", knowledgeBaseId: "kb", artifactType: "SUMMARY", sourceIds: ["doc"] }),
    () => regenerateLearningArtifactForUser("user", { knowledgeBaseId: "kb", artifactId: "artifact" }),
    () => generatePodcastInterruptionForUser({ userId: "user", knowledgeBaseId: "kb", artifactId: "artifact", question: "Explain this topic" }),
  ]) {
    await assert.rejects(action, /(?:Knowledge base|Podcast) not found/);
  }
});
