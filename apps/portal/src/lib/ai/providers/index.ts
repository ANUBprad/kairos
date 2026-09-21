import type { AIProvider } from "./types";
import type { ProviderType } from "../types";
import { OpenAIProvider } from "./openai";
import { GeminiProvider } from "./gemini";

const providerCache = new Map<string, AIProvider>();

function getOpenAIProvider(): AIProvider {
  const key = "openai";
  const cached = providerCache.get(key);
  if (cached) return cached;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const provider = new OpenAIProvider({ apiKey });
  providerCache.set(key, provider);
  return provider;
}

function getGeminiProvider(): AIProvider {
  const key = "gemini";
  const cached = providerCache.get(key);
  if (cached) return cached;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const provider = new GeminiProvider({ apiKey });
  providerCache.set(key, provider);
  return provider;
}

export function getAIProvider(type?: ProviderType): AIProvider {
  const resolvedType: ProviderType = type || (process.env.AI_PROVIDER as ProviderType) || "openai";

  switch (resolvedType) {
    case "openai":
      return getOpenAIProvider();
    case "gemini":
      return getGeminiProvider();
    default:
      throw new Error(`Unknown AI provider type: ${resolvedType}`);
  }
}

export function getEmbeddingProvider(type?: ProviderType): AIProvider {
  return getAIProvider(type);
}

// Canonical chat-model gate: a model string may only be used when it is one of
// the resolved provider's known models. Any other value (forged request field,
// forged or stale stored conversation model) is rejected so it can never reach
// the LLM API. Returns false when the provider is not configured rather than
// surfacing configuration errors mid-request.
export function isChatModelAllowed(providerType: ProviderType | undefined, model: string | undefined): boolean {
  if (!model) return false;
  try {
    return getAIProvider(providerType).getAvailableModels().includes(model);
  } catch {
    return false;
  }
}

// The provider SDK clients capture globalThis.fetch at construction, so cached
// clients outlive any per-test fetch stub. Test code calls this to give each
// test a fresh client bound to its own stub.
export function resetAIProviderCache(): void {
  providerCache.clear();
}

export type { AIProvider } from "./types";
export { OpenAIProvider } from "./openai";
export { GeminiProvider } from "./gemini";
