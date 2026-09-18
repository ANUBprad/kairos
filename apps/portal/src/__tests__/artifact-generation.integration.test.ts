import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { PrismaClient } from "@prisma/client";
import { generateLearningArtifactForUser } from "@/lib/artifacts/engine";
import { listLearningArtifacts } from "@/lib/artifacts/persistence";
import { getAIProvider } from "@/lib/ai/providers";
import { generateEmbeddings } from "@/lib/ai/embeddings";

const DIM = 1536;

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function unitVector(hotIndex: number): number[] {
  return Array.from({ length: DIM }, (_, i) => (i === hotIndex ? 1 : 0));
}

function unitVectorBase64(hotIndex: number): string {
  const arr = new Float32Array(DIM);
  arr[hotIndex] = 1;
  return Buffer.from(arr.buffer).toString("base64");
}

function metadataOf(artifact: { metadata: unknown }): Record<string, unknown> {
  return (artifact.metadata as Record<string, unknown> | null) ?? {};
}

function openaiEmbeddingResponse(count: number): Record<string, unknown> {
  return {
    object: "list",
    data: Array.from({ length: count }, (_, i) => ({
      object: "embedding",
      index: i,
      embedding: unitVectorBase64(i),
    })),
    model: "text-embedding-3-small",
    usage: { prompt_tokens: count * 4, total_tokens: count * 4 },
  };
}

function openaiChatCompletionResponse(): Record<string, unknown> {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "gpt-4o-mini",
    choices: [
      {
        index: 0,
        message: { role: "assistant", content: JSON.stringify(VALID_SUMMARY_CONTENT) },
        finish_reason: "stop",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
  };
}

// The OpenAI SDK pins globalThis.fetch when its client is constructed, and the
// provider instance is cached (providerCache). The stub must be installed in
// before(), before any test constructs the provider, and must route by URL so a
// single stub serves both embeddings and chat.
function routedOpenAIStub(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  if (url.includes("/embeddings")) {
    const body = JSON.parse(String(init?.body ?? "{}"));
    const count = Array.isArray(body?.input) ? body.input.length : 1;
    return Promise.resolve(
      new Response(JSON.stringify(openaiEmbeddingResponse(count)), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  if (url.includes("/chat/completions")) {
    return Promise.resolve(
      new Response(JSON.stringify(openaiChatCompletionResponse()), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
  }
  return Promise.resolve(new Response("unexpected fetch", { status: 500 }));
}

const VALID_SUMMARY_CONTENT = {
  title: "Test Artifact",
  overview: "A generated summary of the source content.",
  keyPoints: ["first key point", "second key point"],
};

describe("artifact generation: happy path and crash-window recovery", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;

  const aliceId = randomUUID();
  const orgAId = randomUUID();
  const projAId = randomUUID();
  const kbAId = randomUUID();
  const docHappyId = randomUUID();
  const chunkId = randomUUID();

  let client: PrismaClient;
  let originalFetch: typeof globalThis.fetch;

  before(async () => {
    if (!testDbUrl) return;

    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";

    originalFetch = globalThis.fetch;
    globalThis.fetch = routedOpenAIStub as typeof globalThis.fetch;

    client = makeTestClient(testDbUrl);
    await client.$connect();

    await client.user.create({
      data: { id: aliceId, email: `gen-alice-${randomUUID()}@test.local`, name: "Alice" },
    });

    await client.organization.create({
      data: { id: orgAId, name: "Gen Org", slug: `genorg-${randomUUID()}`, ownerId: aliceId },
    });

    await client.project.create({
      data: { id: projAId, name: "Gen Project", slug: `genproj-${randomUUID()}`, organizationId: orgAId },
    });

    await client.knowledgeBase.create({
      data: { id: kbAId, name: "Gen KB", projectId: projAId },
    });

    await client.member.create({
      data: { organizationId: orgAId, userId: aliceId, role: "MEMBER" },
    });

    await client.document.create({
      data: { id: docHappyId, name: "source.txt", fileType: "txt", knowledgeBaseId: kbAId, status: "INDEXED" },
    });

    await client.documentChunk.create({
      data: {
        id: chunkId,
        documentId: docHappyId,
        index: 0,
        content: "Alpha source content for the artifact generation.",
        tokenCount: 200,
      },
    });
  });

  after(async () => {
    if (!testDbUrl) return;

    if (originalFetch) globalThis.fetch = originalFetch;

    try {
      await client.organization.deleteMany({ where: { id: orgAId } });
      await client.user.deleteMany({ where: { id: aliceId } });
    } finally {
      await client.$disconnect();
    }
  });

  // ---- Happy path ----

  it("generates a completed SUMMARY artifact with correct content and metadata", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const artifact = await generateLearningArtifactForUser({
        userId: aliceId,
        knowledgeBaseId: kbAId,
        artifactType: "SUMMARY",
        sourceIds: [docHappyId],
      });

      assert.equal(artifact.status, "COMPLETED");
      assert.deepEqual(artifact.content, VALID_SUMMARY_CONTENT);
      assert.equal(artifact.type, "SUMMARY");
      assert.deepEqual(artifact.sourceIds, [docHappyId]);
      assert.equal(artifact.knowledgeBaseId, kbAId);
      assert.equal(typeof metadataOf(artifact).promptVersion, "string");
      assert.equal(metadataOf(artifact).providerType, "openai");
      assert.equal(metadataOf(artifact).model, "gpt-4o-mini");

      // No duplicate rows.
      const rows = (await listLearningArtifacts(kbAId)).filter(
        (a) => a.type === "SUMMARY" && a.sourceIds.includes(docHappyId),
      );
      assert.equal(rows.length, 1, "exactly one SUMMARY artifact must exist for this source");

      // A Trace row must have been recorded with OK status.
      const trace = await client.trace.findFirst({
        where: {
          name: "artifact.generate.summary",
          metadata: { path: ["artifactId"], equals: artifact.id },
        },
      });
      assert.ok(trace, "a Trace row must be recorded for the successful generation");
      assert.equal(trace.status, "OK");
  });

  // ---- Crash-window regression ----

  it("a getDefaultModel failure after PROCESSING leaves the artifact FAILED, not stranded", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const provider = getAIProvider();
    mock.method(provider, "getDefaultModel", () => {
      throw new Error("model resolution failed");
    });

    try {
      await assert.rejects(
        generateLearningArtifactForUser({
          userId: aliceId,
          knowledgeBaseId: kbAId,
          artifactType: "SUMMARY",
          sourceIds: [docHappyId],
        }),
        (err: unknown) => err instanceof Error && /ARTIFACT_GENERATION_FAILED/i.test((err as { code?: string }).code ?? ""),
      );

      const artifacts = await listLearningArtifacts(kbAId);
      const failed = artifacts.find(
        (a) => a.type === "SUMMARY" && a.sourceIds.includes(docHappyId) && a.status === "FAILED",
      );
      assert.ok(failed, "the artifact must have been marked FAILED instead of stranded as PROCESSING");
      assert.equal(typeof metadataOf(failed!).error, "string");
    } finally {
      mock.restoreAll();
    }
  });

  // ---- Provider failures ----

  it("a provider generateChat failure lands the artifact FAILED", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const provider = getAIProvider();
    mock.method(provider, "generateChat", async () => {
      throw new Error("provider communication error");
    });

    try {
      await assert.rejects(
        generateLearningArtifactForUser({
          userId: aliceId,
          knowledgeBaseId: kbAId,
          artifactType: "SUMMARY",
          sourceIds: [docHappyId],
        }),
        (err: unknown) => err instanceof Error && /ARTIFACT_GENERATION_FAILED/i.test((err as { code?: string }).code ?? ""),
      );

      const artifacts = await listLearningArtifacts(kbAId);
      const failed = artifacts.find(
        (a) => a.type === "SUMMARY" && a.sourceIds.includes(docHappyId) && a.status === "FAILED",
      );
      assert.ok(failed, "the artifact must have been marked FAILED after provider error");
    } finally {
      mock.restoreAll();
    }
  });

  it("invalid provider output lands the artifact FAILED with ARTIFACT_SCHEMA_ERROR", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)"); return; }

    const provider = getAIProvider();
    mock.method(provider, "generateChat", async () => ({
      content: "not valid json at all",
      model: "gpt-4o-mini",
    }));

    try {
      await assert.rejects(
        generateLearningArtifactForUser({
          userId: aliceId,
          knowledgeBaseId: kbAId,
          artifactType: "SUMMARY",
          sourceIds: [docHappyId],
        }),
        (err: unknown) => err instanceof Error && /ARTIFACT_SCHEMA_ERROR/i.test((err as { code?: string }).code ?? ""),
      );

      const artifacts = await listLearningArtifacts(kbAId);
      const failed = artifacts.find(
        (a) => a.type === "SUMMARY" && a.sourceIds.includes(docHappyId) && a.status === "FAILED",
      );
      assert.ok(failed, "the artifact must have been marked FAILED after schema error");
    } finally {
      mock.restoreAll();
    }
  });

  // ---- Real-provider E2E: embed an INDEXED source, generate it, persist, retrieve ----

  it("embeds a new source through the real embedding service, then generates, persists and retrieves the artifact", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const hasVector = await client.$queryRaw<{ extname: string }[]>`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    if (hasVector.length === 0) {
      t.skip("pgvector extension is not installed in the test database");
      return;
    }

    const docEmbedId = randomUUID();
    const chunkEmbedId = randomUUID();
    await client.document.create({
      data: {
        id: docEmbedId,
        name: "e2e-source.txt",
        fileType: "txt",
        knowledgeBaseId: kbAId,
        status: "EMBEDDING_PENDING",
      },
    });
    await client.documentChunk.create({
      data: {
        id: chunkEmbedId,
        documentId: docEmbedId,
        index: 0,
        content: "End-to-end source that must reach INDEXED through the embedding provider.",
        tokenCount: 200,
      },
    });

    const embed = await generateEmbeddings(docEmbedId);

      assert.equal(embed.model, "text-embedding-3-small");
      assert.equal(embed.chunkCount, 1);

      const indexed = await client.document.findUniqueOrThrow({
        where: { id: docEmbedId },
        select: { status: true },
      });
      assert.equal(indexed.status, "INDEXED");

      const stored = await client.documentEmbedding.findUniqueOrThrow({
        where: { chunkId: chunkEmbedId },
        select: { model: true, dimensions: true, status: true },
      });
      assert.equal(stored.status, "completed");
      assert.equal(stored.model, "text-embedding-3-small");
      assert.equal(stored.dimensions, DIM);

      const dims = await client.$queryRaw<{ dims: number }[]>`
        SELECT vector_dims("embedding")::int AS dims FROM "DocumentEmbedding" WHERE "chunkId" = ${chunkEmbedId}
      `;
      assert.equal(dims[0].dims, DIM);

      const artifact = await generateLearningArtifactForUser({
        userId: aliceId,
        knowledgeBaseId: kbAId,
        artifactType: "SUMMARY",
        sourceIds: [docEmbedId],
      });

      assert.equal(artifact.status, "COMPLETED");
      assert.deepEqual(artifact.content, VALID_SUMMARY_CONTENT);
      assert.deepEqual(artifact.sourceIds, [docEmbedId]);

      const rows = (await listLearningArtifacts(kbAId)).filter(
        (a) => a.type === "SUMMARY" && a.sourceIds.includes(docEmbedId),
      );
      assert.equal(rows.length, 1, "the freshly-embedded source must be retrievable after generation");

      const trace = await client.trace.findFirst({
        where: {
          name: "artifact.generate.summary",
          metadata: { path: ["artifactId"], equals: artifact.id },
        },
      });
      assert.ok(trace, "a Trace row must be recorded for the E2E generation");
      assert.equal(trace.status, "OK");
  });

  it("uses the resolved embedding provider's model when providerType is omitted", async (t) => {
    if (!testDbUrl) { t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)"); return; }

    const hasVector = await client.$queryRaw<{ extname: string }[]>`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    if (hasVector.length === 0) {
      t.skip("pgvector extension is not installed in the test database");
      return;
    }

    const docGemId = randomUUID();
    const chunkGemId = randomUUID();
    await client.document.create({
      data: {
        id: docGemId,
        name: "gem-model-source.txt",
        fileType: "txt",
        knowledgeBaseId: kbAId,
        status: "EMBEDDING_PENDING",
      },
    });
    await client.documentChunk.create({
      data: {
        id: chunkGemId,
        documentId: docGemId,
        index: 0,
        content: "Gemini-model source for the provider/model join.",
        tokenCount: 100,
      },
    });

    process.env.AI_PROVIDER = "gemini";
    process.env.GEMINI_API_KEY = "test-dummy-key-do-not-call";
    process.env.GEMINI_EMBEDDING_MODEL = "text-embedding-004";

    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes(":embedContent")) {
        return new Response(
          JSON.stringify({ embedding: { values: unitVector(0) } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("unexpected fetch", { status: 500 });
    }) as typeof globalThis.fetch;

    try {
      const embed = await generateEmbeddings(docGemId);

      assert.equal(embed.model, "text-embedding-004", "model must come from the resolved gemini provider");

      const indexed = await client.document.findUniqueOrThrow({
        where: { id: docGemId },
        select: { status: true },
      });
      assert.equal(indexed.status, "INDEXED");

      const stored = await client.documentEmbedding.findUniqueOrThrow({
        where: { chunkId: chunkGemId },
        select: { model: true, status: true },
      });
      assert.equal(stored.status, "completed");
      assert.equal(stored.model, "text-embedding-004");
    } finally {
      globalThis.fetch = originalFetch;
      process.env.GEMINI_EMBEDDING_MODEL = "";
      process.env.GEMINI_API_KEY = "";
      process.env.AI_PROVIDER = "openai";
    }
  });
});
