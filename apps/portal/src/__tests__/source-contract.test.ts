import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Source Library backend contract — pure helpers extracted from the document
// server actions so they can be tested without a database. Covers the
// list/filter/ordering contract and the bulk tenancy guard.
// DB-backed behaviors (list authorization, preview, delete/reprocess flows)
// are not integration-tested because no test database exists.

import {
  SOURCE_TYPE_VALUES,
  SOURCE_STATUS_VALUES,
  parseSourceTypeFilter,
  parseStatusFilter,
  resolveSourceListOrder,
  resolveSourceWhere,
  assertSameKnowledgeBase,
} from "@/lib/source-contract";

describe("Source list — source type contract", () => {
  it("exposes exactly the four supported source types", () => {
    assert.deepEqual([...SOURCE_TYPE_VALUES], ["FILE", "TEXT", "URL", "YOUTUBE"]);
  });

  it("parses each supported source type filter", () => {
    for (const value of SOURCE_TYPE_VALUES) {
      assert.equal(parseSourceTypeFilter(value), value);
    }
  });

  it("treats empty/undefined source type filter as no filter", () => {
    assert.equal(parseSourceTypeFilter(undefined), undefined);
    assert.equal(parseSourceTypeFilter(""), undefined);
  });

  it("rejects an invalid source type filter", () => {
    assert.throws(() => parseSourceTypeFilter("PDF"), /Invalid source type filter/);
    assert.throws(() => parseSourceTypeFilter("youtube"), /Invalid source type filter/);
    assert.throws(() => parseSourceTypeFilter("YOUTUBE_EXTRA"), /Invalid source type filter/);
  });
});

describe("Source list — status contract", () => {
  it("exposes the full stored status set", () => {
    assert.deepEqual([...SOURCE_STATUS_VALUES], [
      "QUEUED",
      "UPLOADING",
      "STORED",
      "EXTRACTING",
      "CHUNKING",
      "EMBEDDING_PENDING",
      "EMBEDDING",
      "INDEXED",
      "READY",
      "ERROR",
    ]);
  });

  it("parses each stored status filter", () => {
    for (const value of SOURCE_STATUS_VALUES) {
      assert.equal(parseStatusFilter(value), value);
    }
  });

  it("treats empty/undefined status filter as no filter", () => {
    assert.equal(parseStatusFilter(undefined), undefined);
    assert.equal(parseStatusFilter(""), undefined);
  });

  it("rejects invalid status filters", () => {
    // "PROCESSING" is a UI grouping label, not a stored status.
    assert.throws(() => parseStatusFilter("PROCESSING"), /Invalid status filter/);
    assert.throws(() => parseStatusFilter("DELETED"), /Invalid status filter/);
    assert.throws(() => parseStatusFilter("processing"), /Invalid status filter/);
  });
});

describe("Source list — deterministic ordering", () => {
  it("orders by createdAt desc with an id tie-breaker", () => {
    assert.deepEqual(resolveSourceListOrder(), [{ createdAt: "desc" }, { id: "desc" }]);
  });
});

describe("Source list — scoping and filters", () => {
  it("always scopes to the knowledge base", () => {
    assert.deepEqual(resolveSourceWhere("kb-1"), { knowledgeBaseId: "kb-1" });
  });

  it("applies a valid sourceType filter", () => {
    assert.deepEqual(resolveSourceWhere("kb-1", { sourceType: "URL" }), {
      knowledgeBaseId: "kb-1",
      sourceType: "URL",
    });
  });

  it("applies a valid status filter", () => {
    assert.deepEqual(resolveSourceWhere("kb-1", { status: "READY" }), {
      knowledgeBaseId: "kb-1",
      status: "READY",
    });
  });

  it("combines sourceType and status filters", () => {
    assert.deepEqual(resolveSourceWhere("kb-1", { sourceType: "YOUTUBE", status: "ERROR" }), {
      knowledgeBaseId: "kb-1",
      sourceType: "YOUTUBE",
      status: "ERROR",
    });
  });

  it("does not include filter keys for empty values", () => {
    assert.deepEqual(resolveSourceWhere("kb-1", { sourceType: "", status: "" }), {
      knowledgeBaseId: "kb-1",
    });
  });

  it("rejects an invalid sourceType on the where builder", () => {
    assert.throws(() => resolveSourceWhere("kb-1", { sourceType: "PDF" }), /Invalid source type filter/);
  });

  it("rejects an invalid status on the where builder", () => {
    assert.throws(() => resolveSourceWhere("kb-1", { status: "PROCESSING" }), /Invalid status filter/);
  });
});

describe("Bulk operations — tenant isolation guard", () => {
  it("returns the knowledge base id for single-KB selections", () => {
    const docs = [{ id: "d1", knowledgeBaseId: "kb-1" }, { id: "d2", knowledgeBaseId: "kb-1" }];
    assert.equal(assertSameKnowledgeBase(docs), "kb-1");
  });

  it("accepts a single document", () => {
    const docs: { id: string; knowledgeBaseId: string }[] = [{ id: "d1", knowledgeBaseId: "kb-1" }];
    assert.equal(assertSameKnowledgeBase(docs), "kb-1");
  });

  it("rejects a mix of knowledge bases before any mutation", () => {
    const docs = [{ id: "d1", knowledgeBaseId: "kb-1" }, { id: "d2", knowledgeBaseId: "kb-2" }];
    assert.throws(() => assertSameKnowledgeBase(docs), /All documents must belong to the same knowledge base/);
  });

  it("rejects a selection that resolves to no documents", () => {
    assert.throws(() => assertSameKnowledgeBase([]), /No documents found/);
  });
});