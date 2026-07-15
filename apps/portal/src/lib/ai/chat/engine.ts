import { getAIProvider } from "@/lib/ai/providers";
import { searchSimilar } from "@/lib/ai/retrieval";
import { buildChatPrompt, formatForProvider } from "@/lib/ai/prompts";
import { addMessage, getConversationMessages } from "@/lib/ai/memory";
import { extractCitationsFromChunks } from "@/lib/ai/citations";
import { getRetrievalConfig } from "@/lib/retrieval/service";
import { logger } from "@/lib/logger";
import type { ProviderType, CitationSource, StreamChunk } from "@/lib/ai/types";

export interface ChatRequest {
  conversationId: string;
  kbId: string;
  query: string;
  providerType?: ProviderType;
  model?: string;
}

export interface ChatResponse {
  content: string;
  citations: CitationSource[];
  conversationId: string;
}

export interface StreamingChatResponse {
  stream: AsyncGenerator<StreamChunk, void, unknown>;
  citations: Promise<CitationSource[]>;
  conversationId: string;
}

async function getRetrievalOptions(kbId: string) {
  const config = await getRetrievalConfig(kbId);
  return {
    knowledgeBaseIds: [kbId],
    topK: config.topK,
    minSimilarity: config.similarityThreshold,
  };
}

export async function generateChatResponse(
  request: ChatRequest,
): Promise<ChatResponse> {
  const provider = getAIProvider(request.providerType);

  const retrievalOptions = await getRetrievalOptions(request.kbId);

  const retrieval = await searchSimilar(request.query, retrievalOptions);

  const conversationMessages = await getConversationMessages(
    request.conversationId,
  );

  const prompt = buildChatPrompt({
    systemPrompt: "",
    conversationHistory: conversationMessages,
    retrievedChunks: retrieval.chunks,
    userQuery: request.query,
  });

  const formattedMessages = formatForProvider(prompt.messages, provider.type);

  const response = await provider.generateChat({
    model: request.model || provider.getDefaultModel(),
    messages: formattedMessages,
  });

  const citations = extractCitationsFromChunks(retrieval.chunks);

  await addMessage(
    request.conversationId,
    "user",
    request.query,
  );

  await addMessage(
    request.conversationId,
    "assistant",
    response.content,
    response.usage?.totalTokens,
    citations,
  );

  return {
    content: response.content,
    citations,
    conversationId: request.conversationId,
  };
}

export async function* streamChatResponse(
  request: ChatRequest,
): AsyncGenerator<StreamChunk, void, unknown> {
  let fullContent = "";

  try {
    const provider = getAIProvider(request.providerType);

    const retrievalOptions = await getRetrievalOptions(request.kbId);

    const retrieval = await searchSimilar(request.query, retrievalOptions);

    const citations = extractCitationsFromChunks(retrieval.chunks);

    const conversationMessages = await getConversationMessages(
      request.conversationId,
    );

    const prompt = buildChatPrompt({
      systemPrompt: "",
      conversationHistory: conversationMessages,
      retrievedChunks: retrieval.chunks,
      userQuery: request.query,
    });

    const formattedMessages = formatForProvider(prompt.messages, provider.type);

    await addMessage(request.conversationId, "user", request.query);

    const stream = provider.streamChat({
      model: request.model || provider.getDefaultModel(),
      messages: formattedMessages,
    });

    for await (const chunk of stream) {
      if (chunk.done) break;
      fullContent += chunk.content;
      yield { content: chunk.content, done: false };
    }

    await addMessage(
      request.conversationId,
      "assistant",
      fullContent,
      undefined,
      citations,
    );

    yield { content: "", done: true, citations };
  } catch (err) {
    logger.error("Chat stream error", { error: err instanceof Error ? err.message : "unknown" });
    yield {
      content: "",
      done: true,
    };
  }
}
