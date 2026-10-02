import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamChunk,
} from "../types";

/**
 * Server-side ceiling on generated tokens per request, applied to every
 * provider call. Callers may request less (retrieval strategies ask for 256);
 * nobody may request more. Without this a call that omits `maxTokens` inherits
 * the provider's own default, which is unbounded in practice.
 *
 * The default clears the largest legitimate artifact payload (a maximum-size
 * podcast episode is ~36k characters, ~9k tokens) so bounding generation does
 * not truncate a valid artifact into a schema-parse failure; it exists to cap
 * the runaway tail, not to shrink normal output.
 */
export const MAX_OUTPUT_TOKENS = 16384;

export function resolveMaxOutputTokens(requested?: number): number {
  const configured = Number(process.env.AI_MAX_OUTPUT_TOKENS);
  const ceiling =
    Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : MAX_OUTPUT_TOKENS;
  if (requested === undefined || !Number.isFinite(requested)) return ceiling;
  return Math.max(1, Math.min(Math.floor(requested), ceiling));
}

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
