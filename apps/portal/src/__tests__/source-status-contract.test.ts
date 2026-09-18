import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// User-facing source status contract: the UI must expose exactly the states
// the current processing pipeline emits, keep legacy stored values renderable
// without crashing, and never invent a state the DB cannot hold.

import {
  SOURCE_STATUS_VALUES,
  parseStatusFilter,
  resolveSourceWhere,
} from "@/lib/source-contract";
import {
  STATUS_FILTER_OPTIONS,
  PROCESSING_STATUSES,
  filterSources,
  type SourceRow,
} from "@/lib/source-library";
import {
  POLL_INTERVAL_MS,
  TERMINAL_TRACKING_STATUSES,
  processingPresentation,
} from "@/lib/upload-progress";

const badgeSource = readFileSync(new URL("../components/app/processing-badge.tsx", import.meta.url), "utf8");

// Emitted by the pipeline (verified against document actions, ingestion, and
// the embedding service): QUEUED -> STORED -> EXTRACTING -> CHUNKING ->
// EMBEDDING_PENDING -> EMBEDDING -> INDEXED, failure ERROR. READY and
// UPLOADING are enum members the application never writes.
const ACTIVE_STATUSES = [
  "QUEUED",
  "STORED",
  "EXTRACTING",
  "CHUNKING",
  "EMBEDDING_PENDING",
  "EMBEDDING",
  "INDEXED",
  "ERROR",
] as const;

const LEGACY_STATUSES = ["READY", "UPLOADING"] as const;

// 1. Every active pipeline state has a badge config and an honest label.
test("every active pipeline state has a badge and a label", () => {
  for (const status of ACTIVE_STATUSES) {
    assert.ok(
      new RegExp(`^  ${status}: \\{`, "m").test(badgeSource),
      `ProcessingBadge has no config for active state ${status}`,
    );
    const presentation = processingPresentation(status);
    assert.ok(presentation.label.length > 0, `no label for active state ${status}`);
  }
});

// 2. The active filter menu offers only states the current pipeline emits.
test("active filter menu only contains current pipeline states", () => {
  const menuValues = STATUS_FILTER_OPTIONS.map((o) => o.value).filter(
    (v) => v !== "" && v !== "PROCESSING",
  );
  for (const value of menuValues) {
    assert.ok(
      (ACTIVE_STATUSES as readonly string[]).includes(value),
      `filter menu advertises a state the pipeline cannot produce: ${value}`,
    );
  }
  const indexed = STATUS_FILTER_OPTIONS.find((o) => o.value === "INDEXED");
  assert.equal(indexed?.label, "Indexed", "INDEXED must be the visible success terminal");
});

// 3. READY and UPLOADING are legacy: never normal selectable statuses.
test("READY and UPLOADING are not selectable current statuses", () => {
  const menuValues = STATUS_FILTER_OPTIONS.map((o) => o.value);
  for (const legacy of LEGACY_STATUSES) {
    assert.ok(!menuValues.includes(legacy), `${legacy} must not be a filter option`);
  }
});

// 4. Historical READY/UPLOADING rows stay readable and queryable.
test("historical legacy statuses never crash rendering or filtering", () => {
  for (const legacy of LEGACY_STATUSES) {
    assert.equal(parseStatusFilter(legacy), legacy, `${legacy} must still parse as a stored status`);
    assert.deepEqual(resolveSourceWhere("kb-1", { status: legacy }), {
      knowledgeBaseId: "kb-1",
      status: legacy,
    });
    assert.ok(
      new RegExp(`^  ${legacy}: \\{`, "m").test(badgeSource),
      `ProcessingBadge must keep a legacy rendering for ${legacy}`,
    );
  }
  const rows: SourceRow[] = [
    { id: "1", name: "legacy.pdf", fileType: "pdf", sourceType: "FILE", sourceUrl: null, status: "READY" },
    { id: "2", name: "stuck.txt", fileType: "txt", sourceType: "TEXT", sourceUrl: null, status: "UPLOADING" },
  ];
  assert.deepEqual(filterSources(rows, { status: "READY" }).map((s) => s.id), ["1"]);
  assert.deepEqual(filterSources(rows, { status: "UPLOADING" }).map((s) => s.id), ["2"]);
});

// 5. ERROR is a distinct terminal failure state.
test("ERROR is a distinct terminal failure", () => {
  const presentation = processingPresentation("ERROR");
  assert.equal(presentation.tone, "error");
  assert.equal(presentation.label, "Processing failed");
  assert.ok(!PROCESSING_STATUSES.includes("ERROR"), "ERROR must never read as in-flight");
  assert.ok(new RegExp(`^  ERROR: \\{`, "m").test(badgeSource));
});

// 6. INDEXED is the successful terminal state.
test("INDEXED is the successful terminal state", () => {
  assert.equal(processingPresentation("INDEXED").tone, "success");
  assert.ok(TERMINAL_TRACKING_STATUSES.has("INDEXED"));
  assert.ok(!PROCESSING_STATUSES.includes("INDEXED"), "INDEXED must never read as in-flight");
  assert.ok(new RegExp(`^  INDEXED: \\{`, "m").test(badgeSource));
});

// 7. No invented states in the menu or the processing grouping.
test("no fake state enters the contract", () => {
  for (const option of STATUS_FILTER_OPTIONS) {
    if (option.value === "" || option.value === "PROCESSING") continue;
    assert.ok(
      SOURCE_STATUS_VALUES.includes(option.value as never),
      `filter chip must map to a real stored status: ${option.value}`,
    );
  }
  for (const status of PROCESSING_STATUSES) {
    assert.ok(SOURCE_STATUS_VALUES.includes(status as never), `grouping references an unknown state: ${status}`);
  }
});

// 8. The F7 upload-progress mapping stays correct.
test("F7 upload-progress mapping is unchanged", () => {
  assert.equal(POLL_INTERVAL_MS, 3_000, "F7 polling interval must not change");
  assert.deepEqual([...TERMINAL_TRACKING_STATUSES].sort(), ["ERROR", "INDEXED", "READY"]);
  const pipeline = ["STORED", "EXTRACTING", "CHUNKING", "EMBEDDING_PENDING", "EMBEDDING"];
  for (const status of pipeline) {
    assert.equal(processingPresentation(status).tone, "active", `${status} must read as active`);
  }
  assert.equal(processingPresentation("INDEXED").label, "Ready");
});