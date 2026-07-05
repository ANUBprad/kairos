import type { RetrievalStrategy, RetrievalContext, FullRetrievalTrace, StrategyStep, ProviderType } from "./types";
import { VectorStrategy } from "./vector";
import { KeywordStrategy } from "./keyword";
import { HybridStrategy } from "./hybrid";
import { QueryExpansionStrategy, expandQuery } from "./query-expansion";
import { MultiQueryStrategy, generateMultiQueries } from "./multi-query";
import { RerankingStrategy, LLMReranker } from "./reranking";
import { compressContext } from "./context-compression";
import type { CompressionConfig } from "./context-compression";
import type { HybridConfig } from "./hybrid";

export type StrategyName = "vector" | "keyword" | "hybrid" | "query-expansion" | "multi-query" | "reranking";

export interface StrategyConfig {
  strategy: StrategyName;
  hybridConfig?: Partial<HybridConfig>;
  enableQueryExpansion?: boolean;
  enableMultiQuery?: boolean;
  enableReranking?: boolean;
  enableCompression?: boolean;
  compressionConfig?: Partial<CompressionConfig>;
  rrfK?: number;
  topK?: number;
}

const DEFAULT_STRATEGY_CONFIG: StrategyConfig = {
  strategy: "hybrid",
  hybridConfig: { vectorWeight: 1.0, keywordWeight: 1.0, rrfK: 60 },
  enableQueryExpansion: false,
  enableMultiQuery: false,
  enableReranking: false,
  enableCompression: false,
  compressionConfig: { enabled: true, maxTokens: 4000, mergeOverlapping: true, removeDuplicates: true, trimRedundant: true },
};

export class RetrievalStrategyRegistry {
  private strategies = new Map<string, RetrievalStrategy>();

  constructor() {
    this.register(new VectorStrategy());
    this.register(new KeywordStrategy());
    this.register(new HybridStrategy());
  }

  register(strategy: RetrievalStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  get(name: string): RetrievalStrategy | undefined {
    return this.strategies.get(name);
  }

  getAll(): RetrievalStrategy[] {
    return Array.from(this.strategies.values());
  }

  getDescriptions(): Array<{ name: string; description: string }> {
    return this.getAll().map((s) => ({ name: s.name, description: s.description }));
  }
}

export const strategyRegistry = new RetrievalStrategyRegistry();

export async function executeRetrievalWithTrace(
  kbId: string,
  query: string,
  config: StrategyConfig,
  embeddingModel: string,
  embeddingProvider: ProviderType,
): Promise<FullRetrievalTrace> {
  const startTotal = performance.now();
  const steps: StrategyStep[] = [];
  const mergedConfig = { ...DEFAULT_STRATEGY_CONFIG, ...config };
  const topK = config.topK || 10;

  const ctx: RetrievalContext = {
    kbId,
    query,
    topK,
    minSimilarity: 0.0,
    embeddingModel,
    embeddingProvider,
  };

  const baseStrategy = strategyRegistry.get(mergedConfig.strategy) || strategyRegistry.get("vector")!;

  let activeStrategy: RetrievalStrategy = baseStrategy;

  if (mergedConfig.enableQueryExpansion) {
    const qeStart = performance.now();
    const expanded = await expandQuery(query, embeddingProvider);
    const wrapper = new QueryExpansionStrategy(activeStrategy);
    const qeDuration = Math.round((performance.now() - qeStart) * 100) / 100;
    steps.push({
      name: "query-expansion",
      description: "LLM-based query expansion",
      durationMs: qeDuration,
      output: { expandedQueries: expanded.expandedQueries },
    });
    ctx.expandedQueries = expanded.expandedQueries;
    activeStrategy = wrapper;
  }

  if (mergedConfig.enableMultiQuery) {
    const mqStart = performance.now();
    const variations = await generateMultiQueries(query, embeddingProvider);
    const wrapper = new MultiQueryStrategy(activeStrategy);
    const mqDuration = Math.round((performance.now() - mqStart) * 100) / 100;
    steps.push({
      name: "multi-query",
      description: "Multi-query semantic variations",
      durationMs: mqDuration,
      output: { variations },
    });
    activeStrategy = wrapper;
  }

  if (mergedConfig.enableReranking) {
    const rerankerStrategy = new RerankingStrategy(activeStrategy, new LLMReranker(), {
      enabled: true,
      topKAfterRerank: topK,
      model: "cross-encoder",
    });
    activeStrategy = rerankerStrategy;
  }

  const retrieveStart = performance.now();
  const result = await activeStrategy.retrieve(ctx);
  const retrieveDuration = Math.round((performance.now() - retrieveStart) * 100) / 100;

  steps.push({
    name: mergedConfig.strategy,
    description: `Using ${mergedConfig.strategy} strategy`,
    durationMs: retrieveDuration,
    output: {
      chunkCount: result.chunks.length,
      metadata: result.metadata,
    },
  });

  let finalChunks = result.chunks;

  if (mergedConfig.enableCompression && mergedConfig.compressionConfig) {
    const compressStart = performance.now();
    const compressed = compressContext(finalChunks, mergedConfig.compressionConfig);
    const compressDuration = Math.round((performance.now() - compressStart) * 100) / 100;

    steps.push({
      name: "context-compression",
      description: "Context compression (dedup, merge, trim)",
      durationMs: compressDuration,
      output: {
        originalTokens: compressed.originalTokens,
        compressedTokens: compressed.compressedTokens,
        reductionPercent: compressed.reductionPercent,
      },
    });

    finalChunks = compressed.chunks;
  }

  const totalDurationMs = Math.round((performance.now() - startTotal) * 100) / 100;

  return {
    strategy: mergedConfig.strategy,
    query,
    steps,
    result: finalChunks,
    totalDurationMs,
  };
}

export async function executeStrategyComparison(
  kbId: string,
  query: string,
  configs: StrategyConfig[],
  embeddingModel: string,
  embeddingProvider: ProviderType,
): Promise<FullRetrievalTrace[]> {
  return Promise.all(
    configs.map((cfg) =>
      executeRetrievalWithTrace(kbId, query, cfg, embeddingModel, embeddingProvider),
    ),
  );
}

export { VectorStrategy } from "./vector";
export { KeywordStrategy } from "./keyword";
export { HybridStrategy } from "./hybrid";
export { QueryExpansionStrategy, expandQuery } from "./query-expansion";
export { MultiQueryStrategy, generateMultiQueries } from "./multi-query";
export { RerankingStrategy, LLMReranker } from "./reranking";
export { compressContext, compressContextWithLLM } from "./context-compression";
export { BM25 } from "./bm25";
export type { RetrievalContext, RetrievalResult, StrategyDocument, FullRetrievalTrace, StrategyStep, FusionInput } from "./types";
