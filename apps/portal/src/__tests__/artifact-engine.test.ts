import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveArtifactDefinition,
  listRegisteredArtifactTypes,
  summaryArtifactSchema,
  extractJsonObject,
  parseStructuredOutput,
  buildBoundedContext,
  assertNonEmptySourceScope,
  assertSourcesOwned,
  type ArtifactSourceChunk,
} from "@/lib/artifacts";

const validSummary = {
  title: "Photosynthesis",
  overview: "Plants convert sunlight into chemical energy.",
  keyPoints: ["Chlorophyll absorbs light", "Oxygen is released"],
};

describe("artifact definition registry", () => {
  it("registers exactly the SUMMARY type (no fake implementations for others)", () => {
    assert.deepEqual(listRegisteredArtifactTypes(), ["SUMMARY"]);
  });

  it("resolves the SUMMARY definition and exposes its declared metadata", () => {
    const def = resolveArtifactDefinition("SUMMARY");
    assert.equal(def.type, "SUMMARY");
    assert.equal(def.schemaVersion, 1);
    assert.equal(def.promptVersion, "summary-v1");
    assert.ok(def.contextTokenBudget > 0);
    assert.equal(def.buildSystemPrompt().length > 0, true);
  });

  it("rejects generation for types without a registered definition", () => {
    assert.throws(() => resolveArtifactDefinition("REPORT"), { code: "UNSUPPORTED_ARTIFACT_TYPE" });
    assert.throws(() => resolveArtifactDefinition("QUIZ"), { code: "UNSUPPORTED_ARTIFACT_TYPE" });
    assert.throws(() => resolveArtifactDefinition("FLASHCARDS"), { code: "UNSUPPORTED_ARTIFACT_TYPE" });
    assert.throws(() => resolveArtifactDefinition("MINDMAP"), { code: "UNSUPPORTED_ARTIFACT_TYPE" });
  });
});

describe("summary output schema", () => {
  it("accepts a valid summary payload", () => {
    const result = summaryArtifactSchema.safeParse(validSummary);
    assert.deepEqual(result.success ? result.data : null, validSummary);
  });

  it("rejects a payload missing required keys", () => {
    assert.equal(summaryArtifactSchema.safeParse({ title: "X", overview: "Y" }).success, false);
  });

  it("rejects empty overview and empty keyPoints", () => {
    assert.equal(summaryArtifactSchema.safeParse({ ...validSummary, overview: "" }).success, false);
    assert.equal(
      summaryArtifactSchema.safeParse({ ...validSummary, keyPoints: [] }).success,
      false,
    );
  });

  it("rejects non-string titles and non-string key points", () => {
    assert.equal(summaryArtifactSchema.safeParse({ ...validSummary, title: 42 }).success, false);
    assert.equal(
      summaryArtifactSchema.safeParse({ ...validSummary, keyPoints: [1, 2] }).success,
      false,
    );
  });

  it("strictly rejects unknown extra keys", () => {
    assert.equal(
      summaryArtifactSchema.safeParse({ ...validSummary, fceExtras: true }).success,
      false,
    );
  });
});

describe("structured output parsing", () => {
  it("extracts bare JSON", () => {
    assert.deepEqual(extractJsonObject(JSON.stringify(validSummary)), validSummary);
  });

  it("extracts JSON from markdown code fences", () => {
    const fenced = "```json\n" + JSON.stringify(validSummary) + "\n```";
    assert.deepEqual(extractJsonObject(fenced), validSummary);
  });

  it("extracts JSON surrounded by prose", () => {
    const noisy = "Sure! Here is your summary:\n" + JSON.stringify(validSummary) + "\nHope that helps.";
    assert.deepEqual(extractJsonObject(noisy), validSummary);
  });

  it("handles braces inside string values", () => {
    assert.deepEqual(extractJsonObject('{"title":"a {b} c"}'), { title: "a {b} c" });
  });

  it("returns null for unbalanced or absent JSON", () => {
    assert.equal(extractJsonObject("{ not json"), null);
    assert.equal(extractJsonObject("no object here"), null);
    assert.deepEqual(extractJsonObject(""), null);
  });

  it("parses valid output through the summary schema", () => {
    const parsed = parseStructuredOutput(summaryArtifactSchema, JSON.stringify(validSummary));
    assert.equal(parsed.ok, true);
    assert.ok(parsed.ok);
  });

  it("fails output that is not JSON at all", () => {
    const parsed = parseStructuredOutput(summaryArtifactSchema, "Just some words");
    assert.equal(parsed.ok, false);
  });

  it("fails output that mismatches the schema", () => {
    const parsed = parseStructuredOutput(summaryArtifactSchema, JSON.stringify({ nope: 1 }));
    assert.equal(parsed.ok, false);
  });
});

describe("bounded source context", () => {
  const chunks: ArtifactSourceChunk[] = [
    {
      chunkId: "ch1",
      documentId: "doc1",
      documentName: "Alpha",
      index: 0,
      pageNumber: null,
      content: "AAAAAAAA", // 8 chars -> 2 tokens by heuristic
      tokenCount: 2,
    },
    {
      chunkId: "ch2",
      documentId: "doc1",
      documentName: "Alpha",
      index: 1,
      pageNumber: 3,
      content: "BBBBBBBB",
      tokenCount: 2,
    },
    {
      chunkId: "ch3",
      documentId: "doc2",
      documentName: "Beta",
      index: 0,
      pageNumber: null,
      content: "CCCCCCCC",
      tokenCount: 2,
    },
  ];

  it("includes all chunks when within budget and preserves document/chunk order", () => {
    const bounded = buildBoundedContext(chunks, 100);
    assert.equal(bounded.includedChunks, 3);
    assert.equal(bounded.truncatedChunks, 0);
    assert.ok(bounded.context.includes('<source id="ch1"'));
    assert.ok(bounded.context.includes("ch2", bounded.context.indexOf("ch1")));
    assert.ok(bounded.context.includes("<source id=\"ch3\""));
  });

  it("hard-caps context at whole-chunk granularity and reports truncation", () => {
    const bounded = buildBoundedContext(chunks, 4);
    assert.equal(bounded.includedChunks, 2);
    assert.equal(bounded.truncatedChunks, 1);
    assert.ok(bounded.context.includes("ch2"));
    assert.ok(!bounded.context.includes("ch3"));
  });

  it("always keeps the first chunk even when it exceeds the budget", () => {
    const hugeFirst = [{ ...chunks[0], tokenCount: 1000 }];
    const bounded = buildBoundedContext(hugeFirst, 10);
    assert.equal(bounded.includedChunks, 1);
    assert.ok(bounded.context.includes("AAAAAAAA"));
  });

  it("estimates tokens with len/4 when tokenCount is missing", () => {
    const noCount = [{ ...chunks[0], tokenCount: null, content: "0123456789abcd" }];
    const bounded = buildBoundedContext(noCount, 4);
    assert.equal(bounded.includedChunks, 1); // 14 chars -> 4 tokens, fits
  });
});

describe("artifact source scope", () => {
  it("rejects an empty source scope explicitly (empty is never all sources)", () => {
    assert.throws(() => assertNonEmptySourceScope([]), { code: "ARTIFACT_NO_SOURCES" });
    assert.deepEqual(assertNonEmptySourceScope(["doc1"]), ["doc1"]);
  });

  it("accepts a fully owned scope and preserves order", () => {
    assert.deepEqual(
      assertSourcesOwned(["doc2", "doc1"], new Set(["doc1", "doc2"])),
      ["doc2", "doc1"],
    );
  });

  it("rejects a scope containing any source outside the knowledge base", () => {
    assert.throws(
      () => assertSourcesOwned(["doc1", "foreign"], new Set(["doc1"])),
      { code: "ARTIFACT_SOURCE_OUT_OF_SCOPE" },
    );
  });
});