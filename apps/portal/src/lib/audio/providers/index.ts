import type { TTSProvider, TTSProviderType } from "../types";
import { LocalTTSProvider } from "./local";
import { createElevenLabsProvider } from "./elevenlabs";

export const TTS_PROVIDER_ENV = "TTS_PROVIDER";

function configuredProviderType(): string {
  return process.env[TTS_PROVIDER_ENV] ?? "local";
}

// Resolves the configured or explicit provider name, rejecting unknown
// values at the boundary. Reads the environment at call time so tests can
// exercise selection without process stalls.
export function resolveTTSProviderType(value?: string): TTSProviderType {
  const resolved = value ?? configuredProviderType();
  if (resolved === "local" || resolved === "elevenlabs") return resolved;
  throw new Error(
    `Unknown TTS provider type: ${resolved}. Set ${TTS_PROVIDER_ENV}=local or ${TTS_PROVIDER_ENV}=elevenlabs.`,
  );
}

// Creates the configured TTS provider. Selection is explicit: production
// (elevenlabs) never silently falls back to the local fixture when its
// credentials are missing — that would be a config error, surfaced here.
export function getTTSProvider(type?: TTSProviderType): TTSProvider {
  const resolvedType = resolveTTSProviderType(type);
  switch (resolvedType) {
    case "local":
      return new LocalTTSProvider();
    case "elevenlabs":
      return createElevenLabsProvider();
  }
}

export type { TTSProvider } from "../types";