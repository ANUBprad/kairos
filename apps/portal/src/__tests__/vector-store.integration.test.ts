import { describe, it, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PgVectorStore } from "@/lib/vector/store";

const DIM = 1536;

function unitVector(hotIndex: number): number[] {
  return Array.from({ length: DIM }, (_, i) => (i === hotIndex ? 1 : 0));
}

function makeTestClient(url: string): PrismaClient {
  return new PrismaClient({ datasources: { db: { url } } });
}

describe("vector store against real pgvector", () => {
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
      await client.document.deleteMany({ where: { id: { in: documentIds } } });
      await client.knowledgeBase.deleteMany({ where: { id: { in: kbIds } } });
      await client.project.delete({ where: { id: projectId } }).catch(() => {});
      await client.organization.delete({ where: { id: organizationId } }).catch(() => {});
      await client.user.delete({ where: { id: userId } }).catch(() => {});
    } finally {
      await client.$disconnect();
    }
  });

  it("persists a chunk embedding, records its dimension, and retrieves it", async (t) => {
    if (!testDbUrl) {
      t.skip("KAIROS_TEST_DATABASE_URL is not set (requires Postgres + pgvector)");
      return;
    }
    const client = makeTestClient(testDbUrl);
    try {
      await client.$connect();

      const hasVector = await client.$queryRaw<
        { extname: string }[]
      >`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
      if (hasVector.length === 0) {
        t.skip("pgvector extension is not installed in the test database");
        return;
      }

      const table = await client.$queryRaw<
        { t: string | null }[]
      >`SELECT to_regclass('public."DocumentChunk"')::text AS t`;
      if (table[0]?.t === null) {
        t.skip("schema not provisioned — run `npx prisma db push` against the test database");
        return;
      }

      const user = await client.user.create({
        data: {
          id: userId,
          email: `vector-store-${randomUUID()}@test.local`,
          name: "Vector Store Test",
        },
        select: { id: true },
      });
      await client.organization.create({
        data: { id: organizationId, name: "Vector Test Org", slug: `vector-test-${randomUUID()}`, ownerId: user.id },
      });
      await client.project.create({
        data: { id: projectId, name: "Vector Test Project", slug: `vector-test-proj-${randomUUID()}`, organizationId },
      });

      const kbA = await client.knowledgeBase.create({
        data: { id: randomUUID(), name: "KB A", projectId, retrievalConfig: {} },
        select: { id: true },
      });
      const kbB = await client.knowledgeBase.create({
        data: { id: randomUUID(), name: "KB B", projectId, retrievalConfig: {} },
        select: { id: true },
      });
      kbIds.push(kbA.id, kbB.id);

      const docA = await client.document.create({
        data: { id: randomUUID(), name: "doc-a.txt", fileType: "txt", status: "STORED", knowledgeBaseId: kbA.id },
        select: { id: true },
      });
      const docB = await client.document.create({
        data: { id: randomUUID(), name: "doc-b.txt", fileType: "txt", status: "STORED", knowledgeBaseId: kbB.id },
        select: { id: true },
      });
      documentIds.push(docA.id, docB.id);

      const chunkA = await client.documentChunk.create({
        data: { id: randomUUID(), documentId: docA.id, index: 0, content: "kairos embeddings write path", tokenCount: 5 },
        select: { id: true },
      });
      const chunkB = await client.documentChunk.create({
        data: { id: randomUUID(), documentId: docB.id, index: 0, content: "unrelated gardening content", tokenCount: 5 },
        select: { id: true },
      });
      chunkIds.push(chunkA.id, chunkB.id);

      const store = new PgVectorStore(client);

      // A — every chunk that reached the embedding stage gets a persisted row.
      await store.bulkUpsertEmbeddings(
        [
          { chunkId: chunkA.id, embedding: unitVector(0) },
          { chunkId: chunkB.id, embedding: unitVector(1) },
        ],
        DIM,
      );
      const persisted = await client.documentEmbedding.count({
        where: { chunkId: { in: [chunkA.id, chunkB.id] } },
      });
      assert.equal(persisted, 2);

      // B — the stored vectors have exactly the dimension of the embedding model.
      const dims = await client.$queryRaw<
        { chunkId: string; dims: number }[]
      >`SELECT "chunkId", vector_dims("embedding")::int AS dims FROM "DocumentEmbedding" WHERE "chunkId" IN (${chunkA.id}, ${chunkB.id})`;
      assert.deepEqual(
        dims.map((d) => [d.chunkId, d.dims]).sort(),
        [[chunkA.id, DIM], [chunkB.id, DIM]].sort(),
      );

      // D — a write that the store rejects propagates (no silent success).
      await assert.rejects(
        store.bulkUpsertEmbeddings(
          [{ chunkId: chunkA.id, embedding: Array.from({ length: 20001 }, () => 0) }],
          20001,
        ),
      );

      // C — retrieval sees the persisted embeddings and stays KB-scoped.
      await client.document.updateMany({
        where: { id: { in: [docA.id, docB.id] } },
        data: { status: "INDEXED" },
      });

      const fromA = await store.similaritySearch(unitVector(0), {
        knowledgeBaseIds: [kbA.id],
        topK: 5,
        minSimilarity: 0,
      });
      assert.equal(fromA.length, 1);
      assert.equal(fromA[0].chunkId, chunkA.id);
      assert.equal(fromA[0].similarity, 1);

      const fromB = await store.similaritySearch(unitVector(0), {
        knowledgeBaseIds: [kbB.id],
        topK: 5,
        minSimilarity: 0,
      });
      assert.equal(fromB.length, 1);
      assert.equal(fromB[0].chunkId, chunkB.id);
      assert.equal(fromB[0].similarity, 0);
    } finally {
      await client.$disconnect();
    }
  });
});