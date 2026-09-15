import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  ingestText,
  updateTextSource,
  getEditableTextSourceContent,
} from "@/lib/actions/document";
import { ensureDemoUser } from "@/lib/server/demo-user";
import { PgVectorStore } from "@/lib/vector/store";
import { textDocumentFileHash, MAX_TEXT_CHARS } from "@/lib/ingestion/text";

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

describe("text source editing against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  let client: PrismaClient | null = null;
  let originalFetch: typeof globalThis.fetch | undefined;
  let embeddingFail = false;
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
        name: "Edit Org",
        slug: `edit-org-${randomUUID()}`,
        ownerId: demoUserId,
        members: { create: [{ userId: demoUserId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Edit Project", slug: `edit-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Edit KB", projectId, retrievalConfig: {} },
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
      data: { id: ownerId, email: `edit-foreign-${randomUUID()}@test.local`, name: "Foreign" },
    });
    await clientRef.organization.create({
      data: {
        id: orgId,
        name: "Foreign Org",
        slug: `edit-foreign-org-${randomUUID()}`,
        ownerId,
        members: { create: [{ userId: ownerId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Foreign Project", slug: `edit-foreign-proj-${randomUUID()}`, organizationId: orgId },
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

  it("editing a TEXT source swaps in the new content and retrieval returns it", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await ingestText(kbId, { title: "Draft title", content: "Old body that gets replaced." });
    docIds.push(doc.id);
    await waitForStatus(clientRef, doc.id, "INDEXED");

    const beforeChunks = await clientRef.documentChunk.findMany({
      where: { documentId: doc.id },
      select: { id: true, content: true },
    });
    assert.equal(beforeChunks.length, 1);

    await updateTextSource(doc.id, { title: "Final title", content: "Brand new edited body for retrieval." });
    const settled = await waitForStatus(clientRef, doc.id, "INDEXED");
    assert.equal(settled.status, "INDEXED");

    const row = await clientRef.document.findUnique({
      where: { id: doc.id },
      select: { name: true, status: true, fileHash: true, metadata: true },
    });
    assert.equal(row?.name, "Final title");
    assert.equal(
      row?.fileHash,
      textDocumentFileHash("Final title", "Brand new edited body for retrieval."),
    );
    assert.equal((row?.metadata as Record<string, unknown>)?.title, "Final title");

    const afterChunks = await clientRef.documentChunk.findMany({
      where: { documentId: doc.id },
      orderBy: { index: "asc" },
      select: { id: true, content: true },
    });
    assert.equal(afterChunks.length, 1);
    assert.equal(afterChunks[0].content, "Brand new edited body for retrieval.");
    // The old chunk instance is gone entirely.
    assert.equal(afterChunks.some((c) => c.id === beforeChunks[0].id), false);

    const store = new PgVectorStore(clientRef);
    const retrieved = await store.similaritySearch(unitVector(0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].chunkId, afterChunks[0].id);

    const editable = await getEditableTextSourceContent(doc.id);
    assert.equal(editable.title, "Final title");
    assert.equal(editable.content, "Brand new edited body for retrieval.");

    const activities = await clientRef.documentActivity.findMany({
      where: { documentId: doc.id },
      select: { action: true },
    });
    assert.ok(activities.map((a) => a.action).includes("UPDATED"));
  });

  it("a failed TEXT update rolls the source back to its full last known-good state", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const originalTitle = "Stable title";
    const originalContent = "This body must survive a failed edit.";
    const doc = await ingestText(kbId, { title: originalTitle, content: originalContent });
    docIds.push(doc.id);
    await waitForStatus(clientRef, doc.id, "INDEXED");

    const beforeChunks = await clientRef.documentChunk.findMany({
      where: { documentId: doc.id },
      select: { id: true, content: true },
    });

    try {
      embeddingFail = true;
      await updateTextSource(doc.id, { title: "Doomed title", content: "This body should never win." });

      const settled = await waitForStatus(clientRef, doc.id, "INDEXED");
      assert.equal(settled.status, "INDEXED");
      const meta = (settled.metadata ?? {}) as Record<string, unknown>;
      assert.equal(meta.retainedPreviousContent, true);
      assert.equal(meta.title, originalTitle);

      // Full identity + content revert: name, hash, metadata, chunks all original.
      const row = await clientRef.document.findUnique({
        where: { id: doc.id },
        select: { name: true, status: true, fileHash: true, metadata: true },
      });
      assert.equal(row?.name, originalTitle);
      assert.equal(row?.fileHash, textDocumentFileHash(originalTitle, originalContent));

      const afterChunks = await clientRef.documentChunk.findMany({
        where: { documentId: doc.id },
        orderBy: { index: "asc" },
        select: { id: true, content: true },
      });
      assert.deepEqual(afterChunks.map((c) => c.content), beforeChunks.map((c) => c.content));

      // Retrieval keeps serving the previous good content only.
      const store = new PgVectorStore(clientRef);
      const retrieved = await store.similaritySearch(unitVector(0), {
        knowledgeBaseIds: [kbId],
        topK: 5,
        minSimilarity: 0,
      });
      assert.equal(retrieved.length, 1);
      assert.ok(beforeChunks.some((c) => c.id === retrieved[0].chunkId));

      const editable = await getEditableTextSourceContent(doc.id);
      assert.equal(editable.title, originalTitle);
      assert.equal(editable.content, originalContent);

      const activities = await clientRef.documentActivity.findMany({
        where: { documentId: doc.id },
        select: { action: true },
      });
      const actions = activities.map((a) => a.action);
      assert.ok(actions.includes("PROCESS_FAILED"), `actions: ${actions.join(", ")}`);
      assert.ok(actions.includes("UPDATED"), `actions: ${actions.join(", ")}`);
    } finally {
      embeddingFail = false;
    }
  });

  it("rejects empty, whitespace-only, oversized, and identical edits without touching the source", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const title = "Guardrails";
    const content = "Guarded body.";
    const doc = await ingestText(kbId, { title, content });
    docIds.push(doc.id);
    await waitForStatus(clientRef, doc.id, "INDEXED");

    await assert.rejects(
      updateTextSource(doc.id, { title: "Empty", content: "   \n\t  " }),
      /cannot be empty/,
    );
    await assert.rejects(
      updateTextSource(doc.id, { title: "Large", content: "a".repeat(MAX_TEXT_CHARS + 1) }),
      /too large/,
    );
    await assert.rejects(
      updateTextSource(doc.id, { title, content }),
      /No changes to save/,
    );

    const row = await clientRef.document.findUnique({
      where: { id: doc.id },
      select: { name: true, status: true, fileHash: true },
    });
    assert.equal(row?.name, title);
    assert.equal(row?.status, "INDEXED");
    assert.equal(row?.fileHash, textDocumentFileHash(title, content));
  });

  it("rejects an edit that duplicates another source in the knowledge base", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const a = await ingestText(kbId, { title: "First", content: "Unique body one." });
    const b = await ingestText(kbId, { title: "Second", content: "Unique body two." });
    docIds.push(a.id, b.id);
    await waitForStatus(clientRef, a.id, "INDEXED");
    await waitForStatus(clientRef, b.id, "INDEXED");

    await assert.rejects(
      updateTextSource(a.id, { title: "Second", content: "Unique body two." }),
      /This text is a duplicate of "Second" \(same content\)/,
    );

    const rowA = await clientRef.document.findUnique({
      where: { id: a.id },
      select: { name: true, status: true, fileHash: true },
    });
    assert.equal(rowA?.name, "First");
    assert.equal(rowA?.status, "INDEXED");
    assert.equal(rowA?.fileHash, textDocumentFileHash("First", "Unique body one."));
  });

  it("refuses to edit a non-TEXT source", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);

    const doc = await clientRef.document.create({
      data: {
        name: "Plain URL doc",
        fileType: "txt",
        sourceType: "URL",
        sourceUrl: "https://example.com/x",
        knowledgeBaseId: kbId,
        status: "INDEXED",
        metadata: { source: "url", title: "Plain URL doc" },
      },
      select: { id: true },
    });
    docIds.push(doc.id);

    await assert.rejects(
      updateTextSource(doc.id, { title: "Sneak", content: "not really a text edit" }),
      /Only text sources can be edited/,
    );
    await assert.rejects(
      getEditableTextSourceContent(doc.id),
      /Only text sources can be edited/,
    );
  });

  it("refuses to edit a source in a knowledge base the user cannot access", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const foreignKbId = await makeForeignKb();

    const doc = await clientRef.document.create({
      data: {
        name: "Foreign text",
        fileType: "txt",
        sourceType: "TEXT",
        knowledgeBaseId: foreignKbId,
        status: "INDEXED",
        metadata: { source: "text", title: "Foreign text" },
      },
      select: { id: true },
    });
    docIds.push(doc.id);

    await assert.rejects(
      updateTextSource(doc.id, { title: "Nope", content: "sneaky edit" }),
      /Knowledge base not found/,
    );
  });
});