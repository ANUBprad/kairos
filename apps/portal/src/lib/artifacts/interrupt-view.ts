import type { PodcastInterruptionRecord } from "./interrupt";

// Client-facing interruption. The persisted record carries a media storage
// reference (the provider key plus its authenticated storage identity) that is
// server-only; this projection strips it at the single choke point so the
// browser gets a playback flag and the media route — never a storage identity.
export interface PodcastInterruptionView {
  id: string;
  question: string;
  turns: { speaker: "HOST_A" | "HOST_B"; text: string }[];
  createdAt: string;
  audioAvailable: boolean;
  provider: string;
  format: "wav" | "mp3";
  durationSeconds: number | null;
}

export function toWorkspaceInterruptionView(
  record: PodcastInterruptionRecord,
): PodcastInterruptionView {
  return {
    id: record.id,
    question: record.question,
    turns: record.turns,
    createdAt: record.createdAt,
    audioAvailable: true,
    provider: record.audio.provider,
    format: record.audio.format,
    durationSeconds: record.audio.durationSeconds,
  };
}