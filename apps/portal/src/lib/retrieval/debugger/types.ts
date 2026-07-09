export interface RetrievalChunk {
  chunkId: string;
  content: string;
  documentName: string;
  documentId: string;
  similarity: number;
  rank: number;
  tokenId: number;
  startIndex: number;
  endIndex: number;
  metadata: Record<string, unknown>;
}

export interface RetrievalStep {
  step: string;
  description: string;
  latencyMs: number;
  timestamp: number;
  input: unknown;
  output: unknown;
}

export interface PromptConstruction {
  systemPrompt: string;
  userMessage: string;
  contextChunks: RetrievalChunk[];
  totalTokens: number;
}

export interface RetrievalTrace {
  query: string;
  strategy: string;
  config: Record<string, unknown>;
  embedding: number[];
  embeddingLatencyMs: number;
  steps: RetrievalStep[];
  retrievedChunks: RetrievalChunk[];
  rerankedChunks: RetrievalChunk[];
  prompt: PromptConstruction;
  totalLatencyMs: number;
  timestamp: number;
}

export interface SimilarityMatrix {
  query: string;
  chunks: Array<{
    chunkId: string;
    content: string;
    documentName: string;
    similarity: number;
    embedding: number[];
  }>;
  queryEmbedding: number[];
}

export interface WhyNotRetrieved {
  chunkId: string;
  content: string;
  documentName: string;
  actualSimilarity: number;
  reason: string;
  threshold: number;
  topSimilarity: number;
  rank: number;
}

export interface RetrievalComparison {
  labelA: string;
  labelB: string;
  traceA: RetrievalTrace;
  traceB: RetrievalTrace;
  overlapChunks: string[];
  onlyInA: string[];
  onlyInB: string[];
  similarityDifferences: Array<{
    chunkId: string;
    similarityA: number;
    similarityB: number;
    difference: number;
  }>;
}

export interface Citation {
  chunkId: string;
  content: string;
  documentName: string;
  similarity: number;
  startOffset: number;
  endOffset: number;
  claimText: string;
}
