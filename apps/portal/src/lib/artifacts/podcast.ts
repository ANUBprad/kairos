import { z } from "zod";
import type { ArtifactDefinition } from "./definitions";

export const PODCAST_SPEAKERS = ["HOST_A", "HOST_B"] as const;
export type PodcastSpeaker = (typeof PODCAST_SPEAKERS)[number];

export const PODCAST_TITLE_MAX = 200;
export const PODCAST_SUMMARY_MAX = 1500;
export const PODCAST_TURN_TEXT_MAX = 1200;
export const PODCAST_TURNS_MAX = 30;
export const PODCAST_CONTEXT_TOKEN_BUDGET = 8000;

// The two host personas are internal studio facts, glued into the system
// prompt below so the schema and the conversation contract never drift apart.
export const PODCAST_HOST_PERSONAS: Readonly<
  Record<PodcastSpeaker, { name: string; description: string }>
> = {
  HOST_A: {
    name: "Host A",
    description:
      "Analytical, research-oriented host. Explains what the sources say, frames the important findings, and clarifies difficult concepts. Opens the episode.",
  },
  HOST_B: {
    name: "Host B",
    description:
      "Skeptical, challenging host. Presses on weak reasoning, asks clarifying questions, and tests whether the source material actually supports a claim.",
  },
};

export const podcastTurnSchema = z.strictObject({
  speaker: z.enum(PODCAST_SPEAKERS),
  text: z.string().min(1).max(PODCAST_TURN_TEXT_MAX),
});

export const podcastArtifactSchema = z
  .strictObject({
    title: z.string().min(1).max(PODCAST_TITLE_MAX),
    summary: z.string().min(1).max(PODCAST_SUMMARY_MAX),
    turns: podcastTurnSchema.array().min(2).max(PODCAST_TURNS_MAX),
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

export type PodcastArtifactOutput = z.infer<typeof podcastArtifactSchema>;

export const PODCAST_SYSTEM_PROMPT = `You are the writing assistant behind Kairos, a knowledge management platform. You produce a short, grounded two-host research podcast about the provided source content.

## Hosts
- ${PODCAST_HOST_PERSONAS.HOST_A.name} (${PODCAST_HOST_PERSONAS.HOST_A.description})
- ${PODCAST_HOST_PERSONAS.HOST_B.name} (${PODCAST_HOST_PERSONAS.HOST_B.description})

## Grounding rules
- Base EVERY statement ONLY on the content inside <source>...</source> blocks in the user message. The selected sources are the only research either host has.
- The hosts must not pretend they read, tested, or verified anything outside those sources. No independent research, no outside knowledge, no invented citations, no fabricated names, figures, or studies.
- Prefer explaining the material, comparing claims across sources, challenging the reasoning where the sources are thin, and clarifying difficult concepts.
- Keep the dialogue natural and substantive. Avoid generic filler such as "great question", "interesting point", or restating the same idea.

## Dialogue structure
- Exactly two speakers addressing each other in alternating turns.
- ${PODCAST_HOST_PERSONAS.HOST_A.name} opens the episode.
- No speaker talks twice in a row, and no turn is empty.

## Output format
Return ONLY a single JSON object with exactly this shape:
{"title": string, "summary": string, "turns": [{"speaker": "HOST_A" | "HOST_B", "text": string}]}

Bound your output: title under 200 characters, summary under 1500 characters, between 2 and 30 turns, and each turn under 1200 characters. The first turn must be from HOST_A, and speakers must alternate.

Do not wrap the JSON in markdown code fences and do not add any text before or after it.`;

export const podcastArtifactDefinition: ArtifactDefinition<typeof podcastArtifactSchema> = {
  type: "PODCAST",
  schemaVersion: 1,
  promptVersion: "podcast-v1",
  temperature: 0.5,
  contextTokenBudget: PODCAST_CONTEXT_TOKEN_BUDGET,
  outputSchema: podcastArtifactSchema,
  buildSystemPrompt: () => PODCAST_SYSTEM_PROMPT,
  buildUserPrompt: (contextText) =>
    `## Task
Write a two-host podcast episode that explains and interrogates the source content below. ${PODCAST_HOST_PERSONAS.HOST_A.name} leads the explanation, ${PODCAST_HOST_PERSONAS.HOST_B.name} challenges and clarifies it. Stay inside the material: compare claims across sources, surface where the sources are thin, and explain difficult concepts in plain language.

## Source Content
${contextText}`,
};