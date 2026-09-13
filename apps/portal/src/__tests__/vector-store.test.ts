import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { PgVectorStore } from "@/lib/vector/store";
import { validateEmbeddingResponse } from "@/lib/ai/embeddings/service";
import { BM25 } from "@/lib/retrieval/strategies";

const CHUNK_A = "brkyexy2gcn9it6fb99f0wj0";
const CHUNK_B = "brkyexy2gcn9it6fb99f0wj1";

describe("validateEmbeddingResponse", () => {
  it("returns the dimension for a well-formed response", () => {
    assert.equal(validateEmbeddingResponse([[1, 0, 0], [0, 1, 0]], 2), 3);
  });
  it("rejects a response with too few vectors", () => {
    assert.throws(
      () => validateEmbeddingResponse([[1, 0, 0]], 2),
      /returned 1 vectors for 2 chunks/,
    );
  });
  it("rejects empty vectors", () => {
    assert.throws(
      () => validateEmbeddingResponse([[], [], []], 3),
      /empty or inconsistent vector dimensions/,
    );
  });
  it("rejects vectors of mixed dimensions", () => {
    assert.throws(
      () => validateEmbeddingResponse([[1, 0, 0], [1, 0]], 2),
      /empty or inconsistent vector dimensions/,
    );
  });
});

function captureStoreClient() {
  const captured: { sql: string; params: unknown[] }[] = [];
  const fake = {
    $executeRawUnsafe: (sql: string, ...params: unknown[]) => {
      captured.push({ sql, params });
      return Promise.resolve(1);
    },
    $queryRawUnsafe: (sql: string, ...params: unknown[]) => {
      captured.push({ sql, params });
      return Promise.resolve([]);
    },
  } as unknown as PrismaClient;
  return { client: fake, captured };
}

describe("PgVectorStore.bulkUpsertEmbeddings", () => {
  it("inserts embeddings for chunks that have no existing row", async () => {
    const { client, captured } = captureStoreClient();
    const store = new PgVectorStore(client);

    await store.bulkUpsertEmbeddings(
      [
        { chunkId: CHUNK_A, embedding: [1, 0, 0] },
        { chunkId: CHUNK_B, embedding: [0, 1, 0] },
      ],
      3,
    );

    assert.equal(captured.length, 2);
    for (const stmt of captured) {
      assert.match(stmt.sql, /^INSERT INTO "DocumentEmbedding"/);
      assert.match(stmt.sql, /ON CONFLICT \("chunkId"\)/);
    }
    assert.deepEqual(captured[0].params, [CHUNK_A, "[1,0,0]"]);
    assert.deepEqual(captured[1].params, [CHUNK_B, "[0,1,0]"]);
  });

  it("re-writes the embedding on an existing row, not silently skipping it", async () => {
    const { client, captured } = captureStoreClient();
    const store = new PgVectorStore(client);

    await store.bulkUpsertEmbeddings([{ chunkId: CHUNK_A, embedding: [1, 0, 0] }], 3);
    await store.bulkUpsertEmbeddings([{ chunkId: CHUNK_A, embedding: [0, 0, 1] }], 3);

    assert.equal(captured.length, 2);
    assert.match(captured[1].sql, /DO UPDATE SET "embedding" = EXCLUDED."embedding"/);
  });
});

describe("PgVectorStore.similaritySearch contract", () => {
  it("queries DocumentEmbedding joined to chunks and documents, filtered to INDEXED", async () => {
    const { client, captured } = captureStoreClient();
    const store = new PgVectorStore(client);

    const results = await store.similaritySearch([1, 0, 0], {
      knowledgeBaseIds: ["kb_cuid_a"],
      documentIds: ["doc_cuid_a"],
      topK: 5,
      minSimilarity: 0.7,
    });

    assert.deepEqual(results, []);
    assert.equal(captured.length, 1);
    assert.match(captured[0].sql, /FROM "DocumentEmbedding" e/);
    assert.match(captured[0].sql, /JOIN "DocumentChunk" c ON c.id = e."chunkId"/);
    assert.match(captured[0].sql, /e.embedding IS NOT NULL/);
    assert.match(captured[0].sql, /d.status = 'INDEXED'/);
    assert.match(captured[0].sql, /knowledgeBaseId" IN/);
  });
});

describe("BM25 keyword fallback", () => {
  it("still ranks keyword matches without any embeddings", () => {
    const bm25 = new BM25();
    bm25.build(["kairos vector embeddings", "unrelated gardening article"]);
    const results = bm25.search("japan vector embeddings", 3);

    assert.equal(results.length, 1);
    assert.equal(results[0].index, 0);
    assert.equal(results[0].score > 0, true);
  });
});