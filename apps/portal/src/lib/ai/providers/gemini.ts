import type { AIProvider } from "./types";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  EmbeddingRequest,
  EmbeddingResponse,
  StreamChunk,
} from "../types";

const CHAT_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
];

export class GeminiProvider implements AIProvider {
  readonly type = "gemini";
  private apiKey: string;
  private defaultChatModel: string;
  private defaultEmbeddingModel: string;

  constructor(config: { apiKey: string; baseUrl?: string }) {
    this.apiKey = config.apiKey;
    this.defaultChatModel = process.env.GEMINI_CHAT_MODEL || "gemini-2.0-flash";
    this.defaultEmbeddingModel =
      process.env.GEMINI_EMBEDDING_MODEL || "text-embedding-004";
  }

  getDefaultModel(): string {
    return this.defaultChatModel;
  }

  getAvailableModels(): string[] {
    return CHAT_MODELS;
  }

  private apiUrl(path: string): string {
    return `https://generativelanguage.googleapis.com/v1beta/${path}?key=${this.apiKey}`;
  }

  async generateChat(
    request: ChatCompletionRequest,
  ): Promise<ChatCompletionResponse> {
    const model = request.model || this.defaultChatModel;
    const contents = this.toGeminiContents(request.messages);
    const systemInstruction = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const res = await fetch(this.apiUrl(`models/${model}:generateContent`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${res.status} ${err}`);
    }

    const data = await res.json();
    const text =
      data.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("") || "";

    return {
      content: text,
      model,
      usage: data.usageMetadata
        ? {
            promptTokens: data.usageMetadata.promptTokenCount || 0,
            completionTokens: data.usageMetadata.candidatesTokenCount || 0,
            totalTokens: data.usageMetadata.totalTokenCount || 0,
          }
        : undefined,
    };
  }

  async *streamChat(
    request: ChatCompletionRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const model = request.model || this.defaultChatModel;
    const contents = this.toGeminiContents(request.messages);
    const systemInstruction = request.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: request.temperature ?? 0.7,
        maxOutputTokens: request.maxTokens,
      },
    };

    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const res = await fetch(
      this.apiUrl(`models/${model}:streamGenerateContent`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini stream error: ${res.status} ${err}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;

        try {
          const json = JSON.parse(trimmed.slice(6));
          const parts = json.candidates?.[0]?.content?.parts || [];
          const text = parts
            .filter((p: { text?: string }) => p.text)
            .map((p: { text: string }) => p.text)
            .join("");
          if (text) yield { content: text, done: false };
        } catch {
          // skip malformed SSE lines
        }
      }
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

    const embeddings: number[][] = [];

    for (const input of inputs) {
      const res = await fetch(this.apiUrl(`models/${model}:embedContent`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: { parts: [{ text: input }] },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini embedding error: ${res.status} ${err}`);
      }

      const data = await res.json();
      if (data.embedding?.values) {
        embeddings.push(data.embedding.values);
      }
    }

    return { embeddings, model };
  }

  private toGeminiContents(
    messages: ChatCompletionRequest["messages"],
  ): unknown[] {
    const nonSystem = messages.filter((m) => m.role !== "system");
    return nonSystem.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));
  }
}
