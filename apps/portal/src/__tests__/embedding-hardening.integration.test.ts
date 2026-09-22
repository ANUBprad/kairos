import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ingestText, reprocessDocument } from "@/lib/actions/document";
import {
  generateEmbeddings,
  recoverStaleEmbeddingDocuments,
  STALE_EMBEDDING_MS,
} from "@/lib/ai/embeddings/service";
import { ensureDemoUser } from "@/lib/server/demo-user";
import { PgVectorStore } from "@/lib/vector/store";

const DIM = 1536;

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

function unitVector(dim: number, hotIndex: number): number[] {
  return Array.from({ length: dim }, (_, i) => (i === hotIndex ? 1 : 0));
}

function base64Vector(dim: number, hotIndex: number): string {
  const arr = new Float32Array(dim);
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
  timeoutMs = 20_000,
) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const doc = await client.document.findUnique({
      where: { id: docId },
      select: { status: true, metadata: true },
    });
    if (!doc) throw new Error(`Document ${docId} disappeared`);
    if (doc.status === expected) return doc;
    if (doc.status === "ERROR" && expected !== "ERROR") {
      throw new Error(
        `Document reached ERROR instead of ${expected}: ${JSON.stringify(doc.metadata)}`,
      );
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Timed out waiting for document ${docId} to reach ${expected}`);
}

describe("embedding production hardening against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  let client: PrismaClient | null = null;
  const docIds: string[] = [];
  const kbIds: string[] = [];
  const projectIds: string[] = [];
  const orgIds: string[] = [];

  const stub = { mode: "ok" as "ok" | "fail" | "hang" | "flaky", dim: DIM, failRemaining: 0 };
  let originalFetch: typeof globalThis.fetch | undefined;
  let originalEmbeddingTimeout: string | undefined;

  before(async () => {
    if (!testDbUrl) return;
    process.env.AI_PROVIDER = "openai";
    process.env.OPENAI_API_KEY = "test-dummy-key-do-not-call";
    process.env.GEMINI_API_KEY = "test-dummy-key-do-not-call";
    client = makeTestClient(testDbUrl);
    await client.$connect();
    await ensureDemoUser();

    originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      if (stub.mode === "hang") {
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new Error("The operation was aborted")),
          );
        }) as unknown as Promise<Response>;
      }
      if (stub.mode === "fail" || (stub.mode === "flaky" && stub.failRemaining > 0)) {
        if (stub.mode === "flaky") stub.failRemaining -= 1;
        return new Response("embedding provider unavailable", { status: 500 });
      }
      const url = String(_url);
      if (url.includes("generativelanguage.googleapis.com")) {
        return new Response(
          JSON.stringify({ embedding: { values: unitVector(stub.dim, 0) } }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: base64Vector(stub.dim, 0) }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof globalThis.fetch;
  });

  after(async () => {
    if (originalEmbeddingTimeout !== undefined) {
      process.env.EMBEDDING_TIMEOUT_MS = originalEmbeddingTimeout;
    } else {
      delete process.env.EMBEDDING_TIMEOUT_MS;
    }
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
        name: "Embedding Hardening Org",
        slug: `embed-hardening-${randomUUID()}`,
        ownerId: demoUserId,
        members: { create: [{ userId: demoUserId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Embedding Hardening Project", slug: `embed-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Embedding Hardening KB", projectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(orgId);
    projectIds.push(projectId);
    kbIds.push(kb.id);
    return kb.id;
  }

  async function seedDoc(clientRef: PrismaClient, kbId: string): Promise<{ docId: string; chunkId: string }> {
    const doc = await clientRef.document.create({
      data: {
        name: `seed-${randomUUID()}.txt`,
        fileType: "txt",
        status: "STORED",
        knowledgeBaseId: kbId,
        metadata: { source: "test" },
      },
      select: { id: true },
    });
    docIds.push(doc.id);
    const chunk = await clientRef.documentChunk.create({
      data: {
        documentId: doc.id,
        index: 0,
        content: `seeded content ${randomUUID()}`,
        tokenCount: 3,
      },
      select: { id: true },
    });
    return { docId: doc.id, chunkId: chunk.id };
  }

  it("a successful embed leaves the document INDEXED with searchable embeddings", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "ok";
    stub.dim = DIM;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await ingestText(kbId, { title: "Emb A", content: "short embed body alpha" });
    docIds.push(doc.id);
    const settled = await waitForStatus(client as PrismaClient, doc.id, "INDEXED");
    assert.equal(settled.status, "INDEXED");

    const chunkIds = (
      await (client as PrismaClient).documentChunk.findMany({
        where: { documentId: doc.id },
        select: { id: true },
      })
    ).map((c) => c.id);
    assert.ok(chunkIds.length > 0, "document must have chunks");
    const embedded = await (client as PrismaClient).documentEmbedding.count({
      where: { chunkId: { in: chunkIds } },
    });
    assert.equal(embedded, chunkIds.length);

    const store = new PgVectorStore(client as PrismaClient);
    const results = await store.similaritySearch(unitVector(DIM, 0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.ok(results.some((r) => r.documentId === doc.id), "INDEXED doc must be retrievable");
  });

  it("documents at matching dimensions coexist in a KB and stay retrievable", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "ok";
    stub.dim = DIM;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const docA = await ingestText(kbId, { title: "Emb B1", content: "short embed body bravo" });
    docIds.push(docA.id);
    const docB = await ingestText(kbId, { title: "Emb B2", content: "short embed body charlie" });
    docIds.push(docB.id);
    await waitForStatus(client as PrismaClient, docA.id, "INDEXED");
    await waitForStatus(client as PrismaClient, docB.id, "INDEXED");

    const store = new PgVectorStore(client as PrismaClient);
    const results = await store.similaritySearch(unitVector(DIM, 0), {
      knowledgeBaseIds: [kbId],
      topK: 10,
      minSimilarity: 0,
    });
    const found = new Set(results.map((r) => r.documentId));
    assert.ok(found.has(docA.id), "doc A must be retrievable");
    assert.ok(found.has(docB.id), "doc B must be retrievable");
  });

  it("a model switch producing a new dimension leaves the old doc intact and errors the new doc", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "ok";
    stub.dim = DIM;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const docA = await ingestText(kbId, { title: "Emb C1", content: "short embed body delta" });
    docIds.push(docA.id);
    await waitForStatus(client as PrismaClient, docA.id, "INDEXED");

    stub.dim = DIM * 2;
    const docB = await ingestText(kbId, { title: "Emb C2", content: "short embed body echo" });
    docIds.push(docB.id);
    const rejected = await waitForStatus(client as PrismaClient, docB.id, "ERROR");
    const meta = (rejected.metadata ?? {}) as Record<string, unknown>;
    assert.match(String(meta.error ?? ""), /dimension/i);
    stub.dim = DIM;

    const docARows = await (client as PrismaClient).$queryRaw<
      { dims: number }[]
    >`SELECT vector_dims(e."embedding")::int AS dims FROM "DocumentEmbedding" e JOIN "DocumentChunk" c ON c.id = e."chunkId" WHERE c."documentId" = ${docA.id}`;
    assert.ok(docARows.length > 0);
    assert.ok(docARows.every((r) => r.dims === DIM), "old doc embeddings must keep their dimension");

    const store = new PgVectorStore(client as PrismaClient);
    const results = await store.similaritySearch(unitVector(DIM, 0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.ok(results.some((r) => r.documentId === docA.id), "retrieval must keep working");
    assert.ok(!results.some((r) => r.documentId === docB.id), "rejected doc must not be retrievable");
  });

  it("a provider switch to different dimensions is refused without writing any rows", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "ok";
    stub.dim = DIM;
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const first = await seedDoc(clientRef, kbId);
    await generateEmbeddings(first.docId);

    const docARows = await clientRef.documentEmbedding.count({
      where: { chunkId: first.chunkId },
    });
    assert.equal(docARows, 1);

    const second = await seedDoc(clientRef, kbId);
    stub.dim = 768;
    await assert.rejects(
      () => generateEmbeddings(second.docId, "gemini"),
      /dimension/i,
    );
    stub.dim = DIM;

    const candidateRows = await clientRef.documentEmbedding.count({
      where: { chunkId: second.chunkId },
    });
    assert.equal(candidateRows, 0, "refused doc must write no embedding rows");

    const store = new PgVectorStore(clientRef);
    const results = await store.similaritySearch(unitVector(DIM, 0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.ok(results.some((r) => r.documentId === first.docId), "first doc must stay retrievable");
  });

  it("an embedding provider 500 failure lands the fresh document in ERROR", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "fail";
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await ingestText(kbId, { title: "Emb E", content: "short embed body foxtrot" });
    docIds.push(doc.id);
    const settled = await waitForStatus(client as PrismaClient, doc.id, "ERROR");
    const meta = (settled.metadata ?? {}) as Record<string, unknown>;
    assert.equal(meta.stage, "embed");
    assert.ok(String(meta.error ?? "").length > 0);
  });

  it("a hung provider is bounded by the timeout and lands the document in ERROR", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    originalEmbeddingTimeout = process.env.EMBEDDING_TIMEOUT_MS;
    process.env.EMBEDDING_TIMEOUT_MS = "300";
    stub.mode = "hang";
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await ingestText(kbId, { title: "Emb F", content: "short embed body golf" });
    docIds.push(doc.id);
    const settled = await waitForStatus(client as PrismaClient, doc.id, "ERROR");
    const meta = (settled.metadata ?? {}) as Record<string, unknown>;
    assert.equal(meta.stage, "embed");
    assert.match(String(meta.error ?? ""), /timed out/i);
  });

  it("a transient provider failure is retried and the document still indexes", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "flaky";
    stub.failRemaining = 1;
    stub.dim = DIM;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await ingestText(kbId, { title: "Emb G", content: "short embed body hotel" });
    docIds.push(doc.id);
    const settled = await waitForStatus(client as PrismaClient, doc.id, "INDEXED");
    assert.equal(settled.status, "INDEXED");
  });

  it("a document errored by an embed failure can be reprocessed back to INDEXED", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "fail";
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await ingestText(kbId, { title: "Emb H", content: "short embed body india" });
    docIds.push(doc.id);
    await waitForStatus(client as PrismaClient, doc.id, "ERROR");

    stub.mode = "ok";
    stub.dim = DIM;
    await reprocessDocument(reprocessFormData(doc.id));
    const settled = await waitForStatus(client as PrismaClient, doc.id, "INDEXED");
    assert.equal(settled.status, "INDEXED");
  });

  it("stale EMBEDDING and EMBEDDING_PENDING documents recover to ERROR idempotently", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "ok";
    stub.dim = DIM;
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const staleEmbed = await clientRef.document.create({
      data: {
        name: `stale-embed-${randomUUID()}.txt`,
        fileType: "txt",
        status: "EMBEDDING",
        knowledgeBaseId: kbId,
        updatedAt: new Date(Date.now() - 40 * 60 * 1000),
      },
      select: { id: true },
    });
    docIds.push(staleEmbed.id);
    const stalePending = await clientRef.document.create({
      data: {
        name: `stale-pending-${randomUUID()}.txt`,
        fileType: "txt",
        status: "EMBEDDING_PENDING",
        knowledgeBaseId: kbId,
        updatedAt: new Date(Date.now() - 40 * 60 * 1000),
      },
      select: { id: true },
    });
    docIds.push(stalePending.id);
    const fresh = await clientRef.document.create({
      data: {
        name: `fresh-${randomUUID()}.txt`,
        fileType: "txt",
        status: "EMBEDDING",
        knowledgeBaseId: kbId,
      },
      select: { id: true },
    });
    docIds.push(fresh.id);

    const cutoff = new Date(Date.now() - STALE_EMBEDDING_MS);
    const first = await recoverStaleEmbeddingDocuments(kbId, cutoff);
    assert.equal(first, 2, "both stale rows must recover");
    const second = await recoverStaleEmbeddingDocuments(kbId, cutoff);
    assert.equal(second, 0, "recovery must be idempotent");

    const [staleEmbedRow, stalePendingRow, freshRow] = await Promise.all([
      clientRef.document.findUnique({ where: { id: staleEmbed.id }, select: { status: true } }),
      clientRef.document.findUnique({ where: { id: stalePending.id }, select: { status: true } }),
      clientRef.document.findUnique({ where: { id: fresh.id }, select: { status: true } }),
    ]);
    assert.equal(staleEmbedRow?.status, "ERROR");
    assert.equal(stalePendingRow?.status, "ERROR");
    assert.equal(freshRow?.status, "EMBEDDING", "a live (fresh) row must never be recovered");
  });

  it("an embed run heals a stale sibling stranded in the same knowledge base", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    stub.mode = "ok";
    stub.dim = DIM;
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const stranded = await clientRef.document.create({
      data: {
        name: `stranded-${randomUUID()}.txt`,
        fileType: "txt",
        status: "EMBEDDING",
        knowledgeBaseId: kbId,
        updatedAt: new Date(Date.now() - 40 * 60 * 1000),
      },
      select: { id: true },
    });
    docIds.push(stranded.id);

    const live = await seedDoc(clientRef, kbId);
    await generateEmbeddings(live.docId);

    const after = await clientRef.document.findUnique({
      where: { id: stranded.id },
      select: { status: true },
    });
    assert.equal(after?.status, "ERROR", "stranded sibling must settle into ERROR");
  });
});