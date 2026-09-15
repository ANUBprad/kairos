import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { collectArtifactMediaKeys } from "@/lib/artifacts";

function validInterruption(storageKey: string) {
  return {
    id: randomUUID(),
    question: "What is this about?",
    turns: [
      { speaker: "HOST_A", text: "A first thought." },
      { speaker: "HOST_B", text: "A reply that follows." },
    ],
    createdAt: "2026-01-01T00:00:00Z",
    audio: { provider: "openai", storageProvider: "cloudinary", storageKey, format: "wav", durationSeconds: 2 },
  };
}

describe("artifact media key collection", () => {
  it("returns the episode storage key alone when there are no interruptions", () => {
    assert.deepEqual(
      collectArtifactMediaKeys({
        audio: { storageProvider: "cloudinary", storageKey: "ep.mp3", format: "mp3" },
      }),
      ["ep.mp3"],
    );
  });

  it("returns interruption audio keys even when the episode audio block is absent (legacy)", () => {
    assert.deepEqual(
      collectArtifactMediaKeys({
        interruptions: [validInterruption("i.wav")],
      }),
      ["i.wav"],
    );
  });

  it("skips malformed interruption records instead of failing", () => {
    assert.deepEqual(
      collectArtifactMediaKeys({
        interruptions: ["junk", { id: "not-a-uuid", audio: { storageKey: "x" } }],
      }),
      [],
    );
  });

  it("never returns storage providers, only keys", () => {
    const result = collectArtifactMediaKeys({
      audio: { storageProvider: "cloudinary", storageKey: "ep.mp3", format: "mp3" },
    });
    assert.deepEqual(result, ["ep.mp3"]);
    assert.doesNotMatch(result.join(), /cloudinary/);
  });
});

describe("artifact lifecycle wiring", () => {
  const actionsSource = readFileSync(
    new URL("../lib/actions/artifacts.ts", import.meta.url),
    "utf8",
  );
  const engineSource = readFileSync(
    new URL("../lib/artifacts/engine.ts", import.meta.url),
    "utf8",
  );
  const persistenceSource = readFileSync(
    new URL("../lib/artifacts/persistence.ts", import.meta.url),
    "utf8",
  );

  it("regeneration accepts only the kb + id — the source scope is read from the stored row", () => {
    assert.match(
      engineSource,
      /regenerateLearningArtifactForUser\([\s\S]*knowledgeBaseId[\s\S]*artifactId/,
    );
    assert.match(engineSource, /getLearningArtifactInKb\(artifactId, knowledgeBaseId\)/);
    assert.match(
      engineSource,
      /generateLearningArtifactForUser\(\{[\s\S]*sourceIds: original\.sourceIds/,
    );
    // the caller must not be able to smuggle a source scope in
    assert.doesNotMatch(actionsSource, /regenerateLearningArtifactForWorkspace[\s\S]{0,200}sourceIds/);
  });

  it("regeneration guards mid-generation artifacts before delegating", () => {
    assert.match(engineSource, /ARTIFACT_IN_PROGRESS/);
    assert.match(engineSource, /original\.status === "PENDING" \|\| original\.status === "PROCESSING"/);
  });

  it("regeneration records lineage as parentArtifactId in the artifact's own metadata", () => {
    assert.match(engineSource, /parentArtifactId: original\.id/);
    assert.match(engineSource, /parentArtifactId: request\.parentArtifactId/);
    // lineage rides the existing metadata JSON, never a new persisted column
    assert.doesNotMatch(persistenceSource, /parentArtifactId/) ;
  });

  it("deletion is KB-scoped through a guarded deleteMany", () => {
    assert.match(
      persistenceSource,
      /deleteLearningArtifact\(\s*knowledgeBaseId:\s*string,\s*artifactId:\s*string/,
    );
    assert.match(persistenceSource, /deleteMany\(\s*\{\s*where: \{\s*id: artifactId,\s*knowledgeBaseId\s*\}/);
  });

  it("deletion cleans media by exact captured keys, after the DB row is gone", () => {
    assert.match(actionsSource, /collectArtifactMediaKeys\(deleted\.metadata\)/);
    assert.match(actionsSource, /deleteLearningArtifact\(knowledgeBaseId, artifactId\)/);
    assert.match(actionsSource, /await storage\.delete\(key\)/);
    // media references travel only toward the storage provider, never into logs
    assert.doesNotMatch(actionsSource, /logError\([^)]*storageKey/);
    assert.doesNotMatch(actionsSource, /logError\([^)]*key/);
  });
});