import { podcastArtifactSchema } from "./podcast";

// Typed window into a stored PODCAST payload. The podcast schema is the single
// source of truth; this only guards rendering against malformed or legacy
// content so the viewer never crashes on stored data.
export interface PodcastViewContent {
  title: string;
  summary: string;
  turns: { speaker: "HOST_A" | "HOST_B"; text: string }[];
}

export function parsePodcastContent(content: unknown): PodcastViewContent | null {
  const parsed = podcastArtifactSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

// Client-facing audio metadata (already stripped of storage references by the
// action boundary). Duration is only shown when the provider actually measured
// it — a null duration is honest, never estimated.
export interface PodcastAudioViewMetadata {
  provider: string;
  format: "wav" | "mp3";
  durationSeconds: number | null;
}

export function parsePodcastAudioMetadata(metadata: unknown): PodcastAudioViewMetadata | null {
  const audio = (metadata as { audio?: unknown } | null)?.audio;
  if (!audio || typeof audio !== "object") return null;
  const record = audio as Record<string, unknown>;
  if (typeof record.provider !== "string") return null;
  if (record.format !== "wav" && record.format !== "mp3") return null;
  const duration = record.durationSeconds;
  if (duration === null || typeof duration === "number") {
    return { provider: record.provider, format: record.format, durationSeconds: duration };
  }
  return null;
}