import { getAIProvider } from "@/lib/ai/providers";
import { searchSimilar } from "@/lib/ai/retrieval";
import { buildChatPrompt, formatForProvider } from "@/lib/ai/prompts";
import { addMessage, getConversationMessages } from "@/lib/ai/memory";
import { extractCitationsFromChunks, filterCitationsToContent } from "@/lib/ai/citations";
import { getRetrievalConfig } from "@/lib/retrieval/service";
import { createAbortError } from "@/lib/ai/abort";
import { GENERATION_FAILED_TEXT, GENERATION_STOPPED_TEXT } from "@/lib/ai/chat/stream-markers";
import { logger } from "@/lib/logger";
import type { ProviderType, CitationSource, StreamChunk } from "@/lib/ai/types";

export interface ChatRequest {
  conversationId: string;
  kbId: string;
  query: string;
  sourceIds?: string[];
  providerType?: ProviderType;
  model?: string;
  signal?: AbortSignal;
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

async function getRetrievalOptions(kbId: string, sourceIds?: string[]) {
  const config = await getRetrievalConfig(kbId);
  return {
    knowledgeBaseIds: [kbId],
    documentIds: sourceIds?.length ? sourceIds : undefined,
    topK: config.topK,
    minSimilarity: config.similarityThreshold,
  };
}

export async function generateChatResponse(
  request: ChatRequest,
): Promise<ChatResponse> {
  const provider = getAIProvider(request.providerType);

  const retrievalOptions = await getRetrievalOptions(request.kbId, request.sourceIds);

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
    signal: request.signal,
  });

  const citations = filterCitationsToContent(
    extractCitationsFromChunks(retrieval.chunks),
    response.content,
  );

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
  let userPersisted = false;

  try {
    const provider = getAIProvider(request.providerType);

    const retrievalOptions = await getRetrievalOptions(request.kbId, request.sourceIds);

    const retrieval = await searchSimilar(request.query, retrievalOptions);

    const retrievedChunks = retrieval.chunks;

    const conversationMessages = await getConversationMessages(
      request.conversationId,
    );

    const prompt = buildChatPrompt({
      systemPrompt: "",
      conversationHistory: conversationMessages,
      retrievedChunks,
      userQuery: request.query,
    });

    const formattedMessages = formatForProvider(prompt.messages, provider.type);

    await addMessage(request.conversationId, "user", request.query);
    userPersisted = true;

    const stream = provider.streamChat({
      model: request.model || provider.getDefaultModel(),
      messages: formattedMessages,
      signal: request.signal,
    });

    for await (const chunk of stream) {
      if (request.signal?.aborted) throw createAbortError();
      if (chunk.done) break;
      fullContent += chunk.content;
      yield { content: chunk.content, done: false };
    }

    const citations = filterCitationsToContent(
      extractCitationsFromChunks(retrievedChunks),
      fullContent,
    );

    await addMessage(
      request.conversationId,
      "assistant",
      fullContent,
      undefined,
      citations,
    );

    yield { content: "", done: true, citations };
  } catch (err) {
    // Persist an assistant turn so the conversation stays coherent after reload.
    // On client-initiated abort (stop button) the partial content is preserved
    // with a brief note; on any other error a generic failure marker is written.
    if (userPersisted) {
      try {
        const isAbort = err instanceof Error && err.name === "AbortError";
        const content = isAbort
          ? fullContent ? `${fullContent}\n\n_Generation stopped._` : GENERATION_STOPPED_TEXT
          : GENERATION_FAILED_TEXT;
        await addMessage(request.conversationId, "assistant", content);
      } catch {
        // Best-effort: if the DB write fails the error surfaces below anyway.
      }
    }

    logger.error("Chat stream error", { error: err instanceof Error ? err.message : "unknown" });
    // Surface the error to the caller so the route can emit an SSE error event
    // instead of silently ending the stream as if it had completed.
    throw err;
  }
}
