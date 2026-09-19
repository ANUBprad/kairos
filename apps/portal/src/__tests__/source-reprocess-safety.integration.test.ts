import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ingestText, reprocessDocument } from "@/lib/actions/document";
import { ensureDemoUser } from "@/lib/server/demo-user";
import { PgVectorStore } from "@/lib/vector/store";

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

function reprocessFormData(id: string): FormData {
  return { get: () => id } as unknown as FormData;
}

async function waitForStatus(
  client: PrismaClient,
  docId: string,
  expected: string,
  timeoutMs = 15_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await client.document.findUnique({
      where: { id: docId },
      select: { status: true, metadata: true },
    });
    if (doc && doc.status === expected) return doc;
    if (doc && doc.status === "ERROR") {
      throw new Error(
        `Document reached ERROR instead of ${expected}: ${JSON.stringify(doc.metadata)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for document ${docId} to reach ${expected}`);
}

describe("source reprocessing failure isolation against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  let client: PrismaClient | null = null;
  let originalFetch: typeof globalThis.fetch | undefined;
  let embeddingFail = false;
  const docIds: string[] = [];
  const kbIds: string[] = [];
  const projectIds: string[] = [];
  const orgIds: string[] = [];

  before(async () => {
    if (!testDbUrl) return;
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";
    client = makeTestClient(testDbUrl);
    await client.$connect();
    await ensureDemoUser();
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      if (embeddingFail) {
        return new Response("embedding provider unavailable", { status: 500 });
      }
      return new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: unitVectorBase64(0) }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    };
  });

  after(async () => {
    if (originalFetch) globalThis.fetch = originalFetch;
    if (!client || !testDbUrl) return;
    try {
      await client.document.deleteMany({ where: { id: { in: docIds } } });
      await client.knowledgeBase.deleteMany({ where: { id: { in: kbIds } } });
      await client.project.deleteMany({ where: { id: { in: projectIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
    } finally {
      await client.$disconnect();
    }
  });

  async function makeKbForDemo(demoUserId: string): Promise<string> {
    const clientRef = client as PrismaClient;
    const orgId = randomUUID();
    const projectId = randomUUID();
    await clientRef.organization.create({
      data: {
        id: orgId,
        name: "Reprocess Org",
        slug: `reprocess-org-${randomUUID()}`,
        ownerId: demoUserId,
        members: { create: [{ userId: demoUserId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Reprocess Project", slug: `reprocess-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Reprocess KB", projectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(orgId);
    projectIds.push(projectId);
    kbIds.push(kb.id);
    return kb.id;
  }

  it("a failed TEXT reprocess restores the previous known-good content to INDEXED", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const title = "Preserve me";
    const content = "This is the last known-good body that must survive a failed update.";
    const doc = await ingestText(kbId, { title, content });
    docIds.push(doc.id);
    await waitForStatus(clientRef, doc.id, "INDEXED");

    const beforeChunks = await clientRef.documentChunk.findMany({
      where: { documentId: doc.id },
      orderBy: { index: "asc" },
      select: { id: true, content: true },
    });
    assert.ok(beforeChunks.length > 0);
    const beforeEmbedded = await clientRef.documentEmbedding.count({
      where: { chunkId: { in: beforeChunks.map((c) => c.id) } },
    });
    assert.equal(beforeEmbedded, beforeChunks.length);

    try {
      embeddingFail = true;
      await reprocessDocument(reprocessFormData(doc.id));

      const settled = await waitForStatus(clientRef, doc.id, "INDEXED");
      assert.equal(settled.status, "INDEXED");
      const meta = (settled.metadata ?? {}) as Record<string, unknown>;
      assert.equal(meta.retainedPreviousContent, true);
      assert.ok(typeof meta.lastProcessError === "string");

      // The candidate version is gone; the previous good chunks are all that remain.
      const afterChunks = await clientRef.documentChunk.findMany({
        where: { documentId: doc.id },
        orderBy: { index: "asc" },
        select: { id: true, content: true },
      });
      assert.equal(afterChunks.length, beforeChunks.length);
      assert.deepEqual(
        afterChunks.map((c) => c.content),
        beforeChunks.map((c) => c.content),
      );

      const embedded = await clientRef.documentEmbedding.count({
        where: { chunkId: { in: afterChunks.map((c) => c.id) } },
      });
      assert.equal(embedded, afterChunks.length);

      const activities = await clientRef.documentActivity.findMany({
        where: { documentId: doc.id },
        select: { action: true },
      });
      const actions = activities.map((a) => a.action);
      assert.ok(actions.includes("PROCESS_FAILED"), `actions: ${actions.join(", ")}`);
      assert.equal(actions.filter((a) => a === "EMBEDDED").length, 1);

      // Retrieval still hands out the previous good content only.
      const store = new PgVectorStore(clientRef);
      const retrieved = await store.similaritySearch(unitVector(0), {
        knowledgeBaseIds: [kbId],
        topK: 5,
        minSimilarity: 0,
      });
      const retrievedIds = new Set(retrieved.map((r) => r.chunkId));
      assert.equal(retrievedIds.size, beforeChunks.length);
      assert.ok(beforeChunks.every((c) => retrievedIds.has(c.id)));
    } finally {
      embeddingFail = false;
    }
  });

  it("a reprocess attempt on a source still mid-processing is refused", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await clientRef.document.create({
      data: {
        name: "In flight URL",
        fileType: "txt",
        sourceType: "URL",
        sourceUrl: "https://example.com/still-fetching",
        knowledgeBaseId: kbId,
        status: "EMBEDDING",
        metadata: { source: "url", title: "In flight URL" },
      },
      select: { id: true },
    });
    docIds.push(doc.id);

    await assert.rejects(
      reprocessDocument(reprocessFormData(doc.id)),
      /currently being processed/,
    );

    const after = await clientRef.document.findUnique({
      where: { id: doc.id },
      select: { status: true },
    });
    assert.equal(after?.status, "EMBEDDING");
  });

  it("a successful TEXT reprocess evicts the old chunks when the new version is indexed", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const title = "Evict me";
    const content = "Draft that gets reprocessed into an identical body.";
    const doc = await ingestText(kbId, { title, content });
    docIds.push(doc.id);
    await waitForStatus(clientRef, doc.id, "INDEXED");

    const beforeIds = (
      await clientRef.documentChunk.findMany({
        where: { documentId: doc.id },
        select: { id: true },
      })
    ).map((c) => c.id);
    assert.equal(beforeIds.length, 1);

    await reprocessDocument(reprocessFormData(doc.id));
    const settled = await waitForStatus(clientRef, doc.id, "INDEXED");
    assert.equal(settled.status, "INDEXED");

    const afterIds = (
      await clientRef.documentChunk.findMany({
        where: { documentId: doc.id },
        select: { id: true },
      })
    ).map((c) => c.id);
    assert.equal(afterIds.length, beforeIds.length);
    // Old chunk instances are gone — only the freshly written candidate remains.
    assert.equal(afterIds.some((id) => beforeIds.includes(id)), false);

    const store = new PgVectorStore(clientRef);
    const retrieved = await store.similaritySearch(unitVector(0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].chunkId, afterIds[0]);
  });
});