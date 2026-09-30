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

/**
 * The one width this database stores. pgvector cannot index a typmod-less vector
 * column, so the schema pins the dimension and this constant must agree with
 * migration 20261122000000_pin_embedding_dimension_768. vector-store.integration
 * asserts a non-matching width is rejected, so the two cannot drift apart.
 */
export const PINNED_EMBEDDING_DIMENSION = 768;

/** Model ids that can be indexed, i.e. catalogued at the pinned width. */
export function indexableEmbeddingModels(): EmbeddingModelInfo[] {
  return EMBEDDING_MODELS.filter((m) => m.dimensions === PINNED_EMBEDDING_DIMENSION);
}

/**
 * Reject an embedding model the database cannot store, before a provider call
 * and before a raw "expected 768 dimensions" error from PostgreSQL.
 */
export function assertIndexableEmbeddingModel(model: string): void {
  const info = getModelInfo(model);
  if (info?.dimensions === PINNED_EMBEDDING_DIMENSION) return;

  const reason = info
    ? `produces ${info.dimensions}-dimensional vectors`
    : "is not a known embedding model";
  const supported = indexableEmbeddingModels()
    .map((m) => m.id)
    .join(", ");
  throw new Error(
    `Embedding model "${model}" ${reason}, but this database stores ` +
      `${PINNED_EMBEDDING_DIMENSION}-dimensional embeddings. Use one of: ${supported}, ` +
      `then reprocess the knowledge base.`,
  );
}

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
