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


