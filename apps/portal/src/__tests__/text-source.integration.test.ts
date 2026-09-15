import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { ingestText, reprocessDocument } from "@/lib/actions/document";
import { ensureDemoUser } from "@/lib/server/demo-user";
import { searchSimilar } from "@/lib/ai/retrieval";
import { extractCitationsFromChunks } from "@/lib/ai/citations";
import { buildChatPrompt } from "@/lib/ai/prompts";
import { MAX_TEXT_CHARS } from "@/lib/ingestion/text";
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

describe("raw text source ingestion against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  let client: PrismaClient | null = null;
  let originalFetch: typeof globalThis.fetch | undefined;
  const docIds: string[] = [];
  const kbIds: string[] = [];
  const projectIds: string[] = [];
  const orgIds: string[] = [];
  const foreignUserIds: string[] = [];

  before(async () => {
    if (!testDbUrl) return;
    client = makeTestClient(testDbUrl);
    await client.$connect();
    await ensureDemoUser();
    originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify({
          object: "list",
          data: [{ object: "embedding", index: 0, embedding: unitVectorBase64(0) }],
          model: "text-embedding-3-small",
          usage: { prompt_tokens: 4, total_tokens: 4 },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
  });

  after(async () => {
    if (originalFetch) globalThis.fetch = originalFetch;
    if (!client || !testDbUrl) return;
    try {
      await client.document.deleteMany({ where: { id: { in: docIds } } });
      await client.knowledgeBase.deleteMany({ where: { id: { in: kbIds } } });
      await client.project.deleteMany({ where: { id: { in: projectIds } } });
      await client.organization.deleteMany({ where: { id: { in: orgIds } } });
      await client.user.deleteMany({ where: { id: { in: foreignUserIds } } });
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
        name: "Text Org",
        slug: `text-org-${randomUUID()}`,
        ownerId: demoUserId,
        members: { create: [{ userId: demoUserId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Text Project", slug: `text-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Text KB", projectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(orgId);
    projectIds.push(projectId);
    kbIds.push(kb.id);
    return kb.id;
  }

  async function makeForeignKb(): Promise<string> {
    const clientRef = client as PrismaClient;
    const ownerId = randomUUID();
    const orgId = randomUUID();
    const projectId = randomUUID();
    foreignUserIds.push(ownerId);
    await clientRef.user.create({
      data: { id: ownerId, email: `text-foreign-${randomUUID()}@test.local`, name: "Foreign" },
    });
    await clientRef.organization.create({
      data: {
        id: orgId,
        name: "Foreign Org",
        slug: `text-foreign-org-${randomUUID()}`,
        ownerId,
        members: { create: [{ userId: ownerId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Foreign Project", slug: `text-foreign-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Foreign KB", projectId, retrievalConfig: {} },
      select: { id: true },
    });
    orgIds.push(orgId);
    projectIds.push(projectId);
    kbIds.push(kb.id);
    return kb.id;
  }

  it("ingests raw text as a first-class source and reaches INDEXED with persisted embeddings", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();

    const hasVector = await clientRef.$queryRaw<{ extname: string }[]>`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    if (hasVector.length === 0) {
      t.skip("pgvector extension is not installed in the test database");
      return;
    }

    const kbId = await makeKbForDemo(demoUser);
    const title = "Raw note";
    const content = "Kairos lets you paste raw text and ask grounded questions about it.";

    const doc = await ingestText(kbId, { title, content });
    docIds.push(doc.id);

    assert.equal(doc.sourceType, "TEXT");
    assert.equal(doc.status, "STORED");
    assert.equal(doc.sourceUrl, null);
    assert.equal(doc.storageUrl, null);
    assert.equal(doc.storageKey, null);
    assert.equal(doc.name, title);
    const metadata = (doc.metadata ?? {}) as Record<string, unknown>;
    assert.equal(metadata.source, "text");
    assert.equal(metadata.title, title);

    const indexed = await waitForStatus(clientRef, doc.id, "INDEXED");
    assert.equal(indexed.status, "INDEXED");

    const chunks = await clientRef.documentChunk.findMany({
      where: { documentId: doc.id },
      orderBy: { index: "asc" },
    });
    assert.equal(chunks.length, 1);
    assert.equal(chunks[0].content, content);

    const embedded = await clientRef.documentEmbedding.findMany({
      where: { chunkId: { in: chunks.map((c) => c.id) } },
      select: { id: true, model: true, dimensions: true, status: true },
    });
    assert.equal(embedded.length, 1);
    assert.equal(embedded[0].status, "completed");
    assert.equal(embedded[0].dimensions, DIM);

    const dims = await clientRef.$queryRaw<{ dims: number }[]>`
      SELECT vector_dims("embedding")::int AS dims FROM "DocumentEmbedding" WHERE "chunkId" = ${chunks[0].id}
    `;
    assert.equal(dims.length, 1);
    assert.equal(dims[0].dims, DIM);

    const activities = await clientRef.documentActivity.findMany({
      where: { documentId: doc.id },
      select: { action: true },
    });
    const actions = activities.map((a) => a.action).sort();
    assert.ok(actions.includes("UPLOADED"), `actions: ${actions.join(", ")}`);
    assert.ok(actions.includes("PROCESSED"), `actions: ${actions.join(", ")}`);
    assert.ok(actions.includes("EMBEDDED"), `actions: ${actions.join(", ")}`);

    const store = new PgVectorStore(clientRef);
    const retrieved = await store.similaritySearch(unitVector(0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].chunkId, chunks[0].id);
  });

  it("rejects an exact duplicate text source without creating a second document", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const title = "Duplicate note";
    const content = "This exact body is only allowed once in a knowledge base.";
    const doc = await ingestText(kbId, { title, content });
    docIds.push(doc.id);

    await assert.rejects(
      ingestText(kbId, { title, content }),
      /This text is a duplicate of .* \(same content\)/,
    );

    const count = await clientRef.document.count({ where: { knowledgeBaseId: kbId } });
    assert.equal(count, 1);
  });

  it("rejects empty and oversized text without creating any document", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    await assert.rejects(
      ingestText(kbId, { title: "Empty", content: "   \n\t  " }),
      /cannot be empty/,
    );
    await assert.rejects(
      ingestText(kbId, { title: "Large", content: "a".repeat(MAX_TEXT_CHARS + 1) }),
      /too large/,
    );

    const count = await clientRef.document.count({ where: { knowledgeBaseId: kbId } });
    assert.equal(count, 0);
  });

  it("rejects text sources for knowledge bases the user cannot access", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const foreignKbId = await makeForeignKb();

    await assert.rejects(
      ingestText(foreignKbId, { title: "Nope", content: "sneaky content" }),
      /Knowledge base not found/,
    );

    const count = await clientRef.document.count({ where: { knowledgeBaseId: foreignKbId } });
    assert.equal(count, 0);
  });

  it("reprocessing a raw text source preserves its content and embedding", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const title = "Reprocessable note";
    const content = "Draft v1.\n\nDraft v2, the revision that matters.";
    const doc = await ingestText(kbId, { title, content });
    docIds.push(doc.id);

    const indexed = await waitForStatus(clientRef, doc.id, "INDEXED");
    assert.equal(indexed.status, "INDEXED");
    const beforeChunks = await clientRef.documentChunk.findMany({
      where: { documentId: doc.id },
      orderBy: { index: "asc" },
      select: { content: true },
    });
    assert.ok(beforeChunks.length > 0);

    await reprocessDocument(reprocessFormData(doc.id));

    const reprocessed = await waitForStatus(clientRef, doc.id, "INDEXED");
    assert.equal(reprocessed.status, "INDEXED");

    const afterChunks = await clientRef.documentChunk.findMany({
      where: { documentId: doc.id },
      orderBy: { index: "asc" },
      select: { id: true, content: true },
    });
    assert.equal(afterChunks.length, beforeChunks.length);
    assert.equal(beforeChunks.map((c) => c.content).join("\n"),
      afterChunks.map((c) => c.content).join("\n"));

    const embedded = await clientRef.documentEmbedding.findMany({
      where: { chunkId: { in: afterChunks.map((c) => c.id) } },
      select: { status: true, dimensions: true },
    });
    assert.equal(embedded.length, afterChunks.length);
    assert.ok(embedded.every((e) => e.status === "completed"));
    assert.ok(embedded.every((e) => e.dimensions === DIM));

    const activities = await clientRef.documentActivity.findMany({
      where: { documentId: doc.id },
      select: { action: true },
    });
    const actions = activities.map((a) => a.action).sort();
    assert.ok(actions.includes("REPROCESSED"), `actions: ${actions.join(", ")}`);
    assert.ok(actions.filter((a) => a === "PROCESSED").length >= 2,
      `expected at least 2 PROCESSED actions: ${actions.join(", ")}`);

    const store = new PgVectorStore(clientRef);
    const retrieved = await store.similaritySearch(unitVector(0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.equal(retrieved.length, afterChunks.length);
  });

  it("raw text sources are retrieved, cited, and prompted like any other source", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const title = "Chat-ready note";
    const content = "Kairos answers questions with cited sources, plain text included.";
    const doc = await ingestText(kbId, { title, content });
    docIds.push(doc.id);
    await waitForStatus(clientRef, doc.id, "INDEXED");

    const result = await searchSimilar("grounded questions about pasted text", {
      knowledgeBaseIds: [kbId],
    });
    const textChunk = result.chunks.find((c) => c.documentId === doc.id);
    assert.ok(textChunk, `expected the TEXT chunk among ${result.chunks.length} results`);
    assert.equal(textChunk.documentName, title);
    assert.equal(textChunk.pageNumber, null);

    const citations = extractCitationsFromChunks(result.chunks);
    const citation = citations.find((c) => c.documentId === doc.id);
    assert.ok(citation);
    assert.equal(citation.documentName, title);
    assert.equal(citation.pageNumber, null);
    assert.equal(citation.excerpt, content);

    const prompt = buildChatPrompt({
      systemPrompt: "",
      conversationHistory: [],
      retrievedChunks: [textChunk],
      userQuery: "Summarize it",
    });
    const systemContent = prompt.messages[0].content;
    assert.ok(systemContent.includes(`Document: "${title}"`));
    assert.ok(systemContent.includes("Chunk #0"));
    assert.ok(systemContent.includes(content.slice(0, 40)));
  });

  it("reprocess refuses a text source that has no stored content", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await clientRef.document.create({
      data: {
        name: "Empty text",
        fileType: "txt",
        sourceType: "TEXT",
        knowledgeBaseId: kbId,
        status: "ERROR",
        metadata: { source: "text", title: "Empty text" },
      },
      select: { id: true },
    });
    docIds.push(doc.id);

    await assert.rejects(
      reprocessDocument(reprocessFormData(doc.id)),
      /no stored content/,
    );
  });
});
