import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  interruptionTurnSchema,
  podcastInterruptSchema,
  parseInterruptionQuestion,
  parseStoredInterruptions,
  insertInterruptionRecord,
  buildPodcastInterruptSystemPrompt,
  buildPodcastInterruptUserPrompt,
  PODCAST_INTERRUPT_QUESTION_MAX,
  PODCAST_INTERRUPT_TURN_TEXT_MAX,
  PODCAST_INTERRUPT_TURNS_MIN,
  PODCAST_INTERRUPT_TURNS_MAX,
  PODCAST_INTERRUPTION_HISTORY_MAX,
  PODCAST_INTERRUPT_PROMPT_VERSION,
  PODCAST_INTERRUPT_TEMPERATURE,
  type PodcastInterruptionRecord,
} from "@/lib/artifacts";

const validPayload = {
  turns: [
    { speaker: "HOST_A" as const, text: "The source explains the catalytic step." },
    { speaker: "HOST_B" as const, text: "And it holds up under scrutiny?" },
  ],
};

function record(id: string, overrides: Partial<PodcastInterruptionRecord> = {}): PodcastInterruptionRecord {
  return {
    id,
    question: "Does the source support the catalytic claim?",
    createdAt: "2026-01-02T03:04:05.000Z",
    turns: validPayload.turns,
    audio: {
      provider: "local",
      storageProvider: "cloudinary",
      storageKey: `artifacts/podcast-clx-a/interruptions/${id}`,
      format: "wav",
      durationSeconds: 4.2,
    },
    ...overrides,
  };
}

describe("podcast interruption schema", () => {
  it("accepts a valid two-host dialogue", () => {
    const result = podcastInterruptSchema.safeParse(validPayload);
    assert.deepEqual(result.success ? result.data : null, validPayload);
  });

  it("accepts dialogues up to the turn bound", () => {
    const long = {
      turns: Array.from({ length: PODCAST_INTERRUPT_TURNS_MAX }, (_, i) => ({
        speaker: (i % 2 === 0 ? "HOST_A" : "HOST_B") as "HOST_A" | "HOST_B",
        text: `Turn ${i}`,
      })),
    };
    assert.equal(podcastInterruptSchema.safeParse(long).success, true);
  });

  it("rejects fewer than two turns and more than the turn bound", () => {
    assert.equal(
      podcastInterruptSchema.safeParse({ turns: [{ speaker: "HOST_A", text: "Only me" }] }).success,
      false,
    );
    const tooLong = {
      turns: Array.from({ length: PODCAST_INTERRUPT_TURNS_MAX + 1 }, (_, i) => ({
        speaker: (i % 2 === 0 ? "HOST_A" : "HOST_B") as "HOST_A" | "HOST_B",
        text: `Turn ${i}`,
      })),
    };
    assert.equal(podcastInterruptSchema.safeParse(tooLong).success, false);
  });

  it("rejects dialogues where only one host speaks", () => {
    assert.equal(
      podcastInterruptSchema.safeParse({
        turns: [
          { speaker: "HOST_A", text: "One" },
          { speaker: "HOST_A", text: "Two" },
        ],
      }).success,
      false,
    );
  });

  it("rejects repeated speakers (no adjacent alternation)", () => {
    assert.equal(
      podcastInterruptSchema.safeParse({
        turns: [
          { speaker: "HOST_A", text: "One" },
          { speaker: "HOST_B", text: "Two" },
          { speaker: "HOST_B", text: "Three" },
        ],
      }).success,
      false,
    );
  });

  it("rejects empty and over-bound turn text", () => {
    assert.equal(
      podcastInterruptSchema.safeParse({
        turns: [
          { speaker: "HOST_A", text: "" },
          { speaker: "HOST_B", text: "Two" },
        ],
      }).success,
      false,
    );
    assert.equal(
      podcastInterruptSchema.safeParse({
        turns: [
          { speaker: "HOST_A", text: "x".repeat(PODCAST_INTERRUPT_TURN_TEXT_MAX + 1) },
          { speaker: "HOST_B", text: "Two" },
        ],
      }).success,
      false,
    );
  });

  it("strictly rejects unknown extra keys and non-string text", () => {
    assert.equal(podcastInterruptSchema.safeParse({ ...validPayload, footnote: "x" }).success, false);
    assert.equal(
      podcastInterruptSchema.safeParse({
        turns: [{ speaker: "HOST_A", text: 42 }, { speaker: "HOST_B", text: "y" }],
      }).success,
      false,
    );
    assert.equal(
      interruptionTurnSchema.safeParse({ speaker: "HOST_C", text: "no" }).success,
      false,
    );
  });
});

describe("podcast interruption question validation", () => {
  it("trims and returns the question", () => {
    assert.equal(parseInterruptionQuestion("  What does the source say?  "), "What does the source say?");
  });

  it("accepts a question exactly at the bound", () => {
    assert.equal(parseInterruptionQuestion("q".repeat(PODCAST_INTERRUPT_QUESTION_MAX)).length, PODCAST_INTERRUPT_QUESTION_MAX);
  });

  it("rejects empty, whitespace-only, and non-string input with a classified error", () => {
    assert.throws(() => parseInterruptionQuestion(""), { code: "INVALID_QUESTION" });
    assert.throws(() => parseInterruptionQuestion("   "), { code: "INVALID_QUESTION" });
    assert.throws(() => parseInterruptionQuestion(42), { code: "INVALID_QUESTION" });
  });

  it("rejects a question over the bound", () => {
    assert.throws(() => parseInterruptionQuestion("q".repeat(PODCAST_INTERRUPT_QUESTION_MAX + 1)), {
      code: "INVALID_QUESTION",
    });
  });
});

describe("podcast interruption prompt", () => {
  it("keeps the two personas and the alternation contract in the system prompt", () => {
    const sys = buildPodcastInterruptSystemPrompt();
    assert.match(sys, /Host A/);
    assert.match(sys, /Host B/);
    assert.match(sys, /alternating turns/);
    assert.match(sys, /<source>/);
    assert.match(sys, /"turns"/);
    assert.match(sys, new RegExp(PODCAST_INTERRUPT_TURNS_MIN + " and " + PODCAST_INTERRUPT_TURNS_MAX));
  });

  it("frames the question and source content as separated untrusted input", () => {
    const user = buildPodcastInterruptUserPrompt("<source>ground</source>", "Is the claim true?");
    assert.ok(user.indexOf("Is the claim true?") >= 0);
    assert.ok(user.indexOf("<source>ground</source>") > user.indexOf("Is the claim true?"));
  });

  it("declares a stable version and a bounded temperature", () => {
    assert.equal(PODCAST_INTERRUPT_PROMPT_VERSION, "podcast-interrupt-v1");
    assert.equal(PODCAST_INTERRUPT_TEMPERATURE, 0.5);
  });
});

describe("podcast interruption persistence window", () => {
  it("reads an empty history as an empty list", () => {
    assert.deepEqual(parseStoredInterruptions(null), []);
    assert.deepEqual(parseStoredInterruptions({}), []);
    assert.deepEqual(parseStoredInterruptions({ interruptions: undefined }), []);
  });

  it("round-trips a stored record through the tolerant parser", () => {
    const r = record("55c6424c-a555-4e14-8c82-9c2d2bd8eb0a");
    const parsed = parseStoredInterruptions({ interruptions: [r] });
    assert.deepEqual(parsed, [r]);
  });

  it("skips malformed entries instead of failing the whole history", () => {
    const good = record("55c6424c-a555-4e14-8c82-9c2d2bd8eb0a");
    const parsed = parseStoredInterruptions({
      interruptions: [
        good,
        { id: "not-a-record" },
        null,
        { ...good, audio: { ...good.audio, format: "ogg" } },
      ],
    });
    assert.deepEqual(parsed, [good]);
  });

  it("appends newest-first and silently drops past the history bound", () => {
    const first = record("55c6424c-a555-4e14-8c82-9c2d2bd8eb0a");
    const second = record("65c6424c-a555-4e14-8c82-9c2d2bd8eb0b");
    assert.deepEqual(insertInterruptionRecord([first], second), [second, first].slice(0, PODCAST_INTERRUPTION_HISTORY_MAX));

    const full = Array.from({ length: PODCAST_INTERRUPTION_HISTORY_MAX }, (_, i) =>
      record("55c6424c-a555-4e14-8c82-9c2d2bd8" + String(i).padStart(4, "0")),
    );
    const newest = record("65c6424c-a555-4e14-8c82-9c2d2bd8eb0b");
    const inserted = insertInterruptionRecord(full, newest);
    assert.equal(inserted.length, PODCAST_INTERRUPTION_HISTORY_MAX);
    assert.equal(inserted[0].id, newest.id);
    assert.equal(inserted.some((r) => r.id === full[full.length - 1].id), false);
  });
});