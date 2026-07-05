import OpenAI from "openai";
import type { AIProvider } from "./types";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamChunk,
} from "../types";

const CHAT_MODELS = [
  "gpt-4o",
  "gpt-4o-mini",
  "gpt-4-turbo",
  "gpt-3.5-turbo",
];

export class OpenAIProvider implements AIProvider {
  readonly type = "openai";
  private client: OpenAI;
  private defaultChatModel: string;
  private defaultEmbeddingModel: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined,
    });
    this.defaultChatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
    this.defaultEmbeddingModel =
      process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  }

  getDefaultModel(): string {
    return this.defaultChatModel;
  }

  getAvailableModels(): string[] {
    return CHAT_MODELS;
  }

  async generateChat(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const response = await this.client.chat.completions.create({
      model: request.model || this.defaultChatModel,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
    });

    const choice = response.choices[0];
    return {
      content: choice?.message?.content || "",
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            completionTokens: response.usage.completion_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }

  async *streamChat(
    request: ChatCompletionRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const stream = await this.client.chat.completions.create({
      model: request.model || this.defaultChatModel,
      messages: request.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices?.[0]?.delta?.content || "";
      yield { content, done: false };
    }

    yield { content: "", done: true };
  }

  async generateEmbedding(
    request: EmbeddingRequest,
  ): Promise<EmbeddingResponse> {
    const model = request.model || this.defaultEmbeddingModel;
    const inputs = Array.isArray(request.input)
      ? request.input
      : [request.input];

    const response = await this.client.embeddings.create({
      model,
      input: inputs,
    });

    return {
      embeddings: response.data.map((d) => d.embedding),
      model: response.model,
      usage: response.usage
        ? {
            promptTokens: response.usage.prompt_tokens,
            totalTokens: response.usage.total_tokens,
          }
        : undefined,
    };
  }
}
