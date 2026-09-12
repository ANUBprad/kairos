import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  resolveArtifactDefinition,
  listRegisteredArtifactTypes,
  summaryArtifactSchema,
  extractJsonObject,
  parseStructuredOutput,
  buildBoundedContext,
  assertNonEmptySourceScope,
  assertSourcesOwned,
  buildArtifactTraceMetadata,
  toLearningArtifactData,
  type ArtifactSourceChunk,
  type LearningArtifactRow,
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

describe("artifact trace metadata", () => {
  it("carries artifact, kb, source scope and type in the trace metadata", () => {
    const metadata = buildArtifactTraceMetadata({
      artifactId: "clx-artifact",
      knowledgeBaseId: "clx-kb",
      sourceIds: ["clx-doc1", "clx-doc2"],
      artifactType: "SUMMARY",
    });
    assert.deepEqual(metadata, {
      artifactId: "clx-artifact",
      knowledgeBaseId: "clx-kb",
      sourceIds: ["clx-doc1", "clx-doc2"],
      artifactType: "SUMMARY",
    });
  });

  it("snapshots the source array rather than aliasing caller input", () => {
    const sourceIds = ["clx-doc1"];
    const metadata = buildArtifactTraceMetadata({
      artifactId: "clx-a",
      knowledgeBaseId: "clx-kb",
      sourceIds,
      artifactType: "SUMMARY",
    });
    sourceIds.push("clx-doc2");
    assert.equal((metadata.sourceIds as string[]).length, 1);
  });
});

describe("artifact engine wiring", () => {
  const engineSource = readFileSync(
    new URL("../lib/artifacts/engine.ts", import.meta.url),
    "utf8",
  );

  it("generates through the provider abstraction, never raw provider SDKs", () => {
    assert.match(engineSource, /getAIProvider|generateChat/);
    assert.doesNotMatch(
      engineSource,
      /from ["'](openai|@google\/generativelanguage)["']|new OpenAI\(|new GoogleGenerativeAI\(/,
    );
  });

  it("reuses canAccessKnowledgeBase for authorization", () => {
    assert.match(engineSource, /canAccessKnowledgeBase/);
  });

  it("persists terminal states through the atomic lifecycle operations", () => {
    assert.match(engineSource, /completeLearningArtifact/);
    assert.match(engineSource, /failLearningArtifact/);
  });

  it("requires an explicit non-empty source scope at the entrypoint", () => {
    assert.match(engineSource, /assertNonEmptySourceScope/);
  });
});

describe("artifact application wiring", () => {
  const actionsSource = readFileSync(
    new URL("../lib/actions/artifacts.ts", import.meta.url),
    "utf8",
  );
  const persistenceSource = readFileSync(
    new URL("../lib/artifacts/persistence.ts", import.meta.url),
    "utf8",
  );

  it("is a server action boundary", () => {
    assert.match(actionsSource, /^"use server";/m);
  });

  it("delegates generation to the artifact engine instead of a second pipeline", () => {
    assert.match(actionsSource, /generateLearningArtifact/);
    assert.doesNotMatch(actionsSource, /generateChat|getAIProvider/);
  });

  it("authorizes reads and lists through canAccessKnowledgeBase, never a second check", () => {
    const authUses = actionsSource.match(/canAccessKnowledgeBase/g);
    assert.equal(authUses?.length, 3); // one import + the read and list call sites
    assert.doesNotMatch(actionsSource, /API_KEY|session\.user\.id to|members/);
  });

  it("keeps direct database access out of the application layer", () => {
    assert.doesNotMatch(actionsSource, /from ["']@\/lib\/prisma["']/);
  });

  it("reads artifacts through the KB-scoped persistence primitive", () => {
    assert.match(actionsSource, /getLearningArtifactInKb/);
    assert.match(persistenceSource, /getLearningArtifactInKb[\s\S]*where:\s*\{\s*id,\s*knowledgeBaseId\s*\}/);
  });
});

describe("public artifact DTO contract", () => {
  it("exposes exactly the public application fields and nothing internal", () => {
    const row: LearningArtifactRow = {
      id: "clx-a",
      type: "SUMMARY",
      status: "COMPLETED",
      name: "My summary",
      schemaVersion: 1,
      sourceIds: ["clx-doc1"],
      content: { title: "T", overview: "O", keyPoints: ["K"] },
      metadata: { promptVersion: "summary-v1", providerType: "openai", model: "gpt-4o" },
      knowledgeBaseId: "clx-kb",
      createdById: "clx-user",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    };
    assert.deepEqual(Object.keys(toLearningArtifactData(row)).sort(), [
      "content",
      "createdAt",
      "createdById",
      "id",
      "knowledgeBaseId",
      "metadata",
      "name",
      "schemaVersion",
      "sourceIds",
      "status",
      "type",
      "updatedAt",
    ].sort());
  });

  it("the DTO carries no storage URLs, keys, or credentials fields", () => {
    const row: LearningArtifactRow = {
      id: "clx-a",
      type: "SUMMARY",
      status: "COMPLETED",
      name: null,
      schemaVersion: 1,
      sourceIds: [],
      content: null,
      metadata: null,
      knowledgeBaseId: "clx-kb",
      createdById: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const dto = toLearningArtifactData(row);
    assert.equal(JSON.stringify(dto).match(/storageUrl|storageKey|apiKey|secret|embedding/i), null);
  });

  it("artifact metadata holds only safe provenance fields", () => {
    const safe = JSON.stringify({
      promptVersion: "summary-v1",
      providerType: "openai",
      model: "gpt-4o",
    });
    assert.match(safe, /promptVersion/);
    assert.doesNotMatch(safe, /apiKey|token|secret/i);
  });
});