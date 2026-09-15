import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { filterCitationsToContent } from "@/lib/ai/citations";
import { createAbortError } from "@/lib/ai/abort";
import {
  GENERATION_FAILED_TEXT,
  GENERATION_STOPPED_TEXT,
} from "@/lib/ai/chat/stream-markers";
import type { CitationSource } from "@/lib/ai/types";

function makeCitation(index: number, docId = "doc-1", docName = "test.pdf"): CitationSource {
  return {
    chunkId: `chunk-${index}`,
    documentId: docId,
    documentName: docName,
    chunkIndex: index,
    pageNumber: null,
    excerpt: `content ${index}`,
    similarity: 0.8,
  };
}

describe("createAbortError", () => {
  it("creates an error with name AbortError", () => {
    const err = createAbortError("test");
    assert.equal(err.name, "AbortError");
    assert.equal(err.message, "test");
  });

  it("defaults message to Request aborted", () => {
    const err = createAbortError();
    assert.equal(err.message, "Request aborted");
  });
});

describe("stream-markers constants", () => {
  it("are prefixed with ** for markdown emphasis", () => {
    assert.ok(GENERATION_FAILED_TEXT.startsWith("**Generation failed.**"));
    assert.ok(GENERATION_STOPPED_TEXT.startsWith("**Generation stopped.**"));
  });
});

describe("filterCitationsToContent", () => {
  it("returns all citations when no [Source N] markers are present", () => {
    const all = [makeCitation(0), makeCitation(1), makeCitation(2)];
    const result = filterCitationsToContent(all, "Here is the answer without sources.");
    assert.deepEqual(result, all);
  });

  it("keeps only cited citations in ascending source order", () => {
    const all = [makeCitation(0), makeCitation(1), makeCitation(2)];
    const result = filterCitationsToContent(all, "As noted [Source 3], [Source 1] is relevant.");
    assert.equal(result.length, 2);
    assert.equal(result[0].chunkIndex, 0); // Source 1 → index 0
    assert.equal(result[1].chunkIndex, 2); // Source 3 → index 2
  });

  it("expands ranges like [Source 1-3]", () => {
    const all = [makeCitation(0), makeCitation(1), makeCitation(2)];
    const result = filterCitationsToContent(all, "See [Source 1-3].");
    assert.equal(result.length, 3);
  });

  it("handles en-dash ranges like [Source 1\u20133]", () => {
    const all = [makeCitation(0), makeCitation(1), makeCitation(2)];
    const result = filterCitationsToContent(all, "Refer to [Source 1\u20133].");
    assert.equal(result.length, 3);
  });

  it("handles comma-separated sources [Source 1, 2, 3]", () => {
    const all = [makeCitation(0), makeCitation(1), makeCitation(2)];
    const result = filterCitationsToContent(all, "See [Source 1, 2, 3].");
    assert.equal(result.length, 3);
  });

  it("deduplicates repeated source numbers", () => {
    const all = [makeCitation(0), makeCitation(1)];
    const result = filterCitationsToContent(all, "[Source 1] and [Source 1] again.");
    assert.equal(result.length, 1);
  });

  it("ignores out-of-range source numbers and keeps all when none are in range", () => {
    const all = [makeCitation(0), makeCitation(1)];
    const result = filterCitationsToContent(all, "Referenced [Source 5].");
    assert.deepEqual(result, all);
  });

  it("filters valid and keeps only valid when mix of valid and out-of-range", () => {
    const all = [makeCitation(0), makeCitation(1), makeCitation(2)];
    const result = filterCitationsToContent(all, "Referenced [Source 1] and [Source 5].");
    assert.equal(result.length, 1);
    assert.equal(result[0].chunkIndex, 0);
  });

  it("returns all when content is empty string", () => {
    const all = [makeCitation(0)];
    const result = filterCitationsToContent(all, "");
    assert.deepEqual(result, all);
  });

  it("returns all when citations array is empty", () => {
    const result = filterCitationsToContent([], "Answer [Source 1].");
    assert.deepEqual(result, []);
  });
});
