import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chunkText, estimateChunkStats, validateChunkingOptions } from "@/lib/chunking";

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

  it("terminates with extreme overlap and natural separators near the window start", () => {
    // A newline two characters into the search window used to rewind `start`
    // below its previous value, producing empty slices forever.
    const text = `ab\n${"word ".repeat(400)}`;
    const chunks = chunkText(text, {
      strategy: "recursive",
      chunkSize: 100,
      overlap: 99,
    });
    assert.ok(chunks.length > 0);
    assert.ok(chunks.length <= text.length);
    assert.ok(chunks.every((chunk) => chunk.content.length > 0));
  });

  it("terminates with a separator at the exact chunk boundary", () => {
    const text = `${"a".repeat(100)}\n${"b".repeat(300)}`;
    const chunks = chunkText(text, {
      strategy: "recursive",
      chunkSize: 100,
      overlap: 99,
    });
    assert.ok(chunks.length > 0);
    assert.ok(chunks.every((chunk) => chunk.content.length > 0));
  });

  it("handles empty, short, and exactly-chunk-sized text", () => {
    for (const text of ["", "short", "x".repeat(100)]) {
      const chunks = chunkText(text, { strategy: "recursive", chunkSize: 100, overlap: 10 });
      assert.ok(Array.isArray(chunks));
      if (text.length > 0) assert.ok(chunks.length >= 1);
    }
  });

  it("rejects unknown strategies before chunking", () => {
    assert.throws(
      () =>
        validateChunkingOptions({
          strategy: "bogus" as never,
          chunkSize: 100,
          overlap: 10,
        }),
      /Unknown chunking strategy/,
    );
  });
});
