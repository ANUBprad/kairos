// Phase 8: exercise the embedding contract at the real boundaries against a
// database (Postgres + pgvector). The pgvector column is pinned to 768, so:
//   - the retrieval-config writer refuses a non-indexable model and writes
//     nothing,
//   - the experiments API refuses a non-indexable submitted model with a
//     controlled 400 (not a raw pgvector dimension error) and defaults to the
//     pinned Gemini model,
//   - a valid configuration still retrieves, proving the guard does not break
//     the working path,
//   - chat/generation model choice stays independent of the embedding choice.
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { NextRequest } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ensureDemoUser, isDemoModeEnabled } from "@/lib/server/demo-user";
import { createApiKey } from "@/lib/api-keys";
import { getRetrievalConfig, runRetrieval, saveRetrievalConfig } from "@/lib/retrieval/service";
import { getModelInfo } from "@/lib/retrieval/embedding-models";
import { PgVectorStore } from "@/lib/vector/store";
import { POST as createExperimentPOST } from "@/app/api/v1/experiments/route";

const DIMS = 768;
const FIXED_VEC = Array.from({ length: DIMS }, (_, i) => (i === 0 ? 1 : 0));

if (process.env.NODE_ENV !== "production") {
  process.env.KAIROS_DEMO_MODE = "true";
  process.env.AI_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "test-dummy-key-do-not-call";
}

describe("embedding production contract against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const orgId = randomUUID();
  const projectId = randomUUID();
  const kbId = randomUUID();

  let client: PrismaClient;
  let demoId: string;
  let apiKey: string;
  let originalFetch: typeof globalThis.fetch | undefined;

  function requireEnvironment(t: { skip: (message?: string) => void }): boolean {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return false;
    }
    if (!isDemoModeEnabled()) {
      t.skip("requires KAIROS_DEMO_MODE=true for the session");
      return false;
    }
    return true;
  }

  function postExperiment(body: Record<string, unknown>) {
    const req = new NextRequest("http://localhost/api/v1/experiments", {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": apiKey },
      body: JSON.stringify(body),
    });
    return createExperimentPOST(req);
  }

  before(async () => {
    if (!testDbUrl) return;
    client = new PrismaClient({ datasources: { db: { url: testDbUrl } } });
    await client.$connect();

    demoId = await ensureDemoUser();
    await client.organization.create({
      data: {
        id: orgId,
        name: "Embedding Contract Org",
        slug: `embed-contract-${randomUUID()}`,
        ownerId: demoId,
      },
    });
    await client.project.create({
      data: { id: projectId, name: "Embedding Contract Project", slug: `embed-contract-p-${randomUUID()}`, organizationId: orgId },
    });
    await client.knowledgeBase.create({
      data: { id: kbId, name: "Embedding Contract KB", projectId, retrievalConfig: {} },
    });
    apiKey = (await createApiKey(demoId, orgId, { name: "embedding-contract", scopes: ["experiment"] })).key;

    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ embedding: { values: FIXED_VEC } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })) as typeof globalThis.fetch;
  });

  after(async () => {
    if (originalFetch) globalThis.fetch = originalFetch;
    if (!testDbUrl) return;
    try {
      await client.organization.deleteMany({ where: { id: orgId } });
    } finally {
      await client.$disconnect();
    }
  });

  it("refuses a 1536-wide OpenAI model submitted to the experiments API with a controlled 400", async (t) => {
    if (!requireEnvironment(t)) return;
    const name = `reject-1536-${randomUUID()}`;

    const res = await postExperiment({ name, knowledgeBaseId: kbId, embeddingModel: "text-embedding-3-small" });
    assert.equal(res.status, 400);
    const { error } = await res.json();
    assert.match(error, /768-dimensional embeddings/);
    assert.match(error, /text-embedding-004/);

    const persisted = await client.experiment.count({ where: { knowledgeBaseId: kbId, name } });
    assert.equal(persisted, 0, "a refused submission must not create an experiment");
  });

  it("refuses a 3072-wide OpenAI model submitted to the experiments API", async (t) => {
    if (!requireEnvironment(t)) return;
    const name = `reject-3072-${randomUUID()}`;

    const res = await postExperiment({ name, knowledgeBaseId: kbId, embeddingModel: "text-embedding-3-large" });
    assert.equal(res.status, 400);
    const { error } = await res.json();
    assert.match(error, /3072-dimensional vectors/);

    const persisted = await client.experiment.count({ where: { knowledgeBaseId: kbId, name } });
    assert.equal(persisted, 0);
  });

  it("defaults an omitted embedding model to the pinned Gemini model", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await postExperiment({ name: `default-${randomUUID()}`, knowledgeBaseId: kbId });
    assert.equal(res.status, 201);
    const experiment = await res.json();
    assert.equal(experiment.embeddingModel, "text-embedding-004");
    assert.equal(getModelInfo(experiment.embeddingModel)?.dimensions, DIMS);
  });

  it("accepts a valid Gemini embedding while a chat/generation model is chosen independently", async (t) => {
    if (!requireEnvironment(t)) return;

    const res = await postExperiment({
      name: `valid-${randomUUID()}`,
      knowledgeBaseId: kbId,
      embeddingModel: "embedding-001",
      llm: "gpt-4o",
    });
    assert.equal(res.status, 201);
    const experiment = await res.json();
    assert.equal(experiment.embeddingModel, "embedding-001");
    assert.equal(experiment.llm, "gpt-4o", "chat model selection must be independent of the embedding contract");
  });

  it("refuses to persist a non-indexable model through the retrieval-config writer", async (t) => {
    if (!requireEnvironment(t)) return;

    await assert.rejects(
      () => saveRetrievalConfig(kbId, { embeddingProvider: "openai", embeddingModel: "text-embedding-3-small" }),
      /768-dimensional/,
    );

    const kb = await client.knowledgeBase.findUnique({ where: { id: kbId }, select: { retrievalConfig: true } });
    const saved = (kb?.retrievalConfig ?? {}) as Record<string, unknown>;
    assert.notEqual(saved.embeddingModel, "text-embedding-3-small");
  });

  it("still retrieves with an existing valid configuration after the guard", async (t) => {
    if (!requireEnvironment(t)) return;

    const docId = randomUUID();
    const chunkId = randomUUID();
    await client.document.create({
      data: { id: docId, name: "contract.txt", fileType: "txt", knowledgeBaseId: kbId, status: "INDEXED" },
    });
    await client.documentChunk.create({
      data: { id: chunkId, documentId: docId, content: "alpha contract body", index: 0, tokenCount: 4 },
    });
    await new PgVectorStore(client).bulkUpsertEmbeddings([{ chunkId, embedding: FIXED_VEC }], DIMS);

    const saved = await saveRetrievalConfig(kbId, {
      embeddingProvider: "gemini",
      embeddingModel: "text-embedding-004",
    });
    assert.equal(saved.embeddingModel, "text-embedding-004");

    const reloaded = await getRetrievalConfig(kbId);
    const result = await runRetrieval(kbId, "alpha", {
      ...reloaded,
      retrievalStrategy: "vector",
      retrievalMode: "vector",
      topK: 5,
      similarityThreshold: 0,
    });
    assert.ok(result.chunks.some((c) => c.documentId === docId), "a valid config must still retrieve");
  });
});
