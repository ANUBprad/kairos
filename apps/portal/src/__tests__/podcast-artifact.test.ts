import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  podcastArtifactSchema,
  podcastArtifactDefinition,
  PODCAST_HOST_PERSONAS,
  PODCAST_SPEAKERS,
  PODCAST_TITLE_MAX,
  PODCAST_SUMMARY_MAX,
  PODCAST_TURN_TEXT_MAX,
  PODCAST_TURNS_MAX,
} from "@/lib/artifacts";

const validPodcast = {
  title: "Qubits and Superposition",
  summary: "A grounded conversation about how qubits encode information.",
  turns: [
    { speaker: "HOST_A", text: "Let's start with what a qubit actually is." },
    { speaker: "HOST_B", text: "And why is that different from a classical bit?" },
    { speaker: "HOST_A", text: "Because a qubit holds a mix of both states until measured." },
    { speaker: "HOST_B", text: "So the sources describe measurement as collapsing that mix." },
  ] as const,
};

describe("podcast output schema", () => {
  it("accepts a valid podcast payload", () => {
    const parsed = podcastArtifactSchema.safeParse(validPodcast);
    assert.equal(parsed.success, true);
  });

  it("requires both speakers to be present", () => {
    const result = podcastArtifactSchema.safeParse({
      ...validPodcast,
      turns: [
        { speaker: "HOST_A", text: "Only one host here." },
        { speaker: "HOST_A", text: "Still only one host." },
      ],
    });
    assert.equal(result.success, false);
  });

  it("rejects podcasts where a speaker repeats itself in consecutive turns", () => {
    const result = podcastArtifactSchema.safeParse({
      ...validPodcast,
      turns: [
        { speaker: "HOST_A", text: "One." },
        { speaker: "HOST_A", text: "Two in a row." },
        { speaker: "HOST_B", text: "Finally me." },
        { speaker: "HOST_A", text: "Back to you." },
      ],
    });
    assert.equal(result.success, false);
  });

  it("rejects an empty turn (empty text or missing field)", () => {
    assert.equal(podcastArtifactSchema.safeParse({
      ...validPodcast,
      turns: [
        { speaker: "HOST_A", text: "One." },
        { speaker: "HOST_B", text: "" },
      ],
    }).success, false);
    assert.equal(podcastArtifactSchema.safeParse({
      ...validPodcast,
      turns: [
        { speaker: "HOST_A", text: "One." },
        { speaker: "HOST_B", text: "Two." },
        {},
      ],
    }).success, false);
  });

  it("rejects an unknown speaker value", () => {
    assert.equal(podcastArtifactSchema.safeParse({
      ...validPodcast,
      turns: [
        ...validPodcast.turns,
        { speaker: "HOST_C" as "HOST_A", text: "Nobody knows me." },
      ],
    }).success, false);
  });

  it("rejects malformed structure (not an object / missing fields)", () => {
    assert.equal(podcastArtifactSchema.safeParse("not json").success, false);
    assert.equal(podcastArtifactSchema.safeParse(null).success, false);
    assert.equal(podcastArtifactSchema.safeParse({}).success, false);
    assert.equal(podcastArtifactSchema.safeParse({ title: "T", summary: "S" }).success, false);
  });

  it("rejects extra keys (strict object)", () => {
    assert.equal(podcastArtifactSchema.safeParse({
      ...validPodcast,
      guests: [],
    }).success, false);
    assert.equal(podcastArtifactSchema.safeParse({
      ...validPodcast,
      turns: [{ ...validPodcast.turns[0], duration: 1 }],
    }).success, false);
  });

  it("enforces the title bound at the boundary", () => {
    const over = { ...validPodcast, title: "x".repeat(PODCAST_TITLE_MAX + 1) };
    assert.equal(podcastArtifactSchema.safeParse(over).success, false);
    const empty = { ...validPodcast, title: "" };
    assert.equal(podcastArtifactSchema.safeParse(empty).success, false);
    assert.equal(
      podcastArtifactSchema.safeParse({ ...validPodcast, title: "x".repeat(PODCAST_TITLE_MAX) }).success,
      true,
    );
  });

  it("enforces the summary bound at the boundary", () => {
    const over = { ...validPodcast, summary: "x".repeat(PODCAST_SUMMARY_MAX + 1) };
    assert.equal(podcastArtifactSchema.safeParse(over).success, false);
    assert.equal(podcastArtifactSchema.safeParse({ ...validPodcast, summary: "" }).success, false);
    assert.equal(
      podcastArtifactSchema.safeParse({
        ...validPodcast,
        summary: "x".repeat(PODCAST_SUMMARY_MAX),
      }).success,
      true,
    );
  });

  it("enforces the turn count bound at the boundary", () => {
    const oneSpeakerTwo = {
      ...validPodcast,
      turns: [
        { speaker: "HOST_A", text: "One." },
        { speaker: "HOST_B", text: "Two." },
      ],
    };
    assert.equal(podcastArtifactSchema.safeParse(oneSpeakerTwo).success, true);

    const twoTurns = (speaker: "HOST_A" | "HOST_B", n: number) => [
      { speaker, text: `turn-${n}` },
    ];
    let turns: { speaker: "HOST_A" | "HOST_B"; text: string }[] = [
      { speaker: "HOST_A", text: "start" },
      { speaker: "HOST_B", text: "reply" },
    ];
    while (turns.length < PODCAST_TURNS_MAX) {
      turns = turns.concat(twoTurns(turns.length % 2 === 0 ? "HOST_A" : "HOST_B", turns.length));
    }
    assert.equal(turns.length, PODCAST_TURNS_MAX);
    assert.equal(podcastArtifactSchema.safeParse({ ...validPodcast, turns }).success, true);

    const afterLast = turns[PODCAST_TURNS_MAX - 1].speaker;
    const overflow = [
      ...turns,
      { speaker: afterLast === "HOST_A" ? "HOST_B" : "HOST_A", text: "too many" },
    ];
    assert.equal(overflow.length, PODCAST_TURNS_MAX + 1);
    assert.equal(podcastArtifactSchema.safeParse({ ...validPodcast, turns: overflow }).success, false);
  });

  it("enforces the per-turn text bound at the boundary", () => {
    const over = {
      ...validPodcast,
      turns: [{ speaker: "HOST_A", text: "x".repeat(PODCAST_TURN_TEXT_MAX + 1) }, { speaker: "HOST_B", text: "ok" }],
    };
    assert.equal(podcastArtifactSchema.safeParse(over).success, false);
    const atBound = {
      ...validPodcast,
      turns: [
        { speaker: "HOST_A", text: "x".repeat(PODCAST_TURN_TEXT_MAX) },
        { speaker: "HOST_B", text: "ok" },
      ],
    };
    assert.equal(podcastArtifactSchema.safeParse(atBound).success, true);
  });
});

describe("podcast artifact definition", () => {
  it("declares the podcast metadata and versioned prompt", () => {
    assert.equal(podcastArtifactDefinition.type, "PODCAST");
    assert.equal(podcastArtifactDefinition.schemaVersion, 1);
    assert.equal(podcastArtifactDefinition.promptVersion, "podcast-v1");
    assert.ok(podcastArtifactDefinition.contextTokenBudget > 0);
    assert.equal(podcastArtifactDefinition.buildSystemPrompt().length > 0, true);
    assert.equal(podcastArtifactDefinition.buildUserPrompt("context").includes("context"), true);
  });

  it("documents both host personas and only the two speakers", () => {
    assert.deepEqual(PODCAST_SPEAKERS, ["HOST_A", "HOST_B"]);
    assert.ok(PODCAST_HOST_PERSONAS.HOST_A.name.length > 0);
    assert.ok(PODCAST_HOST_PERSONAS.HOST_A.description.length > 0);
    assert.ok(PODCAST_HOST_PERSONAS.HOST_B.name.length > 0);
    assert.ok(PODCAST_HOST_PERSONAS.HOST_B.description.length > 0);
  });

  it("keeps grounding rules in the system prompt (no independent research, no invented citations)", () => {
    const prompt = podcastArtifactDefinition.buildSystemPrompt();
    assert.match(prompt, /alternat/);
    assert.match(prompt, /no invented citations/i);
    assert.match(prompt, /Base EVERY statement ONLY on the content/i);
  });
});