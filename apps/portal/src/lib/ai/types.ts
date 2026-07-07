export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatCompletionResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
  citations?: CitationSource[];
}

export interface EmbeddingRequest {
  input: string | string[];
  model?: string;
}

export interface EmbeddingResponse {
  embeddings: number[][];
  model: string;
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export type ProviderType = "openai" | "gemini";

export interface RetrievedChunk {
  id: string;
  content: string;
  index: number;
  tokenCount: number | null;
  documentId: string;
  documentName: string;
  similarity: number;
  pageNumber?: number | null;
  metadata: Record<string, unknown> | null;
}

export interface CitationSource {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber?: number | null;
  excerpt: string;
  similarity: number;
}
