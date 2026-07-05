import { prisma } from "@/lib/prisma";
import type { AIMessage } from "@/lib/ai/types";

const MAX_CONTEXT_TOKENS = 8000;
const TOKEN_ESTIMATE_RATIO = 4;

export interface ConversationData {
  id: string;
  title: string | null;
  model: string;
  provider: string;
  knowledgeBaseId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConversationWithMessages extends ConversationData {
  messages: AIMessage[];
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / TOKEN_ESTIMATE_RATIO);
}

async function trimMessages(
  messages: AIMessage[],
  maxTokens: number = MAX_CONTEXT_TOKENS,
): Promise<AIMessage[]> {
  const kept: AIMessage[] = [];
  let totalTokens = 0;

  const reversed = [...messages].reverse();

  for (const msg of reversed) {
    const tokens = estimateTokens(msg.content);
    if (totalTokens + tokens > maxTokens) break;
    kept.unshift(msg);
    totalTokens += tokens;
  }

  if (kept.length === 0 && messages.length > 0) {
    const last = messages[messages.length - 1];
    const truncated = last.content.slice(0, maxTokens * TOKEN_ESTIMATE_RATIO);
    kept.push({ ...last, content: truncated + "\n[Truncated]" });
  }

  return kept;
}

export async function createConversation(
  knowledgeBaseId: string,
  userId: string,
  title?: string,
  model?: string,
  provider?: string,
): Promise<ConversationData> {
  const conversation = await prisma.conversation.create({
    data: {
      title: title || null,
      model: model || "gpt-4o-mini",
      provider: provider || "openai",
      knowledgeBaseId,
      userId,
    },
  });
  return conversation;
}

export async function getConversation(
  conversationId: string,
): Promise<(ConversationData & { userId: string; messages: AIMessage[] }) | null> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true, tokens: true },
      },
    },
  });

  if (!conversation) return null;

  return {
    ...conversation,
    messages: conversation.messages.map((m) => ({
      role: m.role as "user" | "assistant" | "system",
      content: m.content,
    })),
  };
}

export async function listConversations(
  knowledgeBaseId: string,
  userId: string,
  limit = 20,
): Promise<ConversationData[]> {
  return prisma.conversation.findMany({
    where: { knowledgeBaseId, userId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });
}

export async function addMessage(
  conversationId: string,
  role: "user" | "assistant" | "system",
  content: string,
  tokens?: number,
  citations?: {
    chunkId: string;
    documentId: string;
    documentName: string;
    chunkIndex: number;
    pageNumber?: number | null;
    excerpt: string;
    similarity?: number;
  }[],
): Promise<void> {
  await prisma.message.create({
    data: {
      role,
      content,
      tokens: tokens ?? estimateTokens(content),
      conversationId,
      citations: citations
        ? {
            create: citations.map((c) => ({
              chunkId: c.chunkId,
              documentId: c.documentId,
              documentName: c.documentName,
              chunkIndex: c.chunkIndex,
              pageNumber: c.pageNumber ?? null,
              excerpt: c.excerpt,
              similarity: c.similarity ?? null,
            })),
          }
        : undefined,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

export async function getConversationMessages(
  conversationId: string,
  maxTokens = MAX_CONTEXT_TOKENS,
): Promise<AIMessage[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true, tokens: true },
  });

  const aiMessages: AIMessage[] = messages.map((m) => ({
    role: m.role as "user" | "assistant" | "system",
    content: m.content,
  }));

  return trimMessages(aiMessages, maxTokens);
}

export async function deleteConversation(
  conversationId: string,
  userId: string,
): Promise<void> {
  await prisma.conversation.deleteMany({
    where: { id: conversationId, userId },
  });
}

export async function updateConversationTitle(
  conversationId: string,
  title: string,
): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { title, updatedAt: new Date() },
  });
}
