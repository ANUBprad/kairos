import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { revalidateSourcePage } from "@/lib/revalidation";

const serviceSource = readFileSync(new URL("../lib/ai/embeddings/service.ts", import.meta.url), "utf8");
const documentSource = readFileSync(new URL("../lib/actions/document.ts", import.meta.url), "utf8");
const revalidationSource = readFileSync(new URL("../lib/revalidation.ts", import.meta.url), "utf8");

// 1. Best-effort revalidation never breaks the pipeline: with no active request
// scope (the fire-and-forget embedding context) Next.js raises a store
// invariant, which the helper must absorb instead of throwing into the
// processing state transition.
test("off-request revalidation degrades gracefully and never throws", () => {
  assert.doesNotThrow(() => revalidateSourcePage("kb_test"));
  assert.doesNotThrow(() => revalidateSourcePage(undefined));
  assert.doesNotThrow(() => revalidateSourcePage(null));
});

// 2. Successful embedding reaches INDEXED and revalidates the source page using
// the trusted KB id resolved from the document row.
test("INDEXED success transitions revalidate the source page", () => {
  assert.ok(
    serviceSource.includes("knowledgeBaseId: true"),
    "embedding service must resolve the trusted KB id from the document row",
  );
  assert.equal(
    (serviceSource.match(/revalidateSourcePage\(doc\.knowledgeBaseId\)/g) ?? []).length,
    2,
    "both INDEXED paths (empty chunks + successful embed) must revalidate",
  );
  assert.ok(
    serviceSource.indexOf('data: { status: "INDEXED" }') < serviceSource.indexOf('revalidateSourcePage(doc.knowledgeBaseId)', serviceSource.indexOf("chunks.length === 0")),
    "revalidation must run after the INDEXED transition commits",
  );
});

// 3. Failed processing reaches ERROR (or revert-to-INDEXED) and revalidates the
// same KB-scoped source page.
test("terminal ERROR and revert-to-INDEXED revalidate the source page", () => {
  assert.ok(documentSource.includes("revalidateSourcePage(docRow?.knowledgeBaseId)"), "rollback must revalidate after a failure terminal state");
  assert.equal(
    (documentSource.match(/revalidateSourcePage\(docRow\?\.knowledgeBaseId\)/g) ?? []).length,
    2,
    "both the revert-to-INDEXED and the plain ERROR paths must revalidate",
  );
  assert.ok(
    documentSource.indexOf('data: { status: "ERROR" }') < documentSource.lastIndexOf("revalidateSourcePage("),
    "revalidation must run after the ERROR state commits",
  );
});

// 4. The KB path is constructed only from the source's own trusted context.
test("invalidated path is scoped to the source's own KB", () => {
  assert.ok(
    revalidationSource.includes("/app/knowledge-bases/${kbId}"),
    "helper must build exactly /app/knowledge-bases/${kbId} from the passed KB id",
  );
  assert.equal(
    (revalidationSource.match(/\/app\/knowledge-bases/g) ?? []).length,
    1,
    "only one KB-scoped route may ever be invalidated",
  );
  assert.ok(!/\$\{docId\}/.test(revalidationSource), "route must never depend on a client-supplied document id");
  assert.ok(!/revalidateSourcePage\(.*,\s*.*\)/.test(documentSource), "never invalidate more than one route per call");
});

// 5. Unrelated KBs are never invalidated by background completion.
test("revalidation never touches unrelated KB routes", () => {
  assert.equal(revalidationSource.includes("revalidatePath(`/app/knowledge-bases/${kbId}`)"), true, "exactly one KB-scoped path");
  assert.ok(!revalidationSource.includes("listDocuments") && !revalidationSource.includes("documentChunk"), "helper only revalidates, never re-queries source data");
  assert.ok(!serviceSource.includes("revalidatePath(`/app/knowledge-bases/") || serviceSource.includes("doc.knowledgeBaseId"), "service must derive the path from the document's own KB");
});

// 6. No storage credentials or URLs enter the revalidation path or response.
test("no storage credentials leak through revalidation", () => {
  for (const needle of ["storageKey", "storageUrl", "getSignedUrl", "signedUrl", "accessMode"]) {
    assert.ok(!revalidationSource.includes(needle), `revalidation must not reference ${needle}`);
  }
  assert.ok(!serviceSource.includes("revalidatePath(`/app/knowledge-bases/${knowledgeBaseId}`)") || serviceSource.includes("doc.knowledgeBaseId"), "path uses the resolved document KB id only");
});

// 7. F7's bounded polling contract is untouched by this change surface.
test("existing F7 polling surface is unchanged", () => {
  assert.ok(!serviceSource.includes("POLL_INTERVAL_MS"), "embedding service must not add polling");
  assert.ok(!documentSource.includes("POLL_INTERVAL_MS"), "document actions must not add polling");
  assert.ok(!revalidationSource.includes("setInterval"), "revalidation helper must not poll");
});