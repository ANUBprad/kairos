export interface StrategyDocument {
  chunkId: string;
  documentId: string;
  content: string;
  index: number;
  tokenCount: number | null;
  metadata: Record<string, unknown> | null;
  similarity: number;
  source?: string;
}

export type ProviderType = "openai" | "gemini";

export interface RetrievalContext {
  kbId: string;
  query: string;
  topK: number;
  minSimilarity: number;
  embeddingModel: string;
  embeddingProvider: ProviderType;
  expandedQueries?: string[];
}

export interface RetrievalStrategy {
  readonly name: string;
  readonly description: string;
  retrieve(ctx: RetrievalContext): Promise<RetrievalResult>;
}

export interface RetrievalResult {
  chunks: StrategyDocument[];
  metadata: Record<string, unknown>;
}

export interface FusionInput {
  chunks: StrategyDocument[];
  weight: number;
  label: string;
}

export interface RRFParams {
  k: number;
}

export interface RerankerInput {
  query: string;
  chunks: StrategyDocument[];
  topK: number;
}

export interface CompressionResult {
  chunks: StrategyDocument[];
  originalTokens: number;
  compressedTokens: number;
  reductionPercent: number;
}

export interface ExpansionResult {
  originalQuery: string;
  expandedQueries: string[];
}

export interface MultiQueryResult {
  queries: string[];
  allChunks: StrategyDocument[];
}

export interface StrategyStep {
  name: string;
  description: string;
  durationMs: number;
  input?: unknown;
  output?: unknown;
}

export interface FullRetrievalTrace {
  strategy: string;
  query: string;
  steps: StrategyStep[];
  result: StrategyDocument[];
  totalDurationMs: number;
}
