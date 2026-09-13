import type { TTSProvider, TTSRequest, TTSResult } from "../types";

export const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech";
export const ELEVENLABS_API_KEY_ENV = "ELEVENLABS_API_KEY";
export const ELEVENLABS_VOICE_HOST_A_ENV = "ELEVENLABS_VOICE_HOST_A";
export const ELEVENLABS_VOICE_HOST_B_ENV = "ELEVENLABS_VOICE_HOST_B";

// Fetch-based REST client, mirroring the Gemini provider convention: no SDK
// dependency, key sent via the xi-api-key header, response consumed as raw
// audio bytes. Duration is not measured for MP3 without a decoder, so it is
// reported as null rather than fabricated.
export class ElevenLabsTTSProvider implements TTSProvider {
  readonly type = "elevenlabs";

  constructor(private readonly config: { apiKey: string }) {}

  async synthesize(request: TTSRequest): Promise<TTSResult> {
    const text = request.text.trim();
    if (!text) throw new Error("TTS text must not be empty");

    const res = await fetch(
      `${ELEVENLABS_API_URL}/${encodeURIComponent(request.voiceId)}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": this.config.apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          // ponytail: model hardcoded; if the default lumen/route changes,
          // upgrade path is an env-driven override resolved at construction.
          model_id: "eleven_multilingual_v2",
        }),
      },
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`ElevenLabs TTS API error: ${res.status} ${err}`);
    }

    const audio = Buffer.from(await res.arrayBuffer());
    if (audio.length === 0) {
      throw new Error("ElevenLabs TTS returned empty audio");
    }

    return {
      audio,
      format: "mp3",
      durationSeconds: null,
      provider: "elevenlabs",
    };
  }
}

// Config validation happens at selection time, never a silent fallback: with
// the provider explicitly set to elevenlabs, missing credentials are a hard
// error rather than an accidental downgrade to the local fixture.
export function createElevenLabsProvider(): TTSProvider {
  const apiKey = process.env[ELEVENLABS_API_KEY_ENV];
  if (!apiKey) throw new Error(`${ELEVENLABS_API_KEY_ENV} is not configured`);
  if (!process.env[ELEVENLABS_VOICE_HOST_A_ENV] || !process.env[ELEVENLABS_VOICE_HOST_B_ENV]) {
    throw new Error(
      `${ELEVENLABS_VOICE_HOST_A_ENV} and ${ELEVENLABS_VOICE_HOST_B_ENV} are not configured`,
    );
  }
  return new ElevenLabsTTSProvider({ apiKey });
}