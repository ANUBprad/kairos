import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_EMBEDDING_MODEL,
  defaultEmbeddingProvider,
  resolveEmbeddingModel,
} from "@/lib/retrieval/embedding-models";

const ENV_KEYS = ["AI_PROVIDER", "OPENAI_EMBEDDING_MODEL", "GEMINI_EMBEDDING_MODEL"] as const;

let saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>>;

beforeEach(() => {
  saved = {};
  for (const key of ENV_KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = saved[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("embedding model resolution", () => {
  // Regression guard. A KB with retrievalConfig = {} used to resolve to the
  // hardcoded "openai" default while the deployment ran AI_PROVIDER=gemini, so
  // Research Chat and the Retrieval Lab embedded 1536-dim queries at
  // 768-dim gemini documents and failed before reaching pgvector at all.
  it("follows the deployment provider when the knowledge base stored none", () => {
    process.env.AI_PROVIDER = "gemini";

    assert.equal(defaultEmbeddingProvider(), "gemini");
    assert.deepEqual(resolveEmbeddingModel(undefined, undefined), {
      provider: "gemini",
      model: DEFAULT_EMBEDDING_MODEL.gemini,
    });
  });

  it("falls back to openai when AI_PROVIDER is unset or unrecognised", () => {
    assert.equal(defaultEmbeddingProvider(), "openai");
    process.env.AI_PROVIDER = "some-other-provider";
    assert.equal(defaultEmbeddingProvider(), "openai");
  });

  it("uses the model stored on the knowledge base over the env default", () => {
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-ada-002";

    assert.deepEqual(resolveEmbeddingModel("openai", "text-embedding-3-large"), {
      provider: "openai",
      model: "text-embedding-3-large",
    });
  });

  it("resolves the per-provider env default when no model was stored", () => {
    process.env.GEMINI_EMBEDDING_MODEL = "embedding-001";
    assert.deepEqual(resolveEmbeddingModel("gemini", undefined), {
      provider: "gemini",
      model: "embedding-001",
    });

    process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-ada-002";
    assert.deepEqual(resolveEmbeddingModel("openai", undefined), {
      provider: "openai",
      model: "text-embedding-ada-002",
    });
  });

  it("keeps the gemini and openai env defaults separate", () => {
    // The provider decides which env var applies, so a gemini KB must never pick
    // up OPENAI_EMBEDDING_MODEL.
    process.env.OPENAI_EMBEDDING_MODEL = "text-embedding-3-large";
    assert.equal(resolveEmbeddingModel("gemini", undefined).model, DEFAULT_EMBEDDING_MODEL.gemini);
    assert.notEqual(
      resolveEmbeddingModel("gemini", undefined).model,
      resolveEmbeddingModel("openai", undefined).model,
    );
  });

  it("is stable for the same inputs, so ingestion and query agree", () => {
    process.env.AI_PROVIDER = "gemini";
    const first = resolveEmbeddingModel(undefined, undefined);
    const second = resolveEmbeddingModel(undefined, undefined);
    assert.deepEqual(first, second);
  });
});
