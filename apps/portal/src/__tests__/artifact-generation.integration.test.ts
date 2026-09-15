import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mock } from "node:test";
import { PrismaClient } from "@prisma/client";
import { generateLearningArtifactForUser } from "@/lib/artifacts/engine";
import { listLearningArtifacts } from "@/lib/artifacts/persistence";
import { getAIProvider } from "@/lib/ai/providers";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function metadataOf(artifact: { metadata: unknown }): Record<string, unknown> {
  return (artifact.metadata as Record<string, unknown> | null) ?? {};
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

    originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response(
        JSON.stringify({
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
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof globalThis.fetch;

    try {
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
    } finally {
      globalThis.fetch = originalFetch;
    }
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
});
