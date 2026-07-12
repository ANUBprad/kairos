import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/auth-utils";
import { prisma } from "@/lib/prisma";
import { streamChatResponse } from "@/lib/ai/chat";
import { getRetrievalConfig } from "@/lib/retrieval/service";
import { buildChatPrompt } from "@/lib/ai/prompts";
import { executeRetrievalWithTrace } from "@/lib/retrieval/strategies";
import { getConversationMessages } from "@/lib/ai/memory";
import { rateLimit, rateLimitHeaders, RATE_LIMITS } from "@/lib/rate-limit";
import { sanitizeError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rl = rateLimit(`chat:${session.user.id}`, RATE_LIMITS.chat);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: rateLimitHeaders(rl, RATE_LIMITS.chat) },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  const kbId = typeof body.kbId === "string" ? body.kbId.trim() : "";
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const provider = typeof body.provider === "string" ? body.provider : undefined;
  const model = typeof body.model === "string" ? body.model : undefined;
  const explainable = typeof body.explainable === "boolean" ? body.explainable : false;

  const validProviders = ["openai", "gemini"] as const;
  const typedProvider = provider && validProviders.includes(provider as typeof validProviders[number])
    ? (provider as typeof validProviders[number])
    : undefined;

  if (!conversationId || !kbId || !query) {
    return NextResponse.json(
      { error: "Missing required fields: conversationId, kbId, query" },
      { status: 400 },
    );
  }

  if (query.length > 10000) {
    return NextResponse.json(
      { error: "Query is too long" },
      { status: 400 },
    );
  }

  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!UUID_REGEX.test(conversationId) || !UUID_REGEX.test(kbId)) {
    return NextResponse.json({ error: "Invalid ID format" }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { userId: true, knowledgeBaseId: true },
  });

  if (!conversation || conversation.userId !== session.user.id) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: {
      project: {
        select: {
          organization: {
            select: {
              members: { where: { userId: session.user.id }, select: { id: true } },
            },
          },
        },
      },
    },
  });

  if (!kb || kb.project.organization.members.length === 0) {
    return NextResponse.json({ error: "Knowledge base not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let trace: Awaited<ReturnType<typeof executeRetrievalWithTrace>> | null = null;

        if (explainable) {
          const retrievalConfig = await getRetrievalConfig(kbId);
          const retrievalStart = performance.now();

          trace = await executeRetrievalWithTrace(
            kbId,
            query,
            {
              strategy: (retrievalConfig.retrievalStrategy || retrievalConfig.retrievalMode || "vector") as "vector" | "keyword" | "hybrid" | "query-expansion" | "multi-query" | "reranking",
              topK: retrievalConfig.topK,
              enableQueryExpansion: retrievalConfig.enableQueryExpansion || false,
              enableMultiQuery: retrievalConfig.enableMultiQuery || false,
              enableReranking: retrievalConfig.enableReranking || false,
              enableCompression: retrievalConfig.enableCompression || false,
              compressionConfig: {
                enabled: true,
                maxTokens: retrievalConfig.maxContextTokens || 4000,
                mergeOverlapping: true,
                removeDuplicates: true,
                trimRedundant: true,
              },
              hybridConfig: {
                vectorWeight: retrievalConfig.vectorWeight || 1.0,
                keywordWeight: retrievalConfig.keywordWeight || 1.0,
                rrfK: retrievalConfig.rrfK || 60,
              },
            },
            retrievalConfig.embeddingModel || "",
            retrievalConfig.embeddingProvider,
          );

          const retrievalEnd = performance.now();

          const conversationMessages = await getConversationMessages(conversationId);

          const contextStr = trace.result
            .map((c, i) => `[Source ${i + 1}]${c.content}`)
            .join("\n\n");

          const systemPrompt = `You are a helpful AI assistant for Kairos. Answer based on the retrieved context below.

## Retrieval Strategy: ${trace.strategy}
${trace.steps.map((s) => `- ${s.description} (${s.durationMs}ms)`).join("\n")}

## Retrieved Context
${contextStr || "No relevant documents found."}`;

          const prompt = buildChatPrompt({
            systemPrompt,
            conversationHistory: conversationMessages,
            retrievedChunks: trace.result.map((c) => ({
              id: c.chunkId,
              content: c.content,
              index: c.index,
              tokenCount: c.tokenCount || 0,
              documentId: c.documentId,
              documentName: (c.metadata as Record<string, unknown> | null)?.documentName as string || "Unknown",
              similarity: c.similarity,
              pageNumber: null,
              metadata: c.metadata as Record<string, unknown> | null,
              chunkSize: c.content.length,
            })),
            userQuery: query,
          });

          const pipelineData = {
            type: "pipeline",
            strategy: trace.strategy,
            steps: trace.steps,
            retrieval: {
              query,
              chunks: trace.result.map((c) => ({
                id: c.chunkId,
                content: c.content,
                index: c.index,
                tokenCount: c.tokenCount,
                documentId: c.documentId,
                documentName: (c.metadata as Record<string, unknown> | null)?.documentName as string || "Unknown",
                similarity: c.similarity,
                chunkSize: c.content.length,
              })),
              totalChunks: trace.result.length,
              latencyMs: Math.round((retrievalEnd - retrievalStart) * 100) / 100,
            },
            prompt: {
              systemPrompt: prompt.messages[0]?.content || "",
              messages: prompt.messages,
              estimatedTokens: prompt.estimatedTokens,
            },
            config: {
              chunkStrategy: retrievalConfig.chunkStrategy,
              chunkSize: retrievalConfig.chunkSize,
              chunkOverlap: retrievalConfig.chunkOverlap,
              topK: retrievalConfig.topK,
              similarityThreshold: retrievalConfig.similarityThreshold,
              embeddingModel: retrievalConfig.embeddingModel,
              retrievalMode: retrievalConfig.retrievalMode,
              retrievalStrategy: retrievalConfig.retrievalStrategy,
              queryExpansion: retrievalConfig.enableQueryExpansion,
              multiQuery: retrievalConfig.enableMultiQuery,
              reranking: retrievalConfig.enableReranking,
              compression: retrievalConfig.enableCompression,
            },
          };

          const pipelineEvent = JSON.stringify(pipelineData);
          controller.enqueue(encoder.encode(`data: ${pipelineEvent}\n\n`));
        }

        let citationsPayload: Array<{
          chunkId: string;
          documentId: string;
          documentName: string;
          chunkIndex: number;
          pageNumber: number | null;
          excerpt: string;
          similarity: number;
        }> = [];

        if (explainable && trace) {
          citationsPayload = trace.result.map((c) => ({
            chunkId: c.chunkId,
            documentId: c.documentId,
            documentName: ((c.metadata as Record<string, unknown> | null)?.documentName as string) || "Unknown",
            chunkIndex: c.index,
            pageNumber: null,
            excerpt: c.content.slice(0, 200),
            similarity: c.similarity,
          }));
        }

        const gen = streamChatResponse({
          conversationId,
          kbId,
          query,
          providerType: typedProvider,
          model: model || undefined,
        });

        for await (const chunk of gen) {
          if (chunk.done) {
            if (!explainable && chunk.citations && chunk.citations.length > 0) {
              citationsPayload = chunk.citations.map((c) => ({
                chunkId: c.chunkId,
                documentId: c.documentId,
                documentName: c.documentName,
                chunkIndex: c.chunkIndex,
                pageNumber: c.pageNumber ?? null,
                excerpt: c.excerpt,
                similarity: c.similarity,
              }));
            }
            break;
          }
          const data = JSON.stringify({ type: "chunk", content: chunk.content });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }

        if (citationsPayload.length > 0) {
          const citationsData = JSON.stringify({ type: "citations", citations: citationsPayload });
          controller.enqueue(encoder.encode(`data: ${citationsData}\n\n`));
        }

        const finalData = JSON.stringify({ type: "done" });
        controller.enqueue(encoder.encode(`data: ${finalData}\n\n`));
      } catch (err) {
        const sanitized = sanitizeError(err);
        const errorData = JSON.stringify({ type: "error", content: "An error occurred while processing your request", errorId: sanitized.errorId });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
