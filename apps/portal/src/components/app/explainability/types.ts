export interface ExplainerChunk {
  chunkId: string;
  content: string;
  documentName: string;
  documentId: string;
  similarity: number;
  rank: number;
  originalRank?: number;
  tokenCount?: number;
  pageNumber?: number | null;
  metadata?: Record<string, unknown>;
}

export interface ExplainerPipelineStep {
  name: string;
  description: string;
  durationMs: number;
  output?: Record<string, unknown>;
  status?: "completed" | "active" | "pending" | "error";
}

export interface ExplainerPrompt {
  systemPrompt: string;
  messages: { role: string; content: string }[];
  estimatedTokens: number;
}

export interface ExplainerRetrieval {
  query: string;
  chunks: ExplainerChunk[];
  totalChunks: number;
  latencyMs: number;
  rerankedChunks?: ExplainerChunk[];
}

export interface ExplainerConfig {
  chunkStrategy: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  embeddingModel: string;
  retrievalMode: string;
  retrievalStrategy?: string;
  queryExpansion?: boolean;
  multiQuery?: boolean;
  reranking?: boolean;
  compression?: boolean;
}

export interface ExplainerCitation {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number | null;
  excerpt: string;
  similarity: number;
}

export interface ExplainerPipelineData {
  strategy: string;
  steps: ExplainerPipelineStep[];
  retrieval: ExplainerRetrieval;
  prompt: ExplainerPrompt;
  config: ExplainerConfig;
}

export interface ConfidenceFactors {
  avgSimilarity: number;
  maxSimilarity: number;
  chunkCount: number;
  citationCoverage: number;
  promptCompleteness: number;
}

export interface TokenBreakdown {
  system: number;
  context: number;
  history: number;
  user: number;
  total: number;
  maxTokens: number;
  utilization: number;
}
