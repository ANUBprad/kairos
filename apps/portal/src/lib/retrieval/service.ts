import { prisma } from "@/lib/prisma";
import { getEmbeddingProvider } from "@/lib/ai/providers";
import { vectorStore } from "@/lib/vector";
import type { RetrievalConfig, RetrievalResultDisplay, RetrievedChunkDisplay, PerformanceMetrics, RetrievalDebugInfo } from "./types";
import { DEFAULT_RETRIEVAL_CONFIG } from "./types";
import {
  executeRetrievalWithTrace,
  strategyRegistry,
} from "./strategies";

export async function getRetrievalConfig(kbId: string): Promise<RetrievalConfig> {
  const kb = await prisma.knowledgeBase.findUnique({
    where: { id: kbId },
    select: { retrievalConfig: true },
  });

  if (!kb) return { ...DEFAULT_RETRIEVAL_CONFIG };

  const saved = kb.retrievalConfig as Record<string, unknown> | null;
  if (!saved || Object.keys(saved).length === 0) return { ...DEFAULT_RETRIEVAL_CONFIG };

  return {
    ...DEFAULT_RETRIEVAL_CONFIG,
    ...saved,
  } as RetrievalConfig;
}

export async function saveRetrievalConfig(
  kbId: string,
  config: Partial<RetrievalConfig>,
): Promise<RetrievalConfig> {
  const existing = await getRetrievalConfig(kbId);
  const merged: RetrievalConfig = { ...existing, ...config };

  await prisma.knowledgeBase.update({
    where: { id: kbId },
    data: { retrievalConfig: merged as never },
  });

  return merged;
}

export async function runRetrieval(
  kbId: string,
  query: string,
  config: RetrievalConfig,
  debugMode = false,
): Promise<RetrievalResultDisplay> {
  const startTotal = performance.now();
  const metrics: PerformanceMetrics = {
    totalMs: 0,
    embeddingMs: 0,
    vectorSearchMs: 0,
  };

  const strategyName = config.retrievalStrategy || config.retrievalMode || "vector";
  const strategyInst = strategyRegistry.get(strategyName);
  const embeddingStart = performance.now();

  if (strategyInst) {
    const trace = await executeRetrievalWithTrace(
      kbId,
      query,
      {
        strategy: strategyName as "vector" | "keyword" | "hybrid" | "query-expansion" | "multi-query" | "reranking",
        topK: config.topK,
        enableQueryExpansion: config.enableQueryExpansion || false,
        enableMultiQuery: config.enableMultiQuery || false,
        enableReranking: config.enableReranking || false,
        enableCompression: config.enableCompression || false,
        compressionConfig: {
          enabled: true,
          maxTokens: config.maxContextTokens || 4000,
          mergeOverlapping: true,
          removeDuplicates: true,
          trimRedundant: true,
        },
        hybridConfig: {
          vectorWeight: config.vectorWeight || 1.0,
          keywordWeight: config.keywordWeight || 1.0,
          rrfK: config.rrfK || 60,
        },
      },
      config.embeddingModel || "",
      config.embeddingProvider,
    );

    const totalMs = Math.round((performance.now() - startTotal) * 100) / 100;
    metrics.totalMs = totalMs;
    metrics.embeddingMs = trace.embeddingMs || 0;
    metrics.vectorSearchMs = trace.vectorSearchMs || 0;

    const chunks: RetrievedChunkDisplay[] = trace.result.map((c, i) => ({
      id: c.chunkId,
      content: c.content,
      index: c.index,
      tokenCount: c.tokenCount,
      documentId: c.documentId,
      documentName: (c.metadata as Record<string, unknown> | null)?.documentName as string || "Unknown",
      similarity: c.similarity,
      cosineDistance: Math.round((1 - c.similarity) * 10000) / 10000,
      rank: i + 1,
      pageNumber: null,
      metadata: c.metadata as Record<string, unknown> | null,
    }));

    const result: RetrievalResultDisplay = {
      chunks,
      query,
      totalChunks: chunks.length,
      latencyMs: totalMs,
      metrics,
    };

    if (debugMode) {
      result.debug = buildDebugInfo(query, config, chunks, trace);
    }

    return result;
  }

  const provider = getEmbeddingProvider(config.embeddingProvider);

  const embedResponse = await provider.generateEmbedding({
    input: query,
    model: config.embeddingModel || undefined,
  });
  const embeddingEnd = performance.now();
  metrics.embeddingMs = Math.round((embeddingEnd - embeddingStart) * 100) / 100;

  const queryEmbedding = embedResponse.embeddings[0];
  if (!queryEmbedding) {
    metrics.totalMs = Math.round((performance.now() - startTotal) * 100) / 100;
    return { chunks: [], query, totalChunks: 0, latencyMs: metrics.totalMs, metrics };
  }

  const vectorSearchStart = performance.now();
  const results = await vectorStore.similaritySearch(queryEmbedding, {
    knowledgeBaseIds: [kbId],
    topK: config.topK,
    minSimilarity: config.similarityThreshold,
  });
  const vectorSearchEnd = performance.now();
  metrics.vectorSearchMs = Math.round((vectorSearchEnd - vectorSearchStart) * 100) / 100;

  const docIds = [...new Set(results.map((r) => r.documentId))];
  const docs = docIds.length > 0
    ? await prisma.document.findMany({
        where: { id: { in: docIds } },
        select: { id: true, name: true, metadata: true },
      })
    : [];

  const docMap = new Map(docs.map((d) => [d.id, d]));

  const chunks: RetrievedChunkDisplay[] = results.map((r, i) => {
    const doc = docMap.get(r.documentId);
    const chunkMeta = r.metadata as Record<string, unknown> | null;
    return {
      id: r.chunkId,
      content: r.content,
      index: r.index,
      tokenCount: r.tokenCount,
      documentId: r.documentId,
      documentName: doc?.name || "Unknown",
      similarity: r.similarity,
      cosineDistance: Math.round((1 - r.similarity) * 10000) / 10000,
      rank: i + 1,
      pageNumber: (chunkMeta?.pageNumber as number) ?? (doc?.metadata as Record<string, unknown> | null)?.pages as number | null ?? null,
      metadata: chunkMeta,
    };
  });

  const totalMs = Math.round((performance.now() - startTotal) * 100) / 100;
  metrics.totalMs = totalMs;

  const result: RetrievalResultDisplay = {
    chunks,
    query,
    totalChunks: chunks.length,
    latencyMs: totalMs,
    metrics,
  };

  if (debugMode) {
    result.debug = buildDebugInfo(query, config, chunks);
  }

  return result;
}

function buildDebugInfo(
  query: string,
  config: RetrievalConfig,
  chunks: RetrievedChunkDisplay[],
  trace?: { strategy: string; steps: Array<{ name: string; description: string; durationMs: number; output?: unknown }> },
): RetrievalDebugInfo {
  const contextStr = chunks
    .map(
      (c, i) =>
        `[Source ${i + 1}] (Document: "${c.documentName}", Chunk #${c.index}, Score: ${Math.round(c.similarity * 100)}%)\n${c.content}`,
    )
    .join("\n\n");

  const strategyInfo = trace
    ? `## Retrieval Strategy: ${trace.strategy}\n${trace.steps.map((s) => `- ${s.description} (${s.durationMs}ms)`).join("\n")}`
    : `## Retrieval Mode: ${config.retrievalMode}`;

  const systemPrompt = `You are a helpful AI assistant for Kairos. Answer based on the retrieved context below.

${strategyInfo}

## Retrieved Context
${contextStr || "No relevant documents found."}`;

  const finalPrompt = `${systemPrompt}\n\nUser Query: ${query}`;

  const totalTokens = Math.ceil((systemPrompt.length + query.length) / 4);

  return {
    generatedQuery: query,
    expandedQuery: query,
    appliedFilters: {
      knowledgeBaseId: "current",
      topK: config.topK,
      minSimilarity: config.similarityThreshold,
      retrievalMode: config.retrievalMode,
      retrievalStrategy: config.retrievalStrategy,
      queryExpansion: config.enableQueryExpansion,
      multiQuery: config.enableMultiQuery,
      reranking: config.enableReranking,
      compression: config.enableCompression,
    },
    retrievedChunks: chunks,
    promptContext: contextStr,
    finalPrompt,
    totalTokens,
    traceSteps: trace?.steps,
  };
}

export async function runComparison(
  kbId: string,
  query: string,
  configA: RetrievalConfig,
  configB: RetrievalConfig,
  debugMode = false,
): Promise<{ a: RetrievalResultDisplay; b: RetrievalResultDisplay }> {
  const [resultA, resultB] = await Promise.all([
    runRetrieval(kbId, query, configA, debugMode),
    runRetrieval(kbId, query, configB, debugMode),
  ]);

  return { a: resultA, b: resultB };
}

export async function saveExperimentRun(
  experimentId: string | null,
  kbId: string,
  query: string,
  config: RetrievalConfig,
  result: RetrievalResultDisplay,
): Promise<string> {
  const run = await prisma.experimentRun.create({
    data: {
      experimentId,
      knowledgeBaseId: kbId,
      query,
      configSnapshot: config as never,
      retrievedChunks: result.chunks as never,
      metrics: result.metrics as never,
      debug: (result.debug || null) as never,
      latencyEmbedding: result.metrics.embeddingMs,
      latencyVectorSearch: result.metrics.vectorSearchMs,
      latencyPromptBuild: result.metrics.promptBuildMs ?? null,
      latencyLlmResponse: result.metrics.llmResponseMs ?? null,
      totalLatency: result.latencyMs,
      chunkCount: result.totalChunks,
      embeddingModel: config.embeddingModel || "",
      retrievalMode: config.retrievalMode,
    },
  });

  return run.id;
}

export async function listExperimentRuns(kbId: string) {
  return prisma.experimentRun.findMany({
    where: { knowledgeBaseId: kbId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      query: true,
      totalLatency: true,
      chunkCount: true,
      embeddingModel: true,
      retrievalMode: true,
      createdAt: true,
    },
  });
}

export async function getExperimentRun(runId: string) {
  return prisma.experimentRun.findUnique({
    where: { id: runId },
    select: {
      id: true,
      query: true,
      configSnapshot: true,
      retrievedChunks: true,
      metrics: true,
      totalLatency: true,
      chunkCount: true,
      embeddingModel: true,
      retrievalMode: true,
      createdAt: true,
      knowledgeBaseId: true,
    },
  });
}
