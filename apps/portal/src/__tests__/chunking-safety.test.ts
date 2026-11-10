import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkText, estimateChunkStats } from "@/lib/chunking";

describe("chunking configuration safety", () => {
  it("rejects overlap equal to chunk size instead of entering a non-progressing loop", () => {
    assert.throws(
      () => chunkText("A".repeat(200), { strategy: "recursive", chunkSize: 100, overlap: 100 }),
      /overlap must be a non-negative integer smaller than chunkSize/,
    );
  });

  it("rejects overlap larger than chunk size", () => {
    assert.throws(
      () => chunkText("Some content", { chunkSize: 100, overlap: 101 }),
      /overlap must be a non-negative integer smaller than chunkSize/,
    );
  });

  it("rejects zero, negative, and fractional chunk sizes", () => {
    for (const chunkSize of [0, -1, 1.5]) {
      assert.throws(
        () => chunkText("Some content", { chunkSize }),
        /chunkSize must be a positive integer/,
      );
    }
  });

  it("rejects invalid overlap in chunk statistics too", () => {
    assert.throws(
      () => estimateChunkStats("Some content", { chunkSize: 100, overlap: 100 }),
      /overlap must be a non-negative integer smaller than chunkSize/,
    );
  });

  it("still chunks with valid boundary settings", () => {
    const chunks = chunkText("A".repeat(250), {
      strategy: "recursive",
      chunkSize: 100,
      overlap: 99,
    });
    assert.ok(chunks.length > 1);
    assert.ok(chunks.every((chunk) => chunk.content.length > 0));
  });
});
