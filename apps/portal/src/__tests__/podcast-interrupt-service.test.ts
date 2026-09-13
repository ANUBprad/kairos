import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { toLearningArtifactData, type LearningArtifactRow } from "@/lib/artifacts";

describe("podcast interruption service wiring", () => {
  const serviceSource = readFileSync(
    new URL("../lib/artifacts/interrupt-service.ts", import.meta.url),
    "utf8",
  );
  const actionSource = readFileSync(
    new URL("../lib/actions/podcast-interrupt.ts", import.meta.url),
    "utf8",
  );
  const persistenceSource = readFileSync(
    new URL("../lib/artifacts/persistence.ts", import.meta.url),
    "utf8",
  );
  const viewSource = readFileSync(
    new URL("../lib/artifacts/interrupt-view.ts", import.meta.url),
    "utf8",
  );
  const dtoSource = readFileSync(new URL("../lib/artifacts/dto.ts", import.meta.url), "utf8");
  const rateLimitSource = readFileSync(new URL("../lib/rate-limit.ts", import.meta.url), "utf8");

  it("generates through the provider, retrieval-context, and TTS abstractions, never raw SDKs", () => {
    assert.match(serviceSource, /getAIProvider/);
    assert.match(serviceSource, /generateChat/);
    assert.match(serviceSource, /loadArtifactSourceChunks/);
    assert.match(serviceSource, /buildBoundedContext/);
    assert.match(serviceSource, /generatePodcastAudio/);
    assert.doesNotMatch(serviceSource, /from ["']openai["']|from ["']@google\/generativelanguage["']/);
    assert.doesNotMatch(serviceSource, /new OpenAI\(|new GoogleGenerativeAI\(/);
  });

  it("grounds only on the podcast's persisted source snapshot, never client input", () => {
    assert.match(serviceSource, /getLearningArtifactInKb/);
    assert.match(serviceSource, /artifact\.sourceIds/);
    assert.doesNotMatch(serviceSource, /request\.sourceIds/);
    assert.match(serviceSource, /buildPodcastInterruptUserPrompt/);
  });

  it("authorizes through the session and membership check, never a second mechanism", () => {
    assert.match(serviceSource, /requireSession/);
    assert.match(serviceSource, /canAccessKnowledgeBase/);
    assert.match(serviceSource, /artifact\.type !== "PODCAST"/);
    assert.match(serviceSource, /PODCAST_NOT_COMPLETED/);
  });

  it("stores interruption media through the authenticated storage provider", () => {
    assert.match(serviceSource, /accessMode: "authenticated"/);
    assert.match(serviceSource, /artifacts\/podcast-\$\{artifact\.id\}\/interruptions\/\$\{interruptionId\}/);
  });

  it("fails atomically before persisting anything when the schema rejects output", () => {
    assert.match(serviceSource, /ARTIFACT_SCHEMA_ERROR/);
    assert.match(serviceSource, /appendPodcastInterruption/);
  });

  it("traces through the existing observability infrastructure with interruption metadata", () => {
    assert.match(serviceSource, /artifact\.podcast\.interrupt/);
    assert.match(serviceSource, /createTrace/);
    assert.match(serviceSource, /finishTrace/);
    assert.match(serviceSource, /addSpan/);
    assert.match(serviceSource, /interruptionId/);
    assert.match(serviceSource, /questionLength: question\.length/);
    assert.match(serviceSource, /ttsProvider: ttsProvider\.type/);
  });

  it("cleans up uploaded audio best-effort when a later stage fails", () => {
    assert.match(serviceSource, /artifact\.interrupt\.cleanup/);
    assert.match(serviceSource, /getStorageProvider\(\)\.delete\(uploadedStorageKey\)/);
  });

  it("is a server action that pins the rate-limited interruption flow", () => {
    assert.match(actionSource, /^"use server";/m);
    assert.match(actionSource, /podcast-interrupt:\$\{session\.user\.id\}/);
    assert.match(actionSource, /generatePodcastInterruption/);
    assert.match(actionSource, /toWorkspaceInterruptionView/);
    assert.doesNotMatch(actionSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(actionSource, /getAIProvider|generateChat|getTTSProvider/);
  });

  it("persists interruptions through the bounded metadata window", () => {
    assert.match(persistenceSource, /appendPodcastInterruption/);
    assert.match(persistenceSource, /insertInterruptionRecord/);
    assert.match(persistenceSource, /parseStoredInterruptions/);
  });

  it("projects interruption views without any storage references and sanitizes the DTO", () => {
    assert.match(viewSource, /toWorkspaceInterruptionView/);
    assert.doesNotMatch(viewSource, /storageKey|storageProvider/);
    assert.match(dtoSource, /interruptions/);
    assert.match(dtoSource, /delete safeRecAudio\.storageKey/);
  });

  it("adds a dedicated interruption rate-limit bucket", () => {
    assert.match(rateLimitSource, /podcastInterrupt: \{ windowMs: 60 \* 1000, maxRequests: 5 \}/);
  });
});

describe("podcast interruption workspace projection", () => {
  const baseRow: LearningArtifactRow = {
    id: "clx-a",
    type: "PODCAST",
    status: "COMPLETED",
    name: null,
    schemaVersion: 1,
    sourceIds: [],
    content: null,
    metadata: {
      promptVersion: "podcast-v1",
      audio: {
        provider: "local",
        storageProvider: "cloudinary",
        storageKey: "artifacts/podcast-clx-a",
        format: "wav",
        durationSeconds: 100,
      },
      interruptions: [
        {
          id: "55c6424c-a555-4e14-8c82-9c2d2bd8eb0a",
          question: "Is the claim supported?",
          turns: [
            { speaker: "HOST_A", text: "Yes." },
            { speaker: "HOST_B", text: "And the source says so." },
          ],
          createdAt: "2026-01-02T03:04:05.000Z",
          audio: {
            provider: "local",
            storageProvider: "cloudinary",
            storageKey: "artifacts/podcast-clx-a/interruptions/55c6424c-a555-4e14-8c82-9c2d2bd8eb0a",
            format: "wav",
            durationSeconds: 4.2,
          },
        },
      ],
    },
    knowledgeBaseId: "clx-kb",
    createdById: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it("preserves the interruption history but strips every media storage reference", async () => {
    const { toWorkspaceArtifactData } = await import("@/lib/artifacts/dto");
    const projected = toWorkspaceArtifactData(toLearningArtifactData(baseRow));
    const metadata = projected.metadata as Record<string, unknown>;
    const interruptions = metadata.interruptions as Record<string, unknown>[];
    assert.equal(interruptions.length, 1);
    const audio = interruptions[0].audio as Record<string, unknown>;
    assert.equal(audio.storageKey, undefined);
    assert.equal(audio.storageProvider, undefined);
    assert.equal(audio.format, "wav");
    assert.equal(audio.durationSeconds, 4.2);
    assert.equal(JSON.stringify(projected).match(/storageKey|storageProvider/i), null);
  });

  it("keeps interruption history when only the top-level audio needs stripping", async () => {
    const { toWorkspaceArtifactData } = await import("@/lib/artifacts/dto");
    const withoutInterruptions = {
      ...baseRow,
      metadata: {
        promptVersion: "podcast-v1",
        audio: (baseRow.metadata as Record<string, unknown>).audio,
      } as unknown as NonNullable<LearningArtifactRow["metadata"]>,
    };
    const projected = toWorkspaceArtifactData(toLearningArtifactData(withoutInterruptions));
    const metadata = projected.metadata as Record<string, unknown>;
    assert.equal(metadata.interruptions, undefined);
    assert.equal((metadata.audio as Record<string, unknown>).storageKey, undefined);
    assert.equal(metadata.promptVersion, "podcast-v1");
  });
});