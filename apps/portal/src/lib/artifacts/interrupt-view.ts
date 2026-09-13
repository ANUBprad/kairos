import { z } from "zod";
import { interruptionTurnSchema } from "./interrupt";
import type { PodcastInterruptionRecord } from "./interrupt";
import type { Prisma } from "@prisma/client";

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
  format: "wav" | "mp3" | null;
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
    format: record.audio.format,
    durationSeconds: record.audio.durationSeconds,
  };
}

// The workspace DTO already strips media storage identities from persisted
// interruption history, so the viewer reads interruptions back through this
// lenient, client-safe projection instead of the strict persisted shape. Any
// entry that does not match is skipped (no crash on partial/legacy data), the
// same tolerance the other artifact viewers use for their parsers.
const CLIENT_INTERRUPTION_SCHEMA = z.object({
  id: z.string().min(1),
  question: z.string(),
  turns: z.array(interruptionTurnSchema),
  createdAt: z.string(),
  audio: z
    .object({
      format: z.enum(["wav", "mp3"]).optional(),
      durationSeconds: z.number().nullable().optional(),
    })
    .optional(),
});

export function parseClientInterruptions(
  metadata: Prisma.JsonValue | null,
): PodcastInterruptionView[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const raw = (metadata as Record<string, unknown>).interruptions;
  if (!Array.isArray(raw)) {
    return [];
  }
  const views: PodcastInterruptionView[] = [];
  for (const entry of raw) {
    const parsed = CLIENT_INTERRUPTION_SCHEMA.safeParse(entry);
    if (!parsed.success) {
      continue;
    }
    views.push({
      id: parsed.data.id,
      question: parsed.data.question,
      turns: parsed.data.turns,
      createdAt: parsed.data.createdAt,
      audioAvailable: Boolean(parsed.data.audio?.format),
      format: parsed.data.audio?.format ?? null,
      durationSeconds: parsed.data.audio?.durationSeconds ?? null,
    });
  }
  return views;
}