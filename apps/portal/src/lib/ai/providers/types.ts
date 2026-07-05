import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamChunk,
} from "../types";

export interface AIProvider {
  type: string;

  generateChat(request: ChatCompletionRequest): Promise<ChatCompletionResponse>;

  streamChat(
    request: ChatCompletionRequest,
  ): AsyncGenerator<StreamChunk, void, unknown>;

  generateEmbedding(request: EmbeddingRequest): Promise<EmbeddingResponse>;

  getDefaultModel(): string;

  getAvailableModels(): string[];
}

export interface AIProviderFactory {
  create(config: { apiKey: string; baseUrl?: string }): AIProvider;
}
