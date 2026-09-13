export type TTSProviderType = "local" | "elevenlabs";

export type AudioFormat = "wav" | "mp3";

// Internal contract between the podcast pipeline and the speech synthesizer.
// No provider SDK type is exposed here — the rest of Kairos only sees bytes,
// an explicitly chosen format, and a duration when the provider actually
// measured one (not a fabricated estimate).
export interface TTSRequest {
  text: string;
  voiceId: string;
}

export interface TTSResult {
  audio: Buffer;
  format: AudioFormat;
  durationSeconds: number | null;
  provider: TTSProviderType;
}

export interface TTSProvider {
  readonly type: TTSProviderType;
  synthesize(request: TTSRequest): Promise<TTSResult>;
}