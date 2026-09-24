import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { KeywordStrategy, clearKeywordIndexCache } from "@/lib/retrieval/strategies/keyword";
import { revalidateSourcePage } from "@/lib/revalidation";

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("keyword BM25 cache invalidation against a real database", () => {
  const testDbUrl = process.env.KAIROS_TEST_DATABASE_URL;
  const chunkIds: string[] = [];
  const documentIds: string[] = [];
  const kbIds: string[] = [];
  const projectId = randomUUID();
  const organizationId = randomUUID();
  const userId = randomUUID();

  after(async () => {
    if (!testDbUrl) return;
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();
      await client.documentChunk.deleteMany({ where: { id: { in: chunkIds } } });
      await client.document.deleteMany({ where: { id: { in: documentIds } } });
      await client.knowledgeBase.deleteMany({ where: { id: { in: kbIds } } });
      await client.project.delete({ where: { id: projectId } }).catch(() => {});
      await client.organization.delete({ where: { id: organizationId } }).catch(() => {});
      await client.user.delete({ where: { id: userId } }).catch(() => {});
    } finally {
      await client.$disconnect();
    }
  });

  it("purges a stale BM25 index when the KB corpus changes", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      const table = await client.$queryRaw<
        { t: string | null }[]
      >`SELECT to_regclass('public."DocumentChunk"')::text AS t`;
      if (table[0]?.t === null) {
        t.skip("schema not provisioned — run `npx prisma db push` against the test database");
        return;
      }

      const user = await client.user.create({
        data: { id: userId, email: `keyword-cache-${randomUUID()}@test.local`, name: "Keyword Cache Test" },
        select: { id: true },
      });
      await client.organization.create({
        data: { id: organizationId, name: "Keyword Cache Org", slug: `keyword-cache-${randomUUID()}`, ownerId: user.id },
      });
      await client.project.create({
        data: { id: projectId, name: "Keyword Cache Project", slug: `keyword-cache-proj-${randomUUID()}`, organizationId },
      });
      const kb = await client.knowledgeBase.create({
        data: { id: randomUUID(), name: "Keyword Cache KB", projectId, retrievalConfig: {} },
        select: { id: true },
      });
      kbIds.push(kb.id);

      const doc = await client.document.create({
        data: {
          id: randomUUID(),
          name: "corpus.txt",
          fileType: "txt",
          status: "INDEXED",
          knowledgeBaseId: kb.id,
        },
        select: { id: true },
      });
      documentIds.push(doc.id);

      const chunk = await client.documentChunk.create({
        data: {
          id: randomUUID(),
          documentId: doc.id,
          index: 0,
          content: "quokkas hop beneath zebra sails",
          tokenCount: 6,
        },
        select: { id: true },
      });
      chunkIds.push(chunk.id);

      const strategy = new KeywordStrategy();
      const ctx = {
        kbId: kb.id,
        query: "zebra",
        topK: 5,
        minSimilarity: 0,
        embeddingModel: "text-embedding-3-small",
        embeddingProvider: "openai" as const,
      };

      clearKeywordIndexCache();

      const warm = await strategy.retrieve(ctx);
      assert.ok(warm.chunks.length >= 1, "first retrieval indexes the corpus");

      await client.document.update({ where: { id: doc.id }, data: { status: "QUEUED" } });

      const stale = await strategy.retrieve(ctx);
      assert.ok(stale.chunks.length >= 1, "cache is warm and would serve stale results without invalidation");

      revalidateSourcePage(kb.id);

      const fresh = await strategy.retrieve(ctx);
      assert.equal(
        fresh.chunks.length,
        0,
        "revalidateSourcePage must invalidate the KB BM25 index so the corpus is rebuilt from current state",
      );
    } finally {
      await client.$disconnect();
    }
  });
});