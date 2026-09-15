import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { repointUrlSource } from "@/lib/actions/document";
import { ensureDemoUser } from "@/lib/server/demo-user";
import { PgVectorStore } from "@/lib/vector/store";
import { generateEmbeddings } from "@/lib/ai/embeddings";
import {
  fetchArticle,
  urlDocumentFileHash,
  extractArticle,
  type HttpGetResult,
  type ResolveHostFn,
} from "@/lib/ingestion/url";

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

function htmlResponse(body: string, status = 200, contentType = "text/html; charset=utf-8"): HttpGetResult {
  const encoder = new TextEncoder();
  return {
    status,
    headers: {
      get: (name) => (name.toLowerCase() === "content-type" ? contentType : null),
    },
    body: new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode(body));
        controller.close();
      },
    }),
  };
}

const STUB_DNS: ResolveHostFn = async (host) => {
  const map: Record<string, string[]> = {
    "example.com": ["93.184.216.34"],
    "other.example": ["93.184.216.35"],
  };
  const addrs = map[host];
  if (!addrs) throw new Error(`no such host: ${host}`);
  return addrs;
};

const OLD_ARTICLE_HTML = `<!DOCTYPE html>
<html><head><title>Original article</title></head>
<body>
<p>This is the original article body that should be evicted on repoint.</p>
</body></html>`;

const NEW_ARTICLE_HTML = `<!DOCTYPE html>
<html><head><title>Updated article</title></head>
<body>
<p>This is the new article body that should replace the original.</p>
</body></html>`;

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

async function makeStubHttpGet(handlers: {
  [url: string]: () => HttpGetResult;
}): Promise<(url: string, init?: RequestInit) => Promise<HttpGetResult>> {
  return async (url) => {
    const handler = handlers[url];
    if (!handler) throw new Error(`No stub for ${url}`);
    return handler();
  };
}

describe("URL source repointing against a real database", () => {
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
        name: "Repoint Org",
        slug: `repoint-org-${randomUUID()}`,
        ownerId: demoUserId,
        members: { create: [{ userId: demoUserId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Repoint Project", slug: `repoint-proj-${randomUUID()}`, organizationId: orgId },
    });
    const kb = await clientRef.knowledgeBase.create({
      data: { name: "Repoint KB", projectId, retrievalConfig: {} },
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
      data: { id: ownerId, email: `repoint-foreign-${randomUUID()}@test.local`, name: "Foreign" },
    });
    await clientRef.organization.create({
      data: {
        id: orgId,
        name: "Foreign Org",
        slug: `repoint-foreign-org-${randomUUID()}`,
        ownerId,
        members: { create: [{ userId: ownerId, role: "OWNER" }] },
      },
    });
    await clientRef.project.create({
      data: { id: projectId, name: "Foreign Project", slug: `repoint-foreign-proj-${randomUUID()}`, organizationId: orgId },
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

  async function createUrlSource(kbId: string, url: string, html: string): Promise<string> {
    const clientRef = client as PrismaClient;
    const original = await clientRef.document.create({
      data: {
        name: "URL source",
        fileType: "txt",
        sourceType: "URL",
        sourceUrl: url,
        fileHash: urlDocumentFileHash("placeholder"),
        size: 0,
        status: "INDEXED",
        knowledgeBaseId: kbId,
        uploadedById: await ensureDemoUser(),
        metadata: { mimeType: "text/markdown", source: "url", title: "URL source" },
      },
      select: { id: true },
    });
    const { markdown } = await fetchArticle(url, { resolveHost: STUB_DNS, httpGet: () => Promise.resolve(htmlResponse(html)) });
    const docId = original.id;
    docIds.push(docId);
    await clientRef.document.update({
      where: { id: docId },
      data: {
        name: "URL source",
        sourceUrl: url,
        fileHash: urlDocumentFileHash(markdown),
        size: Buffer.byteLength(markdown),
      },
    });
    await clientRef.documentChunk.create({
      data: { documentId: docId, content: markdown, index: 0, tokenCount: 10 },
    });
    await generateEmbeddings(docId);
    return docId;
  }

  it("repoints a URL source to a new address and retrieval swaps in the new content", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);
    const docId = await createUrlSource(kbId, "https://example.com/original", OLD_ARTICLE_HTML);

    const beforeChunks = await clientRef.documentChunk.findMany({
      where: { documentId: docId },
      select: { id: true, content: true },
    });

    const httpGet = await makeStubHttpGet({
      "https://example.com/new": () => htmlResponse(NEW_ARTICLE_HTML),
    });
    await repointUrlSource(docId, "https://example.com/new", {
      resolveHost: STUB_DNS,
      httpGet,
    });
    const settled = await waitForStatus(clientRef, docId, "INDEXED");
    assert.equal(settled.status, "INDEXED");

    const row = await clientRef.document.findUnique({
      where: { id: docId },
      select: { sourceUrl: true, name: true, fileHash: true, metadata: true },
    });
    assert.equal(row?.sourceUrl, "https://example.com/new");
    assert.equal(row?.name, "Updated article");
    const { markdown: newMarkdown } = await fetchArticle("https://example.com/new", {
      resolveHost: STUB_DNS,
      httpGet,
    });
    assert.equal(row?.fileHash, urlDocumentFileHash(newMarkdown));

    const afterChunks = await clientRef.documentChunk.findMany({
      where: { documentId: docId },
      select: { id: true, content: true },
    });
    assert.equal(afterChunks.length, 1);
    assert.equal(afterChunks[0].content, newMarkdown);
    assert.equal(afterChunks.some((c) => c.id === beforeChunks[0].id), false);

    const store = new PgVectorStore(clientRef);
    const retrieved = await store.similaritySearch(unitVector(0), {
      knowledgeBaseIds: [kbId],
      topK: 5,
      minSimilarity: 0,
    });
    assert.equal(retrieved.length, 1);
    assert.equal(retrieved[0].chunkId, afterChunks[0].id);

    const activities = await clientRef.documentActivity.findMany({
      where: { documentId: docId },
      select: { action: true, details: true },
    });
    const updated = activities.find((a) => a.action === "UPDATED");
    assert.ok(updated, "UPDATED activity should exist");
    const details = (updated!.details ?? {}) as Record<string, unknown>;
    assert.equal(details.fromUrl, "https://example.com/original");
    assert.equal(details.toUrl, "https://example.com/new");
  });

  it("rolls back to the full last known-good state on embedding failure", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);
    const docId = await createUrlSource(kbId, "https://example.com/original", OLD_ARTICLE_HTML);

    const { markdown: oldMarkdown } = await fetchArticle("https://example.com/original", {
      resolveHost: STUB_DNS,
      httpGet: () => Promise.resolve(htmlResponse(OLD_ARTICLE_HTML)),
    });
    const beforeChunks = await clientRef.documentChunk.findMany({
      where: { documentId: docId },
      select: { id: true, content: true },
    });

    const httpGet = await makeStubHttpGet({
      "https://example.com/new": () => htmlResponse(NEW_ARTICLE_HTML),
    });

    try {
      embeddingFail = true;
      await repointUrlSource(docId, "https://example.com/new", {
        resolveHost: STUB_DNS,
        httpGet,
      });
      const settled = await waitForStatus(clientRef, docId, "INDEXED");
      assert.equal(settled.status, "INDEXED");
      const meta = (settled.metadata ?? {}) as Record<string, unknown>;
      assert.equal(meta.retainedPreviousContent, true);

      // Full identity + content revert
      const row = await clientRef.document.findUnique({
        where: { id: docId },
        select: { sourceUrl: true, name: true, fileHash: true, metadata: true },
      });
      assert.equal(row?.sourceUrl, "https://example.com/original");
      assert.equal(row?.name, "URL source");
      assert.equal(row?.fileHash, urlDocumentFileHash(oldMarkdown));

      const afterChunks = await clientRef.documentChunk.findMany({
        where: { documentId: docId },
        orderBy: { index: "asc" },
        select: { id: true, content: true },
      });
      assert.deepEqual(afterChunks.map((c) => c.content), beforeChunks.map((c) => c.content));

      const store = new PgVectorStore(clientRef);
      const retrieved = await store.similaritySearch(unitVector(0), {
        knowledgeBaseIds: [kbId],
        topK: 5,
        minSimilarity: 0,
      });
      assert.equal(retrieved.length, 1);
      assert.ok(beforeChunks.some((c) => c.id === retrieved[0].chunkId));
    } finally {
      embeddingFail = false;
    }
  });

  it("rejects fetch failures, same URL, duplicate content, non-URL sources, busy sources, and foreign access", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const clientRef = client as PrismaClient;
    const demoUser = await ensureDemoUser();
    const kbId = await makeKbForDemo(demoUser);
    const docId = await createUrlSource(kbId, "https://example.com/original", OLD_ARTICLE_HTML);
    const foreignKbId = await makeForeignKb();

    // Non-URL source
    const textDoc = await clientRef.document.create({
      data: {
        name: "Text doc",
        fileType: "txt",
        sourceType: "TEXT",
        knowledgeBaseId: kbId,
        status: "INDEXED",
        metadata: { source: "text", title: "Text doc" },
      },
      select: { id: true },
    });
    docIds.push(textDoc.id);
    await assert.rejects(
      repointUrlSource(textDoc.id, "https://example.com/new"),
      /Only URL sources can be repointed/,
    );

    // Same URL
    const sameHttpGet = await makeStubHttpGet({
      "https://example.com/original": () => htmlResponse(OLD_ARTICLE_HTML),
    });
    await assert.rejects(
      repointUrlSource(docId, "https://example.com/original", {
        resolveHost: STUB_DNS,
        httpGet: sameHttpGet,
      }),
      /already points to that URL/,
    );

    // Fetch failure
    const failHttpGet = async () => { throw new Error("network down"); };
    await assert.rejects(
      repointUrlSource(docId, "https://other.example/new", { resolveHost: STUB_DNS, httpGet: failHttpGet }),
      /Could not fetch that URL/,
    );

    // Duplicate content (same kb + same hash as another doc)
    const { markdown: dupMarkdown } = await fetchArticle("https://example.com/new", {
      resolveHost: STUB_DNS,
      httpGet: () => Promise.resolve(htmlResponse(NEW_ARTICLE_HTML)),
    });
    const dupDoc = await clientRef.document.create({
      data: {
        name: "Existing dup",
        fileType: "txt",
        sourceType: "URL",
        sourceUrl: "https://example.com/existing",
        fileHash: urlDocumentFileHash(dupMarkdown),
        size: Buffer.byteLength(dupMarkdown),
        status: "INDEXED",
        knowledgeBaseId: kbId,
        metadata: { mimeType: "text/markdown", source: "url", title: "Existing dup" },
      },
      select: { id: true },
    });
    docIds.push(dupDoc.id);
    const dupHttpGet = await makeStubHttpGet({
      "https://other.example/new": () => htmlResponse(NEW_ARTICLE_HTML),
    });
    await assert.rejects(
      repointUrlSource(docId, "https://other.example/new", { resolveHost: STUB_DNS, httpGet: dupHttpGet }),
      /This URL is a duplicate of "Existing dup" \(same content\)/,
    );

    // Busy source
    await clientRef.document.update({
      where: { id: docId },
      data: { status: "EMBEDDING" },
    });
    await assert.rejects(
      repointUrlSource(docId, "https://other.example/busy", {
        resolveHost: STUB_DNS,
        httpGet: () => Promise.resolve(htmlResponse('<html><head><title>Busy page</title></head><body><p>This is a longer paragraph that gives the article extractor enough readable prose to work with for the busy-state rejection test.</p></body></html>')),
      }),
      /currently being processed/,
    );
    // Restore status for cleanup
    await clientRef.document.update({
      where: { id: docId },
      data: { status: "INDEXED" },
    });

    // Foreign KB
    const foreignDoc = await clientRef.document.create({
      data: {
        name: "Foreign URL",
        fileType: "txt",
        sourceType: "URL",
        sourceUrl: "https://example.com/foreign",
        knowledgeBaseId: foreignKbId,
        status: "INDEXED",
        metadata: { source: "url", title: "Foreign URL" },
      },
      select: { id: true },
    });
    docIds.push(foreignDoc.id);
    await assert.rejects(
      repointUrlSource(foreignDoc.id, "https://other.example/new"),
      /Knowledge base not found/,
    );
  });
});