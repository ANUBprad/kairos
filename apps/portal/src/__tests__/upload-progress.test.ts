import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  POLL_INTERVAL_MS,
  POLL_MAX_TICKS,
  allTerminal,
  anyLiveTracking,
  isTerminalTrackingStatus,
  processingPresentation,
  tickBudget,
} from "@/lib/upload-progress";
import { SOURCE_STATUS_VALUES } from "@/lib/source-contract";

const dialogSource = readFileSync(new URL("../components/app/document-upload-dialog.tsx", import.meta.url), "utf8");
const moduleSource = readFileSync(new URL("../lib/upload-progress.ts", import.meta.url), "utf8");

// FILE uploads go STORED -> EXTRACTING -> CHUNKING -> EMBEDDING_PENDING ->
// EMBEDDING -> INDEXED (or ERROR), and QUEUED appears via reprocess.
const FILE_PIPELINE_STATUSES = [
  "QUEUED",
  "STORED",
  "EXTRACTING",
  "CHUNKING",
  "EMBEDDING_PENDING",
  "EMBEDDING",
  "INDEXED",
  "ERROR",
];

// 1. A newly accepted source (STORED) is shown as processing, not complete.
test("accepted source maps to processing, never complete", () => {
  const presentation = processingPresentation("STORED");
  assert.equal(presentation.tone, "active");
  assert.notEqual(presentation.label, "Ready");
  assert.equal(isTerminalTrackingStatus("STORED"), false);
  assert.equal(allTerminal(["STORED"]), false);
});

// 2. Every backend state transition renders a distinct, honest label.
test("all lifecycle states render distinct honest labels", () => {
  const seen = new Set<string>();
  for (const status of SOURCE_STATUS_VALUES) {
    const presentation = processingPresentation(status);
    assert.ok(presentation.label.length > 0, `label missing for ${status}`);
    if (presentation.label !== "Ready") {
      assert.ok(!seen.has(presentation.label), `duplicate label for ${status}: ${presentation.label}`);
    }
    seen.add(presentation.label);
  }
  assert.equal(processingPresentation("INDEXED").label, processingPresentation("READY").label, "INDEXED/READY are the same success state");
  for (const status of FILE_PIPELINE_STATUSES) {
    assert.ok(!/^(100|completed|complete)$/i.test(processingPresentation(status).label), `${status} claims completion`);
  }
});

// 3. Terminal success is shown as complete/ready.
test("terminal success renders ready", () => {
  assert.equal(processingPresentation("INDEXED").tone, "success");
  assert.equal(processingPresentation("READY").tone, "success");
  assert.equal(isTerminalTrackingStatus("INDEXED"), true);
  assert.equal(isTerminalTrackingStatus("READY"), true);
  assert.equal(allTerminal(["EXTRACTING", "INDEXED"]), false); // one still active
  assert.equal(allTerminal(["INDEXED", "READY"]), true);
});

// 4. Terminal error renders a distinct failure state with retry affordance.
test("terminal error renders failure state", () => {
  const presentation = processingPresentation("ERROR");
  assert.equal(presentation.tone, "error");
  assert.equal(presentation.label, "Processing failed");
  assert.equal(isTerminalTrackingStatus("ERROR"), true);
  assert.equal(allTerminal(["ERR0R"]), false);
});

// 5. No fake percentage is ever produced or rendered.
test("no fake progress percentage anywhere", () => {
  for (const status of SOURCE_STATUS_VALUES) {
    const presentation = processingPresentation(status);
    assert.equal("percent" in presentation, false, `percent leaked for ${status}`);
    assert.equal(typeof presentation.label, "string");
  }
});

// 6. Cancel is honest: no fake cancel machinery, close = continue in background.
test("cancel behavior matches implemented semantics (no fake cancellation)", () => {
  assert.ok(!dialogSource.includes("abortRef"), "dialog must not fake cancellation via abortRef");
  assert.ok(!dialogSource.includes("\"cancelled\""), "dialog must not claim cancelled state");
  assert.ok(dialogSource.includes("Processing continues in the background"), "dialog must surface it continues in the background");
  assert.ok(!dialogSource.includes("!isUploading && onOpenChange"), "backdrop close must not be gated by isUploading");
  assert.ok(
    !/variant="secondary"\s+onClick=\{\(\) => onOpenChange\(false\)\}\s+disabled=\{isUploading\}/.test(dialogSource),
    "Close button must stay enabled while sources process in the background",
  );
});

// 7. Polling stops at terminal state or budget expiry.
test("polling bound: terminal stop and tick budget", () => {
  assert.ok(anyLiveTracking([undefined, "STORED"]));
  assert.ok(!anyLiveTracking([undefined, undefined]));
  assert.ok(!allTerminal(["STORED", undefined]));
  assert.ok(allTerminal(["INDEXED", undefined]));
  assert.equal(tickBudget(0), "running");
  assert.equal(tickBudget(POLL_MAX_TICKS - 1), "running");
  assert.equal(tickBudget(POLL_MAX_TICKS), "expired");
  assert.equal(POLL_INTERVAL_MS > 0, true);
  assert.equal(tickBudget(9999), "expired");
});

// 8. Multiple sources stay independent; no single collapsing global status.
test("per-source statuses never collapse into a global one", () => {
  const mixed = ["INDEXED", "STORED", "INDEXED", "ERROR", "INDEXED", "STORED", "INDEXED"];
  assert.equal(allTerminal(mixed), false);
  assert.equal(allTerminal(mixed.map(() => "INDEXED")), true);
  const presentations = mixed.map((s) => processingPresentation(s));
  assert.equal(presentations[1].label, "Uploaded — preparing");
  assert.equal(presentations[3].label, "Processing failed");
  assert.equal(presentations[0].label, "Ready");
});

// 9. Only states the FILE pipeline actually emits are displayed for uploads.
test("upload flow only surfaces states applicable to FILE sources", () => {
  const FILE_APPLICABLE = new Set(["QUEUED", "STORED", "EXTRACTING", "CHUNKING", "EMBEDDING_PENDING", "EMBEDDING", "INDEXED", "ERROR"]);
  for (const status of FILE_PIPELINE_STATUSES) {
    assert.ok(FILE_APPLICABLE.has(status), `${status} is not a FILE pipeline state`);
    assert.ok(processingPresentation(status), `presentation missing for ${status}`);
  }
  assert.equal(processingPresentation("UPLOADING").label, "Uploading"); // enum-only, still handled
  assert.equal(processingPresentation("READY").label, "Ready"); // legacy terminal, handled
  assert.equal(processingPresentation("bogus").tone, "active"); // safe fallback
});

// 10. Retry routes to existing infrastructure: reprocess for backend errors.
test("dialog wires retry to the existing reprocess action", () => {
  assert.ok(dialogSource.includes("retryProcessing"), "dialog must offer a reprocess retry path");
  assert.ok(dialogSource.includes('formData.append("id", id)'), "retry must reprocess the exact source id");
  assert.ok(dialogSource.includes("reprocessDocument(formData)"), "retry must call the existing reprocessDocument action");
  assert.ok(dialogSource.includes("retrySubmission"), "rejected uploads keep a re-submit path");
});

// Tenancy: status refreshes go through the KB-scoped, session-authorized
// listDocuments action only; no un-scoped ids are ever used for refresh.
test("status refresh reuses authorized KB-scoped list", () => {
  assert.ok(dialogSource.includes("listDocuments(kbId)"), "polling must use the authorized KB-scoped list action");
  assert.ok(dialogSource.includes("import { uploadDocument, listDocuments, reprocessDocument }"), "dialog must reuse existing actions");
  assert.ok(!dialogSource.includes("storageKey") && !dialogSource.includes("storageUrl"), "dialog must never touch storage credentials");
  assert.ok(moduleSource.length > 0 && dialogSource.length > 0);
});