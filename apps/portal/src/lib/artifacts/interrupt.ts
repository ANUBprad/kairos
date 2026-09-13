import { z } from "zod";
import { AppError } from "@/lib/errors";
import { PODCAST_CONTEXT_TOKEN_BUDGET, PODCAST_HOST_PERSONAS, PODCAST_SPEAKERS } from "./podcast";

export const PODCAST_INTERRUPT_QUESTION_MAX = 300;
export const PODCAST_INTERRUPT_TURN_TEXT_MAX = 500;
export const PODCAST_INTERRUPT_TURNS_MIN = 2;
export const PODCAST_INTERRUPT_TURNS_MAX = 6;
export const PODCAST_INTERRUPTION_HISTORY_MAX = 20;
export const PODCAST_INTERRUPT_PROMPT_VERSION = "podcast-interrupt-v1";
export const PODCAST_INTERRUPT_TEMPERATURE = 0.5;
export const PODCAST_INTERRUPT_CONTEXT_TOKEN_BUDGET = PODCAST_CONTEXT_TOKEN_BUDGET;

export const interruptionTurnSchema = z.strictObject({
  speaker: z.enum(PODCAST_SPEAKERS),
  text: z.string().min(1).max(PODCAST_INTERRUPT_TURN_TEXT_MAX),
});

// A short fan-in dialogue answering exactly one listener question. Strict like
// the parent podcast schema: both hosts must speak, speakers alternately, no
// empty text, tight turn count so an interruption stays an interruption.
export const podcastInterruptSchema = z
  .strictObject({
    turns: interruptionTurnSchema
      .array()
      .min(PODCAST_INTERRUPT_TURNS_MIN)
      .max(PODCAST_INTERRUPT_TURNS_MAX),
  })
  .superRefine((data, ctx) => {
    const speakers = new Set(data.turns.map((turn) => turn.speaker));
    if (speakers.size < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["turns"],
        message: "Both hosts HOST_A and HOST_B must speak at least once",
      });
    }
    for (let i = 0; i < data.turns.length - 1; i++) {
      if (data.turns[i].speaker === data.turns[i + 1].speaker) {
        ctx.addIssue({
          code: "custom",
          path: ["turns"],
          message: `Turns must alternate speakers: the turn after index ${i} repeats ${data.turns[i].speaker}`,
        });
      }
    }
  });

export type PodcastInterruptOutput = z.infer<typeof podcastInterruptSchema>;

// The persisted interruption. Audio follows the podcast's own media shape, and
// the storage reference (storageKey + storageProvider) is server-only — the
// workspace DTO projection strips it before anything leaves the boundary.
export interface PodcastInterruptionAudio {
  provider: string;
  storageProvider: string;
  storageKey: string;
  format: "wav" | "mp3";
  durationSeconds: number | null;
}

const podcastInterruptionAudioSchema = z.strictObject({
  provider: z.string().min(1),
  storageProvider: z.string().min(1),
  storageKey: z.string().min(1),
  format: z.enum(["wav", "mp3"]),
  durationSeconds: z.number().nullable(),
});

export interface PodcastInterruptionRecord {
  id: string;
  question: string;
  turns: { speaker: "HOST_A" | "HOST_B"; text: string }[];
  createdAt: string;
  audio: PodcastInterruptionAudio;
}

const podcastInterruptionRecordSchema = z.strictObject({
  id: z.uuid(),
  question: z.string().min(1).max(PODCAST_INTERRUPT_QUESTION_MAX),
  turns: interruptionTurnSchema
    .array()
    .min(PODCAST_INTERRUPT_TURNS_MIN)
    .max(PODCAST_INTERRUPT_TURNS_MAX),
  createdAt: z.string().min(1),
  audio: podcastInterruptionAudioSchema,
});

// Tolerant window into a stored podcast's metadata.interruptions so the
// viewer and the media route never crash on malformed legacy data — invalid
// entries are skipped, never fatal.
export function parseStoredInterruptions(metadata: unknown): PodcastInterruptionRecord[] {
  const entries = (metadata as { interruptions?: unknown } | null)?.interruptions;
  if (!Array.isArray(entries)) return [];
  const records: PodcastInterruptionRecord[] = [];
  for (const entry of entries) {
    const parsed = podcastInterruptionRecordSchema.safeParse(entry);
    if (parsed.success) records.push(parsed.data);
  }
  return records;
}

// History is append-at-the-front, bounded, dropping the oldest silently. A
// lost entry on a racing write is acceptable (the audio survives in storage);
// the upgrade path if interruptions become multi-writer or independently
// queryable is a dedicated PodcastInterruption model with its own row.
export function insertInterruptionRecord(
  records: readonly PodcastInterruptionRecord[],
  next: PodcastInterruptionRecord,
): PodcastInterruptionRecord[] {
  return [next, ...records].slice(0, PODCAST_INTERRUPTION_HISTORY_MAX);
}

// Deterministic application validation; never trust a browser-supplied
// question. Returns the trimmed question or a safe, classified error.
export function parseInterruptionQuestion(input: unknown): string {
  if (typeof input !== "string") {
    throw new AppError("INVALID_QUESTION", "Question must be a string", 400);
  }
  const question = input.trim();
  if (question === "") {
    throw new AppError("INVALID_QUESTION", "Question cannot be empty", 400);
  }
  if (question.length > PODCAST_INTERRUPT_QUESTION_MAX) {
    throw new AppError(
      "INVALID_QUESTION",
      `Question must be at most ${PODCAST_INTERRUPT_QUESTION_MAX} characters`,
      400,
    );
  }
  return question;
}

const PODCAST_INTERRUPT_SYSTEM_PROMPT = `You are the writing assistant behind Kairos, a knowledge management platform. A two-host research podcast episode has just been interrupted by a listener question, and you produce the short spoken answer the hosts deliver before the episode resumes.

## Hosts
- ${PODCAST_HOST_PERSONAS.HOST_A.name} (${PODCAST_HOST_PERSONAS.HOST_A.description})
- ${PODCAST_HOST_PERSONAS.HOST_B.name} (${PODCAST_HOST_PERSONAS.HOST_B.description})

## Grounding rules
- Base EVERY statement ONLY on the content inside <source>...</source> blocks in the user message. The selected sources are the only research either host has.
- If the listener question cannot be answered from those sources, have the hosts say plainly that the sources do not cover it. Never invent an answer, an outside fact, or a citation.
- Answer only the listener question. Do not restart the episode, recap the whole podcast, or introduce new topics.
- Keep the dialogue natural, substantive and short. Avoid filler such as "great question" or "interesting point".

## Dialogue structure
- Exactly two speakers addressing each other in alternating turns, between ${PODCAST_INTERRUPT_TURNS_MIN} and ${PODCAST_INTERRUPT_TURNS_MAX} turns total.
- Either host may speak first, each host must speak at least once, no speaker talks twice in a row, and no turn is empty.

## Output format
Return ONLY a single JSON object with exactly this shape:
{"turns": [{"speaker": "HOST_A" | "HOST_B", "text": string}]}

Bound your output: between ${PODCAST_INTERRUPT_TURNS_MIN} and ${PODCAST_INTERRUPT_TURNS_MAX} turns, each turn under ${PODCAST_INTERRUPT_TURN_TEXT_MAX} characters.

Do not wrap the JSON in markdown code fences and do not add any text before or after it.`;

export function buildPodcastInterruptSystemPrompt(): string {
  return PODCAST_INTERRUPT_SYSTEM_PROMPT;
}

export function buildPodcastInterruptUserPrompt(contextText: string, question: string): string {
  return `## Listener question
${question}

## Source Content
${contextText}`;
}