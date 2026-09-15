import { prisma } from "@/lib/prisma";
import { canAccessKnowledgeBase, canUseConversationInKb } from "@/lib/ai/chat/access";
import { isValidEntityId } from "@/lib/validation";
import { getLearningArtifactInKb } from "./persistence";
import { toWorkspaceArtifactData } from "./dto";

export interface ArtifactDetail {
  artifact: Awaited<ReturnType<typeof toWorkspaceArtifactData>>;
  sources: { id: string; name: string | null }[];
  kbName: string;
}

// Server-side load for the artifact detail page. Reuses the existing
// authorization chain (session → org membership → KB → artifact) without
// introducing a new authz mechanism; returns null for any access failure so
// the page can render the safe not-found state.
export async function getArtifactDetailForUser(
  kbId: string,
  artifactId: string,
  userId: string,
): Promise<ArtifactDetail | null> {
  if (!(await canAccessKnowledgeBase(userId, kbId))) return null;

  const [artifactRow, kb] = await Promise.all([
    getLearningArtifactInKb(artifactId, kbId),
    prisma.knowledgeBase.findUnique({ where: { id: kbId }, select: { name: true } }),
  ]);

  if (!artifactRow || !kb) return null;

  const sources = await prisma.document.findMany({
    where: { id: { in: artifactRow.sourceIds }, knowledgeBaseId: kbId },
    select: { id: true, name: true },
  });

  return {
    artifact: toWorkspaceArtifactData(artifactRow),
    sources,
    kbName: kb.name,
  };
}

// Validates a return-path conversation belongs to the current user and the
// same knowledge base. Pure boundary check — reuses the existing predicate
// from the chat access module; never opens a foreign conversation.
export async function resolveArtifactReturnTarget(
  kbId: string,
  conversationId: string | undefined,
  userId: string,
): Promise<string | null> {
  if (!conversationId || !isValidEntityId(conversationId)) return null;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true, knowledgeBaseId: true },
  });

  return canUseConversationInKb(conversation, userId, kbId) ? conversationId : null;
}
