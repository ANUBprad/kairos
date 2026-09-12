import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  SOURCE_TYPE_META,
  SOURCE_TYPE_OPTIONS,
  STATUS_FILTER_OPTIONS,
  PROCESSING_STATUSES,
  filterSources,
  canAddToBulkSelection,
  type SourceRow,
} from "@/lib/source-library";
import { MAX_BULK_OPERATIONS, SOURCE_TYPE_VALUES } from "@/lib/source-contract";

const sample: SourceRow[] = [
  { id: "1", name: "Report.pdf", fileType: "pdf", sourceType: "FILE", sourceUrl: null, status: "READY" },
  { id: "2", name: "Quick Notes", fileType: "txt", sourceType: "TEXT", sourceUrl: null, status: "CHUNKING" },
  { id: "3", name: "Kairos Release Notes", fileType: "txt", sourceType: "URL", sourceUrl: "https://kairos.dev/release", status: "READY" },
  { id: "4", name: "Q&A Demo", fileType: "txt", sourceType: "YOUTUBE", sourceUrl: "https://youtu.be/abc123", status: "ERROR" },
];

describe("Source type metadata", () => {
  it("covers every supported source type", () => {
    assert.deepEqual(Object.keys(SOURCE_TYPE_META), [...SOURCE_TYPE_VALUES]);
  });

  it("labels the four source types per product semantics", () => {
    assert.equal(SOURCE_TYPE_META.FILE.label, "File");
    assert.equal(SOURCE_TYPE_META.TEXT.label, "Text");
    assert.equal(SOURCE_TYPE_META.URL.label, "URL");
    assert.equal(SOURCE_TYPE_META.YOUTUBE.label, "YouTube");
  });
});

describe("Source type filter options", () => {
  it("starts with All sources and lists only the supported types", () => {
    const values = SOURCE_TYPE_OPTIONS.map((o) => o.value);
    assert.deepEqual(values, ["", "FILE", "TEXT", "URL", "YOUTUBE"]);
    assert.equal(SOURCE_TYPE_OPTIONS[0].label, "All sources");
  });
});

describe("Status filter options", () => {
  it("uses stored status values plus the processing grouping", () => {
    const values = STATUS_FILTER_OPTIONS.map((o) => o.value);
    assert.deepEqual(values, ["", "READY", "PROCESSING", "ERROR", "QUEUED"]);
  });

  it("derives the processing set from the stored statuses minus terminal states", () => {
    assert.deepEqual([...PROCESSING_STATUSES].sort(), [
      "CHUNKING",
      "EMBEDDING",
      "EMBEDDING_PENDING",
      "EXTRACTING",
      "QUEUED",
      "STORED",
      "UPLOADING",
    ]);
  });
});

describe("Source list filtering", () => {
  it("returns everything with no filters", () => {
    assert.equal(filterSources(sample, {}).length, 4);
  });

  it("filters by source type", () => {
    const urls = filterSources(sample, { sourceType: "URL" });
    assert.equal(urls.length, 1);
    assert.equal(urls[0].id, "3");
  });

  it("filters by exact stored status", () => {
    const ready = filterSources(sample, { status: "READY" });
    assert.deepEqual(ready.map((s) => s.id), ["1", "3"]);
  });

  it("groups non-terminal stored statuses under the PROCESSING filter", () => {
    const processing = filterSources(sample, { status: "PROCESSING" });
    assert.deepEqual(processing.map((s) => s.id), ["2"]);
  });

  it("returns an empty list when no source matches the filters", () => {
    assert.deepEqual(filterSources(sample, { sourceType: "YOUTUBE", status: "READY" }), []);
  });

  it("searches by name case-insensitively", () => {
    const result = filterSources(sample, { search: "release" });
    assert.deepEqual(result.map((s) => s.id), ["3"]);
  });

  it("searches by source URL", () => {
    const result = filterSources(sample, { search: "youtu.be" });
    assert.deepEqual(result.map((s) => s.id), ["4"]);
  });

  it("combines search with a source type filter", () => {
    const result = filterSources(sample, { search: "notes", sourceType: "TEXT" });
    assert.equal(result.length, 1);
  });
});

describe("Bulk selection bound", () => {
  it("allows selection below the backend maximum", () => {
    assert.equal(canAddToBulkSelection(MAX_BULK_OPERATIONS - 1), true);
  });

  it("refuses selection at the backend maximum", () => {
    assert.equal(canAddToBulkSelection(MAX_BULK_OPERATIONS), false);
  });

  it("matches the backend bulk bound", () => {
    assert.equal(MAX_BULK_OPERATIONS, 50);
  });
});