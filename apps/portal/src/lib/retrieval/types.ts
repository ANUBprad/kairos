import type { ChunkStrategy } from "@/lib/chunking/types";
import type { ProviderType } from "@/lib/ai/types";
import type { StrategyName } from "./strategies";

export type RetrievalMode = "vector" | "hybrid" | "keyword";

export interface RetrievalConfig {
  chunkStrategy: ChunkStrategy;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  embeddingModel: string;
  retrievalMode: RetrievalMode;
  embeddingProvider: ProviderType;
  retrievalStrategy?: StrategyName;
  enableQueryExpansion?: boolean;
  enableMultiQuery?: boolean;
  enableReranking?: boolean;
  enableCompression?: boolean;
  vectorWeight?: number;
  keywordWeight?: number;
  rrfK?: number;
  maxContextTokens?: number;
}

export const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  chunkStrategy: "recursive",
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 10,
  similarityThreshold: 0.7,
  embeddingModel: "",
  retrievalMode: "vector",
  embeddingProvider: "openai",
  retrievalStrategy: "hybrid",
  enableQueryExpansion: false,
  enableMultiQuery: false,
  enableReranking: false,
  enableCompression: false,
  vectorWeight: 1.0,
  keywordWeight: 1.0,
  rrfK: 60,
  maxContextTokens: 4000,
};

export const RETRIEVAL_MODES: { value: RetrievalMode; label: string; description: string }[] = [
  { value: "vector", label: "Vector Search", description: "Semantic similarity search using embeddings" },
  { value: "hybrid", label: "Hybrid Search", description: "Combined vector and keyword search" },
  { value: "keyword", label: "Keyword Search", description: "Traditional keyword/text search" },
];

export const RETRIEVAL_STRATEGIES: { value: StrategyName; label: string; description: string }[] = [
  { value: "vector", label: "Vector Search", description: "Pure semantic embedding search" },
  { value: "keyword", label: "BM25 Keyword", description: "Pure keyword/text search" },
  { value: "hybrid", label: "Hybrid (Vector + BM25)", description: "Combined with RRF fusion" },
  { value: "query-expansion", label: "Query Expansion", description: "LLM-expanded queries with vector search" },
  { value: "multi-query", label: "Multi-Query", description: "Multiple semantic query variations" },
  { value: "reranking", label: "Reranking", description: "Cross-encoder style reranking" },
];

export interface RetrievedChunkDisplay {
  id: string;
  content: string;
  index: number;
  tokenCount: number | null;
  documentId: string;
  documentName: string;
  similarity: number;
  cosineDistance: number;
  rank: number;
  pageNumber?: number | null;
  metadata: Record<string, unknown> | null;
}

export interface RetrievalResultDisplay {
  chunks: RetrievedChunkDisplay[];
  query: string;
  totalChunks: number;
  latencyMs: number;
  metrics: PerformanceMetrics;
  debug?: RetrievalDebugInfo;
}

export interface PerformanceMetrics {
  totalMs: number;
  embeddingMs: number;
  vectorSearchMs: number;
  promptBuildMs?: number;
  llmResponseMs?: number;
}

export interface RetrievalDebugInfo {
  generatedQuery: string;
  expandedQuery: string;
  appliedFilters: Record<string, unknown>;
  retrievedChunks: RetrievedChunkDisplay[];
  promptContext: string;
  finalPrompt: string;
  totalTokens: number;
  traceSteps?: Array<{ name: string; description: string; durationMs: number; output?: unknown }>;
}
