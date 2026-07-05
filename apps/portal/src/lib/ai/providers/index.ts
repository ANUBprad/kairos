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

export type { AIProvider } from "./types";
export { OpenAIProvider } from "./openai";
export { GeminiProvider } from "./gemini";
