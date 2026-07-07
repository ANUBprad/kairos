import type { AIMessage, RetrievedChunk } from "@/lib/ai/types";

export interface PromptContext {
  systemPrompt: string;
  conversationHistory: AIMessage[];
  retrievedChunks: RetrievedChunk[];
  userQuery: string;
  maxTokens?: number;
}

export interface FormattedPrompt {
  messages: AIMessage[];
  estimatedTokens: number;
}

function estimateMessageTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function formatChunksAsContext(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "";

  return chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (Document: "${c.documentName}", Chunk #${c.index}${c.pageNumber ? `, Page ${c.pageNumber}` : ""}, Relevance: ${Math.round(c.similarity * 100)}%)\n${c.content}`,
    )
    .join("\n\n");
}

function buildSystemPrompt(chunks: RetrievedChunk[]): string {
  const context = formatChunksAsContext(chunks);

  return `You are a helpful AI assistant for Kairos, a knowledge management platform. Your role is to answer questions based on the retrieved document chunks provided below.

## Instructions
- Answer based ONLY on the provided context. If the context doesn't contain enough information, say so clearly.
- Always cite your sources using the format [Source N] at the end of each relevant sentence or paragraph.
- Be concise and accurate. Do not make up information.
- If the user asks a question unrelated to the provided context, politely explain you can only answer based on the available documents.

## Retrieved Context
${context || "No relevant documents found for this query."}

## Response Format
Provide a clear, well-structured answer with source citations.`;
}

export function buildChatPrompt(context: PromptContext): FormattedPrompt {
  const systemPrompt = context.systemPrompt || buildSystemPrompt(context.retrievedChunks);

  const messages: AIMessage[] = [{ role: "system", content: systemPrompt }];

  const history = context.conversationHistory || [];
  const recentHistory = history.slice(-10);

  for (const msg of recentHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: context.userQuery });

  const estimatedTokens = messages.reduce(
    (sum, m) => sum + estimateMessageTokens(m.content),
    0,
  );

  return { messages, estimatedTokens };
}

export function formatForProvider(
  messages: AIMessage[],
  provider: string,
): AIMessage[] {
  if (provider === "gemini") {
    return messages.map((m) =>
      m.role === "system"
        ? { ...m, role: "user" as const, content: `[System Instruction]\n${m.content}` }
        : m,
    );
  }
  return messages;
}
