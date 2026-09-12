import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ARTIFACT_TYPE_VALUES,
  ARTIFACT_STATUS_VALUES,
  parseArtifactType,
  parseArtifactStatus,
  canTransitionArtifactStatus,
  normalizeArtifactSourceIds,
  toLearningArtifactData,
  artifactBelongsToKb,
  type LearningArtifactRow,
} from "@/lib/artifacts";

describe("artifact type contract", () => {
  it("declares exactly the seven supported artifact types", () => {
    assert.deepEqual(ARTIFACT_TYPE_VALUES, [
      "SUMMARY",
      "REPORT",
      "QUIZ",
      "FLASHCARDS",
      "MINDMAP",
      "TAKEAWAYS",
      "PODCAST",
    ]);
  });

  it("parses a valid type", () => {
    assert.equal(parseArtifactType("QUIZ"), "QUIZ");
  });

  it("rejects an unknown type", () => {
    assert.throws(() => parseArtifactType("VIDEO"), /Invalid artifact type/);
  });

  it("rejects null/undefined/empty type", () => {
    assert.throws(() => parseArtifactType(undefined), /Invalid artifact type/);
    assert.throws(() => parseArtifactType(null), /Invalid artifact type/);
    assert.throws(() => parseArtifactType(""), /Invalid artifact type/);
  });
});

describe("artifact status contract", () => {
  it("declares the minimal four-state lifecycle", () => {
    assert.deepEqual(ARTIFACT_STATUS_VALUES, ["PENDING", "PROCESSING", "COMPLETED", "FAILED"]);
  });

  it("parses a valid status", () => {
    assert.equal(parseArtifactStatus("PROCESSING"), "PROCESSING");
  });

  it("rejects statuses outside the contract (no QUEUED/CANCELLED/STREAMING)", () => {
    assert.throws(() => parseArtifactStatus("QUEUED"), /Invalid artifact status/);
    assert.throws(() => parseArtifactStatus("CANCELLED"), /Invalid artifact status/);
  });
});

describe("artifact status lifecycle", () => {
  it("moves PENDING -> PROCESSING -> COMPLETED", () => {
    assert.equal(canTransitionArtifactStatus("PENDING", "PROCESSING"), true);
    assert.equal(canTransitionArtifactStatus("PROCESSING", "COMPLETED"), true);
    assert.equal(canTransitionArtifactStatus("PROCESSING", "FAILED"), true);
  });

  it("rejects illegal jumps (PENDING -> COMPLETED, COMPLETED -> any)", () => {
    assert.equal(canTransitionArtifactStatus("PENDING", "COMPLETED"), false);
    assert.equal(canTransitionArtifactStatus("COMPLETED", "FAILED"), false);
    assert.equal(canTransitionArtifactStatus("FAILED", "PROCESSING"), false);
  });
});

describe("source id snapshot", () => {
  it("snapshots the exact source scope, preserving order and dropping invalids", () => {
    const snapshot = normalizeArtifactSourceIds(["doc_a", "not-an-id!", 42, "doc_b"]);
    assert.deepEqual(snapshot, ["doc_a", "doc_b"]);
  });

  it("dedupes repeated ids so the snapshot is canonical", () => {
    assert.deepEqual(normalizeArtifactSourceIds(["doc_a", "doc_a", "doc_b"]), ["doc_a", "doc_b"]);
  });

  it("returns a fresh array, not a reference to caller input", () => {
    const input = ["doc_a"];
    const snapshot = normalizeArtifactSourceIds(input);
    input.push("doc_b");
    assert.deepEqual(snapshot, ["doc_a"]);
  });

  it("allows an empty snapshot (artifact with no sources is representable)", () => {
    assert.deepEqual(normalizeArtifactSourceIds([]), []);
  });
});

describe("persistence DTO mapping", () => {
  const row: LearningArtifactRow = {
    id: "art_1",
    type: "REPORT",
    status: "COMPLETED",
    name: "Research Report",
    schemaVersion: 1,
    sourceIds: ["doc_a"],
    content: { title: "Report" },
    metadata: { model: "gpt-4o", provider: "openai" },
    knowledgeBaseId: "kb_1",
    createdById: "user_1",
    createdAt: new Date("2026-09-12T10:00:00Z"),
    updatedAt: new Date("2026-09-12T11:00:00Z"),
  };

  it("maps the full persisted row to the DTO shape", () => {
    assert.deepEqual(toLearningArtifactData(row), {
      id: "art_1",
      knowledgeBaseId: "kb_1",
      type: "REPORT",
      status: "COMPLETED",
      name: "Research Report",
      sourceIds: ["doc_a"],
      schemaVersion: 1,
      content: { title: "Report" },
      metadata: { model: "gpt-4o", provider: "openai" },
      createdById: "user_1",
      createdAt: new Date("2026-09-12T10:00:00Z"),
      updatedAt: new Date("2026-09-12T11:00:00Z"),
    });
  });

  it("keeps the sourceIds snapshot independent from any row mutation", () => {
    const dto = toLearningArtifactData(row);
    const sources = dto.sourceIds;
    row.sourceIds.push("doc_b");
    assert.deepEqual(sources, ["doc_a"]);
  });

  it("defaults versioning to the schema level (single schemaVersion field)", () => {
    assert.equal(row.schemaVersion, 1);
    assert.ok(!("generationVersion" in row));
  });
});

describe("artifact tenancy", () => {
  it("only authorizes artifacts whose KB matches the requested KB", () => {
    assert.equal(artifactBelongsToKb({ knowledgeBaseId: "kb_a" }, "kb_a"), true);
    assert.equal(artifactBelongsToKb({ knowledgeBaseId: "kb_a" }, "kb_b"), false);
  });
});