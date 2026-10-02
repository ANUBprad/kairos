// Phase 8: the production embedding contract. The pgvector column is pinned to
// 768 dimensions, so every surface that chooses, plans, defaults, or submits an
// embedding model must stay inside the indexable set. These are fast contract
// checks; the DB-backed behaviour lives in embedding-contract.integration.test.ts.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DEFAULT_EMBEDDING_MODEL,
  PINNED_EMBEDDING_DIMENSION,
  assertIndexableEmbeddingModel,
  indexableEmbeddingModels,
  resolveEmbeddingModel,
  resolveIndexableEmbeddingModel,
} from "@/lib/retrieval/embedding-models";
import { analyzeConfigurationSpace, generateAllCombinations } from "@/lib/experiment-planner/config-space";

function source(relativePath: string): string {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const INDEXABLE_IDS = ["embedding-001", "text-embedding-004"];

describe("production embedding model contract", () => {
  it("accepts the pinned 768-dimension models", () => {
    for (const id of INDEXABLE_IDS) {
      assert.doesNotThrow(() => assertIndexableEmbeddingModel(id));
      assert.deepEqual(resolveIndexableEmbeddingModel("gemini", id), { provider: "gemini", model: id });
    }
  });

  it("rejects catalogued models whose width the column cannot store", () => {
    for (const id of ["text-embedding-3-small", "text-embedding-ada-002"]) {
      assert.throws(() => assertIndexableEmbeddingModel(id), /1536-dimensional vectors/);
      assert.throws(() => assertIndexableEmbeddingModel(id), /768-dimensional embeddings/);
    }
    assert.throws(() => assertIndexableEmbeddingModel("text-embedding-3-large"), /3072-dimensional vectors/);
    assert.throws(() => resolveIndexableEmbeddingModel("openai", "text-embedding-3-large"), /768-dimensional/);
  });

  it("rejects an unknown model id with a controlled validation error", () => {
    assert.throws(() => assertIndexableEmbeddingModel("vibe/magical-9000"), /not a known embedding model/);
  });

  it("lists the supported models in the rejection message so the fix is obvious", () => {
    assert.throws(() => assertIndexableEmbeddingModel("text-embedding-3-small"), /text-embedding-004/);
  });

  it("keeps the underlying resolver permissive so callers can inspect any catalogued model", () => {
    // resolveEmbeddingModel stays pure; enforcement happens at the retrieval and
    // API boundaries through resolveIndexableEmbeddingModel/assertIndexableEmbeddingModel.
    assert.deepEqual(resolveEmbeddingModel("openai", "text-embedding-3-large"), {
      provider: "openai",
      model: "text-embedding-3-large",
    });
  });

  it("exposes only 768-dimension models through the indexable catalog", () => {
    const models = indexableEmbeddingModels();
    assert.deepEqual(models.map((m) => m.id).sort(), INDEXABLE_IDS);
    for (const m of models) {
      assert.equal(m.dimensions, PINNED_EMBEDDING_DIMENSION);
      assert.notEqual(m.provider, "openai");
    }
  });

  it("derives the default embedding model from the indexable catalog", () => {
    assertIndexableEmbeddingModel(DEFAULT_EMBEDDING_MODEL.gemini);
    assert.equal(DEFAULT_EMBEDDING_MODEL.gemini, "text-embedding-004");
  });
});

describe("embedding contract source guards", () => {
  const UI_SURFACES = [
    "../components/app/retrieval-lab.tsx",
    "../app/app/experiment-builder/experiment-builder-client.tsx",
    "../app/app/advanced-retrieval/advanced-retrieval-client.tsx",
    "../app/app/evaluation/evaluation-client.tsx",
    "../app/app/experiments/experiments-client.tsx",
  ];

  it("never offers a non-indexable embedding model from any production surface", () => {
    for (const relativePath of UI_SURFACES) {
      const text = source(relativePath);
      assert.doesNotMatch(text, /text-embedding-3-(small|large)/, `${relativePath} must not offer an OpenAI embedding`);
      assert.doesNotMatch(text, /text-embedding-ada-002/, `${relativePath} must not offer the legacy OpenAI embedding`);
    }
  });

  it("drives the Retrieval Lab selectors from the indexable catalog", () => {
    const lab = source("../components/app/retrieval-lab.tsx");
    assert.match(lab, /indexableEmbeddingModels\(\)/);
    assert.doesNotMatch(lab, /\bEMBEDDING_PROVIDERS\b/);
    assert.doesNotMatch(lab, /\bEMBEDDING_MODELS\b/);
  });

  it("pins the server-side evaluation retrieval defaults to an indexable model", () => {
    for (const relativePath of ["../lib/evaluation/benchmark.ts", "../lib/evaluation/campaign.ts"]) {
      const text = source(relativePath);
      assert.match(text, /DEFAULT_EMBEDDING_MODEL\.gemini/);
      assert.match(text, /defaultEmbeddingProvider\(\)/);
      assert.doesNotMatch(text, /embeddingModel: "text-embedding-3-/);
    }
  });

  it("defaults the reproducibility manifest to the pinned width", () => {
    const manifest = source("../lib/reproducibility/manifest.ts");
    assert.match(manifest, /DEFAULT_EMBEDDING_MODEL\.gemini/);
    assert.match(manifest, /PINNED_EMBEDDING_DIMENSION/);
  });

  it("validates the submitted embedding model at the API route boundary", () => {
    const route = source("../app/api/v1/experiments/route.ts");
    assert.match(route, /assertIndexableEmbeddingModel\(requestedModel\)/);
    assert.match(route, /DEFAULT_EMBEDDING_MODEL\.gemini/);
    assert.match(route, /status: 400/);
  });

  it("keeps chat/generation model selection independent from the embedding contract", () => {
    const route = source("../app/api/v1/experiments/route.ts");
    assert.match(route, /llm: typeof body\.llm === "string" \? body\.llm : "gpt-4o-mini"/);
    assert.ok(
      indexableEmbeddingModels().every((m) => !/^gpt-|^claude/i.test(m.id)),
      "the embedding catalog must not contain chat models",
    );
  });
});

describe("experiment planner embedding search space", () => {
  it("plans only indexable embedding models, even from incompatible historical runs", () => {
    const space = analyzeConfigurationSpace([
      { config: { embeddingModel: "text-embedding-3-small" } },
      { config: { embeddingModel: "text-embedding-3-large" } },
      { config: { embeddingModel: "text-embedding-004" } },
    ]);
    const dim = space.dimensions.find((d) => d.name === "embeddingModel");
    assert.ok(dim, "planner must expose the embeddingModel dimension");

    const values = dim.values as string[];
    assert.ok(values.includes("text-embedding-004"));
    assert.ok(!values.includes("text-embedding-3-small"));
    assert.ok(!values.includes("text-embedding-3-large"));
    assert.ok(values.every((v) => indexableEmbeddingModels().some((m) => m.id === v)));
    assert.ok(indexableEmbeddingModels().some((m) => m.id === dim.defaultValue));
  });

  it("generates only compatible embedding models across every combination", () => {
    const space = analyzeConfigurationSpace([
      { config: { embeddingModel: "text-embedding-3-small" } },
    ]);
    const combinations = generateAllCombinations(space);
    assert.ok(combinations.length > 0);
    for (const combo of combinations) {
      assert.doesNotThrow(
        () => assertIndexableEmbeddingModel(String(combo.embeddingModel)),
        `planned config offered an incompatible embedding model: ${combo.embeddingModel}`,
      );
    }
  });
});
