import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ARTIFACT_STATUS_META,
  parseSummaryContent,
  resolveSourceProvenance,
} from "@/lib/artifacts/summary-view";

describe("summary content view", () => {
  it("parses a valid stored SUMMARY payload", () => {
    const content = {
      title: "Quantum Computing",
      overview: "A survey of qubits.",
      keyPoints: ["Qubits", "Entanglement"],
    };
    assert.deepEqual(parseSummaryContent(content), {
      title: "Quantum Computing",
      overview: "A survey of qubits.",
      keyPoints: ["Qubits", "Entanglement"],
    });
  });

  it("returns null for malformed content (missing keys)", () => {
    assert.equal(parseSummaryContent({ title: "Only a title" }), null);
  });

  it("returns null for empty key points and empty overview", () => {
    assert.equal(parseSummaryContent({ title: "T", overview: "", keyPoints: ["a"] }), null);
    assert.equal(parseSummaryContent({ title: "T", overview: "o", keyPoints: [] }), null);
  });

  it("returns null for unknown stored shapes and strict-invalid extra keys", () => {
    assert.equal(parseSummaryContent(null), null);
    assert.equal(parseSummaryContent("not json"), null);
    assert.equal(
      parseSummaryContent({ title: "T", overview: "o", keyPoints: ["a"], internal: "x" }),
      null,
    );
  });
});

describe("source provenance", () => {
  const sources = [
    { id: "doc_a", name: "paper.pdf" },
    { id: "doc_b", name: null },
  ];

  it("resolves persisted source ids to names, preserving order", () => {
    assert.deepEqual(resolveSourceProvenance(["doc_a", "doc_b"], sources), [
      { id: "doc_a", name: "paper.pdf" },
      { id: "doc_b", name: "doc_b" },
    ]);
  });

  it("falls back to the id for sources without a known name (no invented metadata)", () => {
    assert.deepEqual(resolveSourceProvenance(["doc_a", "unknown_doc"], sources), [
      { id: "doc_a", name: "paper.pdf" },
      { id: "unknown_doc", name: "unknown_doc" },
    ]);
  });
});

describe("artifact status meta", () => {
  it("describes exactly the four supported statuses", () => {
    assert.deepEqual(Object.keys(ARTIFACT_STATUS_META).sort(), [
      "COMPLETED",
      "FAILED",
      "PENDING",
      "PROCESSING",
    ]);
  });

  it("exposes safe display labels and render kinds", () => {
    assert.equal(ARTIFACT_STATUS_META.PENDING.label, "Pending");
    assert.equal(ARTIFACT_STATUS_META.PENDING.kind, "pending");
    assert.equal(ARTIFACT_STATUS_META.PROCESSING.kind, "processing");
    assert.equal(ARTIFACT_STATUS_META.COMPLETED.label, "Completed");
    assert.equal(ARTIFACT_STATUS_META.COMPLETED.kind, "completed");
    assert.equal(ARTIFACT_STATUS_META.FAILED.label, "Failed");
    assert.equal(ARTIFACT_STATUS_META.FAILED.kind, "failed");
  });
});

describe("studio wiring", () => {
  const studioSource = readFileSync(
    new URL("../components/app/studio/summary-studio.tsx", import.meta.url),
    "utf8",
  );
  const pageSource = readFileSync(
    new URL("../app/app/knowledge-bases/[kbId]/studio/page.tsx", import.meta.url),
    "utf8",
  );

  it("generates through the O4-T3 application action, never the engine or database directly", () => {
    assert.match(studioSource, /generateSummaryArtifact/);
    assert.doesNotMatch(studioSource, /generateLearningArtifact|getAIProvider|generateChat/);
    assert.doesNotMatch(studioSource, /from ["']@\/lib\/prisma["']/);
    assert.doesNotMatch(studioSource, /from ["']openai["']/);
  });

  it("reuses the source library contract from the existing server action", () => {
    assert.match(pageSource, /listDocuments/);
    assert.match(studioSource, /SourceListItem/);
  });

  it("renders only through the Studio panel and guards against missing knowledge bases", () => {
    assert.match(pageSource, /SummaryStudio/);
    assert.match(pageSource, /redirect\("\/app"\)/);
  });
});