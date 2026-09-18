import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Preview state interpretation: INDEXED means processing finished. Zero
// chunks means there is no previewable text — not that processing is still
// running. READY remains the legacy success alias.

const dialogSource = readFileSync(new URL("../components/app/document-preview-dialog.tsx", import.meta.url), "utf8");

const NO_CONTENT_MSG = "No text content available for preview";
const PROCESSING_MSG = "Document is still processing";
const ACTIVE_STATUSES = [
  "QUEUED",
  "STORED",
  "EXTRACTING",
  "CHUNKING",
  "EMBEDDING_PENDING",
  "EMBEDDING",
];

// 1. INDEXED + chunks > 0 -> previewable content (content branch first).
test("INDEXED with chunks reaches the content preview branch", () => {
  const contentBranch = dialogSource.indexOf("preview?.content ?");
  const noContentBranch = dialogSource.indexOf(NO_CONTENT_MSG);
  const noContentCondition = dialogSource.match(/chunkCount === 0[^?]*\?/);
  assert.ok(contentBranch >= 0, "content branch must exist");
  assert.ok(noContentBranch > contentBranch, "content must be tried before the no-content branch");
  assert.ok(noContentCondition, "the no-content branch must require chunkCount === 0");
});

// 2. INDEXED + 0 chunks -> no text content (terminal success, not processing).
test("INDEXED with zero chunks shows no-text-content, not processing", () => {
  const noContentCondition = dialogSource.slice(0, dialogSource.indexOf(NO_CONTENT_MSG));
  assert.ok(
    /preview\?\.status === "INDEXED"/.test(noContentCondition),
    "INDEXED must be a recognized terminal-success no-content case",
  );
  assert.ok(
    /preview\?\.chunkCount === 0/.test(noContentCondition),
    "no-content must require zero chunks",
  );
});

// 3. ACTIVE + 0 chunks -> still processing behavior.
test("active statuses with zero chunks keep the processing fallback", () => {
  const noContentCondition = dialogSource.slice(0, dialogSource.indexOf(NO_CONTENT_MSG));
  for (const status of ACTIVE_STATUSES) {
    assert.ok(
      !noContentCondition.includes(`preview?.status === "${status}"`),
      `${status} must not be a no-content terminal case`,
    );
  }
  assert.ok(dialogSource.includes(PROCESSING_MSG), "processing fallback must remain");
});

// 4. ERROR -> existing error behavior (not converted to no-content).
test("ERROR never reads as no-content", () => {
  const noContentCondition = dialogSource.slice(0, dialogSource.indexOf(NO_CONTENT_MSG));
  assert.ok(
    !noContentCondition.includes(`preview?.status === "ERROR"`),
    "ERROR belongs to the failure path, not the no-content path",
  );
  assert.ok(
    dialogSource.indexOf(PROCESSING_MSG) > dialogSource.indexOf(NO_CONTENT_MSG),
    "ERROR and ACTIVE statuses still fall through to the existing tail branch",
  );
});

// 5. READY + 0 chunks -> legacy compatibility behavior stays intact.
test("READY with zero chunks keeps the legacy no-content case", () => {
  const noContentCondition = dialogSource.slice(0, dialogSource.indexOf(NO_CONTENT_MSG));
  assert.ok(
    /preview\?\.status === "READY"/.test(noContentCondition),
    "READY must keep its legacy no-content case",
  );
});

// 6. UPLOADING -> legacy compatibility: never a no-content terminal.
test("UPLOADING keeps legacy processing fallback behavior", () => {
  const noContentCondition = dialogSource.slice(0, dialogSource.indexOf(NO_CONTENT_MSG));
  assert.ok(
    !noContentCondition.includes(`preview?.status === "UPLOADING"`),
    "UPLOADING must not become a no-content terminal case",
  );
});

// 7. No false "still processing" state for INDEXED + 0 chunks: the no-content
//    terminal branch must sit between the content branch and the processing
//    fallback, so terminal-success rows can never reach "still processing".
test("INDEXED + zero chunks can never reach the processing state", () => {
  const contentBranch = dialogSource.indexOf("preview?.content ?");
  const noContentBranch = dialogSource.indexOf(NO_CONTENT_MSG);
  const processingBranch = dialogSource.indexOf(PROCESSING_MSG);
  assert.ok(noContentBranch > contentBranch, "content tried first");
  assert.ok(processingBranch > noContentBranch, "no-content evaluated before the processing fallback");
});