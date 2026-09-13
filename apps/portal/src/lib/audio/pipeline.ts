import type { PodcastSpeaker } from "@/lib/artifacts";
import type { AudioSegment, AssembledAudio } from "./assembly";
import { assemblePodcastSegments } from "./assembly";
import type { TTSProvider, TTSProviderType } from "./types";
import { getTTSProvider } from "./providers/index";
import { ELEVENLABS_VOICE_HOST_A_ENV, ELEVENLABS_VOICE_HOST_B_ENV } from "./providers/elevenlabs";

// Speaker voices. Local is a deterministic seed; ElevenLabs voices come from
// the environment (validated when the provider is selected) so no voice id or
// key ever belongs in code.
export const PODCAST_VOICE_HOST_A = "kairos-host-a";
export const PODCAST_VOICE_HOST_B = "kairos-host-b";

export function resolveSpeakerVoiceId(speaker: PodcastSpeaker, providerType: TTSProviderType): string {
  if (providerType === "elevenlabs") {
    const envName = speaker === "HOST_A" ? ELEVENLABS_VOICE_HOST_A_ENV : ELEVENLABS_VOICE_HOST_B_ENV;
    const voice = process.env[envName];
    if (!voice) throw new Error(`${envName} is not configured`);
    return voice;
  }
  return speaker === "HOST_A" ? PODCAST_VOICE_HOST_A : PODCAST_VOICE_HOST_B;
}

export interface PodcastSynthesisInput {
  turns: { speaker: PodcastSpeaker; text: string }[];
  provider?: TTSProvider;
}

export interface PodcastSynthesisResult extends AssembledAudio {
  /** number of speech segments synthesized (one per turn) */
  segments: number;
  provider: TTSProviderType;
}

// Synthesizes each turn in order with the voice bound to its speaker, then
// assembles the episode. One throw from any stage fails the whole episode —
// the engine turns that into an atomic FAILED artifact, never a partial one.
export async function generatePodcastAudio(input: PodcastSynthesisInput): Promise<PodcastSynthesisResult> {
  if (input.turns.length === 0) throw new Error("Podcast has no turns to synthesize");
  const provider = input.provider ?? getTTSProvider();

  const segments: AudioSegment[] = [];
  for (const turn of input.turns) {
    const voiceId = resolveSpeakerVoiceId(turn.speaker, provider.type);
    const result = await provider.synthesize({ text: turn.text, voiceId });
    segments.push({ audio: result.audio, format: result.format });
  }

  const assembled = assemblePodcastSegments(segments);
  return { ...assembled, segments: segments.length, provider: provider.type };
}