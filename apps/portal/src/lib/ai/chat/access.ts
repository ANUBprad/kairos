import { prisma } from "@/lib/prisma";

// Verifies the user is a member of the organization that owns the knowledge
// base. Returns false for missing KB or missing membership so callers can
// treat both as "not found" without leaking existence.
export async function canAccessKnowledgeBase(userId: string, kbId: string): Promise<boolean> {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: {
      project: {
        select: {
          organization: {
            select: {
              members: { where: { userId }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  return !!kb && kb.project.organization.members.length > 0;
}

// Pure predicate: a conversation may only be used from the knowledge base it
// belongs to, and only by its owner. Cross-workspace usage is indistinguishable
// from "not found".
export function canUseConversationInKb(
  conversation: { userId: string; knowledgeBaseId: string } | null | undefined,
  userId: string,
  kbId: string,
): boolean {
  return !!conversation && conversation.userId === userId && conversation.knowledgeBaseId === kbId;
}