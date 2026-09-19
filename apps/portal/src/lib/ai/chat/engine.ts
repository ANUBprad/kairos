import { getAIProvider } from "@/lib/ai/providers";
import { searchSimilar } from "@/lib/ai/retrieval";
import { buildChatPrompt, formatForProvider } from "@/lib/ai/prompts";
import { addMessage, getConversationMessages } from "@/lib/ai/memory";
import { extractCitationsFromChunks, filterCitationsToContent } from "@/lib/ai/citations";
import { getRetrievalConfig } from "@/lib/retrieval/service";
import { createAbortError } from "@/lib/ai/abort";
import { createTrace, finishTrace, addSpan, finishSpan, addTraceEvent } from "@/lib/observability/trace-explorer";
import { buildChatTraceMetadata } from "@/lib/ai/chat/observability";
import { EMPTY_RETRIEVAL_TEXT, GENERATION_FAILED_TEXT, GENERATION_STOPPED_TEXT } from "@/lib/ai/chat/stream-markers";
import { logger } from "@/lib/logger";
import type { ProviderType, CitationSource, StreamChunk, RetrievedChunk } from "@/lib/ai/types";

export interface ChatTraceContext {
  requestId: string;
  organizationId: string;
  userId: string;
}

export interface ChatRequest {
  conversationId: string;
  kbId: string;
  query: string;
  sourceIds?: string[];
  providerType?: ProviderType;
  model?: string;
  signal?: AbortSignal;
  trace?: ChatTraceContext;
}

// A "usable" chunk is one with non-whitespace content. Zero usable chunks is a
// hard generation gate: the LLM is never called and a deterministic no-results
// answer is returned instead.
export function filterUsableChunks(chunks: RetrievedChunk[]): RetrievedChunk[] {
  return chunks.filter((c) => c.content.trim().length > 0);
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
  const traceCtx = request.trace;
  let startedTrace: Awaited<ReturnType<typeof createTrace>> | null = null;

  try {
    if (traceCtx) {
      startedTrace = await createTrace(traceCtx.organizationId, {
        requestId: traceCtx.requestId,
        name: "chat.generate",
        provider: provider.type,
        model: request.model || provider.getDefaultModel(),
        metadata: buildChatTraceMetadata({
          knowledgeBaseId: request.kbId,
          conversationId: request.conversationId,
          sourceIds: request.sourceIds ?? [],
        }),
        userId: traceCtx.userId,
      });
    }

    const retrievalOptions = await getRetrievalOptions(request.kbId, request.sourceIds);

    let retrievalSpanId: string | null = null;
    if (startedTrace && traceCtx) {
      const span = await addSpan(startedTrace.id, { name: "chat.retrieval", startTime: new Date() }, traceCtx.organizationId);
      retrievalSpanId = span.id;
    }

    const retrieval = await searchSimilar(request.query, retrievalOptions);

    const retrievedChunks = filterUsableChunks(retrieval.chunks);

    if (startedTrace && traceCtx && retrievalSpanId) {
      await finishSpan(retrievalSpanId, { chunkCount: retrieval.chunks.length, usableChunkCount: retrievedChunks.length }, traceCtx.organizationId);
    }

    if (retrievedChunks.length === 0) {
      await addMessage(request.conversationId, "user", request.query);
      await addMessage(request.conversationId, "assistant", EMPTY_RETRIEVAL_TEXT);
      if (startedTrace && traceCtx) {
        await addTraceEvent(startedTrace.id, "chat.empty_retrieval", { chunkCount: retrieval.chunks.length, usableChunkCount: 0 }, traceCtx.organizationId);
        await finishTrace(startedTrace.id, { status: "OK", output: EMPTY_RETRIEVAL_TEXT }, traceCtx.organizationId);
      }
      return {
        content: EMPTY_RETRIEVAL_TEXT,
        citations: [],
        conversationId: request.conversationId,
      };
    }

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

    let generationSpanId: string | null = null;
    if (startedTrace && traceCtx) {
      const span = await addSpan(startedTrace.id, { name: "chat.generation", startTime: new Date() }, traceCtx.organizationId);
      generationSpanId = span.id;
    }

    const response = await provider.generateChat({
      model: request.model || provider.getDefaultModel(),
      messages: formattedMessages,
      signal: request.signal,
    });

    if (startedTrace && traceCtx) {
      if (generationSpanId) {
        await finishSpan(generationSpanId, { model: response.model }, traceCtx.organizationId);
      }
      await finishTrace(startedTrace.id, {
        status: "OK",
        inputTokens: response.usage?.promptTokens,
        outputTokens: response.usage?.completionTokens,
        totalTokens: response.usage?.totalTokens,
      }, traceCtx.organizationId);
    }

    const citations = filterCitationsToContent(
      extractCitationsFromChunks(retrievedChunks),
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
  } catch (error) {
    if (startedTrace && traceCtx) {
      try {
        await finishTrace(startedTrace.id, { status: "ERROR" }, traceCtx.organizationId);
      } catch {
        // Best-effort: a trace write failure must not mask the real error.
      }
    }
    throw error;
  }
}

export async function* streamChatResponse(
  request: ChatRequest,
): AsyncGenerator<StreamChunk, void, unknown> {
  let fullContent = "";
  let userPersisted = false;
  const traceCtx = request.trace;
  let startedTrace: Awaited<ReturnType<typeof createTrace>> | null = null;

  try {
    const provider = getAIProvider(request.providerType);

    if (traceCtx) {
      startedTrace = await createTrace(traceCtx.organizationId, {
        requestId: traceCtx.requestId,
        name: "chat.generate",
        provider: provider.type,
        model: request.model || provider.getDefaultModel(),
        metadata: buildChatTraceMetadata({
          knowledgeBaseId: request.kbId,
          conversationId: request.conversationId,
          sourceIds: request.sourceIds ?? [],
        }),
        userId: traceCtx.userId,
      });
    }

    const retrievalOptions = await getRetrievalOptions(request.kbId, request.sourceIds);

    let retrievalSpanId: string | null = null;
    if (startedTrace && traceCtx) {
      const span = await addSpan(startedTrace.id, { name: "chat.retrieval", startTime: new Date() }, traceCtx.organizationId);
      retrievalSpanId = span.id;
    }

    const retrieval = await searchSimilar(request.query, retrievalOptions);

    const retrievedChunks = filterUsableChunks(retrieval.chunks);

    if (startedTrace && traceCtx && retrievalSpanId) {
      await finishSpan(retrievalSpanId, { chunkCount: retrieval.chunks.length, usableChunkCount: retrievedChunks.length }, traceCtx.organizationId);
    }

    if (retrievedChunks.length === 0) {
      // Hard generation gate: with zero usable context there is nothing to
      // answer from, so the LLM is never called and a deterministic no-results
      // answer is persisted and streamed instead. No citations are fabricated.
      await addMessage(request.conversationId, "user", request.query);
      await addMessage(request.conversationId, "assistant", EMPTY_RETRIEVAL_TEXT);
      if (startedTrace && traceCtx) {
        await addTraceEvent(startedTrace.id, "chat.empty_retrieval", { chunkCount: retrieval.chunks.length, usableChunkCount: 0 }, traceCtx.organizationId);
        await finishTrace(startedTrace.id, { status: "OK", output: EMPTY_RETRIEVAL_TEXT }, traceCtx.organizationId);
      }
      yield { content: EMPTY_RETRIEVAL_TEXT, done: false };
      yield { content: "", done: true, citations: [] };
      return;
    }

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

    let generationSpanId: string | null = null;
    if (startedTrace && traceCtx) {
      const span = await addSpan(startedTrace.id, { name: "chat.generation", startTime: new Date() }, traceCtx.organizationId);
      generationSpanId = span.id;
    }

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

    if (startedTrace && traceCtx) {
      if (generationSpanId) {
        await finishSpan(generationSpanId, { model: request.model || provider.getDefaultModel() }, traceCtx.organizationId);
      }
      await finishTrace(startedTrace.id, { status: "OK" }, traceCtx.organizationId);
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
    if (startedTrace && traceCtx) {
      try {
        await finishTrace(startedTrace.id, { status: "ERROR" }, traceCtx.organizationId);
      } catch {
        // Best-effort: a trace write failure must not mask the stream error.
      }
    }
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
