import type { ProviderType } from "@/lib/ai/types";

export interface EmbeddingModelInfo {
  id: string;
  provider: string;
  label: string;
  dimensions: number;
  description: string;
  maxTokens: number;
  costPer1kTokens: number;
}

export const EMBEDDING_MODELS: EmbeddingModelInfo[] = [
  {
    id: "text-embedding-3-small",
    provider: "openai",
    label: "text-embedding-3-small",
    dimensions: 1536,
    description: "OpenAI's most cost-efficient embedding model",
    maxTokens: 8191,
    costPer1kTokens: 0.00002,
  },
  {
    id: "text-embedding-3-large",
    provider: "openai",
    label: "text-embedding-3-large",
    dimensions: 3072,
    description: "OpenAI's most capable embedding model",
    maxTokens: 8191,
    costPer1kTokens: 0.00013,
  },
  {
    id: "text-embedding-ada-002",
    provider: "openai",
    label: "text-embedding-ada-002",
    dimensions: 1536,
    description: "OpenAI's legacy embedding model (deprecated)",
    maxTokens: 8191,
    costPer1kTokens: 0.00010,
  },
  {
    id: "text-embedding-004",
    provider: "gemini",
    label: "text-embedding-004",
    dimensions: 768,
    description: "Google's latest embedding model",
    maxTokens: 2048,
    costPer1kTokens: 0.000025,
  },
  {
    id: "embedding-001",
    provider: "gemini",
    label: "embedding-001",
    dimensions: 768,
    description: "Google's legacy embedding model",
    maxTokens: 2048,
    costPer1kTokens: 0.000025,
  },
];

export const EMBEDDING_PROVIDERS = [
  { id: "openai", label: "OpenAI", models: EMBEDDING_MODELS.filter((m) => m.provider === "openai") },
  { id: "gemini", label: "Gemini", models: EMBEDDING_MODELS.filter((m) => m.provider === "gemini") },
];

export function getModelInfo(modelId: string): EmbeddingModelInfo | undefined {
  return EMBEDDING_MODELS.find((m) => m.id === modelId);
}

export const DEFAULT_EMBEDDING_MODEL: Record<ProviderType, string> = {
  openai: "text-embedding-3-small",
  gemini: "text-embedding-004",
};

export function defaultEmbeddingProvider(): ProviderType {
  return process.env.AI_PROVIDER === "gemini" ? "gemini" : "openai";
}

/**
 * The single place the embedding provider/model is decided. Precedence is
 * explicit override (request or CLI) > knowledge base retrievalConfig > env.
 * Ingestion, Research Chat and the Retrieval Lab must all resolve through here:
 * if any one of them embeds a query with a different model than the documents it
 * searches, pgvector silently returns nothing or raises a raw dimension error.
 */
export function resolveEmbeddingModel(
  provider?: ProviderType,
  model?: string,
): { provider: ProviderType; model: string } {
  const resolvedProvider = provider || defaultEmbeddingProvider();
  const resolvedModel =
    model ||
    (resolvedProvider === "gemini"
      ? process.env.GEMINI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL.gemini
      : process.env.OPENAI_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL.openai);
  return { provider: resolvedProvider, model: resolvedModel };
}
