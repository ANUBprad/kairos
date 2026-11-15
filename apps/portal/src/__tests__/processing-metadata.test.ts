import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeFailureMetadata } from "@/lib/ingestion/processing-metadata";

describe("failure metadata merge", () => {
  it("preserves existing source facts while recording the failure", () => {
    const merged = mergeFailureMetadata(
      { mimeType: "application/pdf", extension: "pdf", pages: 4 },
      { stage: "chunk", error: "boom", durationMs: 12 },
      "boom",
      new Date("2026-01-02T03:04:05.000Z"),
    );

    assert.equal(merged.mimeType, "application/pdf");
    assert.equal(merged.extension, "pdf");
    assert.equal(merged.pages, 4);
    assert.equal(merged.stage, "chunk");
    assert.equal(merged.error, "boom");
    assert.equal(merged.lastProcessError, "boom");
    assert.equal(merged.lastProcessFailedAt, "2026-01-02T03:04:05.000Z");
  });

  it("works when a document has no previous metadata", () => {
    const merged = mergeFailureMetadata(null, { stage: "extract" }, "no text");
    assert.equal(merged.stage, "extract");
    assert.equal(merged.lastProcessError, "no text");
    assert.equal(typeof merged.lastProcessFailedAt, "string");
  });

  it("does not let stale pipeline keys win over the current failure", () => {
    const merged = mergeFailureMetadata(
      { lastProcessError: "old", lastProcessFailedAt: "2020-01-01T00:00:00.000Z" },
      { stage: "embed" },
      "new",
      new Date("2026-05-06T07:08:09.000Z"),
    );
    assert.equal(merged.lastProcessError, "new");
    assert.equal(merged.lastProcessFailedAt, "2026-05-06T07:08:09.000Z");
  });
});
