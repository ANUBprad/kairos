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

function captureStoreClient(storedDims?: number) {
  const captured: { sql: string; params: unknown[] }[] = [];
  const fake = {
    $executeRawUnsafe: (sql: string, ...params: unknown[]) => {
      captured.push({ sql, params });
      return Promise.resolve(1);
    },
    $queryRawUnsafe: (sql: string, ...params: unknown[]) => {
      captured.push({ sql, params });
      // The dimension probe is the only read that expects rows back.
      if (storedDims === undefined) return Promise.resolve([]);
      if (sql.includes("vector_dims")) return Promise.resolve([{ dims: storedDims }]);
      return Promise.resolve([]);
    },
  } as unknown as PrismaClient;
  return { client: fake, captured };
}

describe("PgVectorStore.bulkUpsertEmbeddings", () => {
  it("upserts a whole batch in one multi-row statement, not N+1 trips", async () => {
    const { client, captured } = captureStoreClient();
    const store = new PgVectorStore(client);

    await store.bulkUpsertEmbeddings(
      [
        { chunkId: CHUNK_A, embedding: [1, 0, 0] },
        { chunkId: CHUNK_B, embedding: [0, 1, 0] },
      ],
      3,
    );

    assert.equal(captured.length, 1);
    assert.match(captured[0].sql, /^INSERT INTO "DocumentEmbedding"/);
    assert.match(captured[0].sql, /VALUES \(gen_random_uuid\(\), \$\d+, \$\d+::vector\), \(gen_random_uuid\(\), \$\d+, \$\d+::vector\)/);
    assert.match(captured[0].sql, /ON CONFLICT \("chunkId"\) DO UPDATE SET "embedding" = EXCLUDED."embedding"/);
    assert.deepEqual(captured[0].params, [CHUNK_A, "[1,0,0]", CHUNK_B, "[0,1,0]"]);
  });

  it("splits oversized batches so a statement never exceeds the parameter ceiling", async () => {
    const { client, captured } = captureStoreClient();
    const store = new PgVectorStore(client);

    await store.bulkUpsertEmbeddings(
      Array.from({ length: 501 }, (_, i) => ({ chunkId: `${CHUNK_A}x${i}`, embedding: [1, 0, 0] })),
      3,
    );

    assert.equal(captured.length, 2);
    assert.equal((captured[1].sql.match(/VALUES/gi) ?? []).length, 1);
  });

  it("is a no-op for an empty batch", async () => {
    const { client, captured } = captureStoreClient();
    const store = new PgVectorStore(client);

    await store.bulkUpsertEmbeddings([], 3);

    assert.equal(captured.length, 0);
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

function store_(
  client: PrismaClient,
  embedding: number[],
  knowledgeBaseIds?: string[],
  documentIds?: string[],
) {
  return new PgVectorStore(client).similaritySearch(embedding, {
    knowledgeBaseIds: knowledgeBaseIds ?? ["kb_cuid_a"],
    documentIds,
    topK: 5,
    minSimilarity: 0.7,
  });
}

describe("PgVectorStore.similaritySearch contract", () => {
  it("queries DocumentEmbedding joined to chunks and documents, filtered to INDEXED", async () => {
    const { client, captured } = captureStoreClient();

    const results = await store_(client, [1, 0, 0]);

    assert.deepEqual(results, []);
    // First call is the dimension probe, second is the search itself.
    assert.equal(captured.length, 2);
    const search = captured[1];
    assert.match(search.sql, /FROM "DocumentEmbedding" e/);
    assert.match(search.sql, /JOIN "DocumentChunk" c ON c.id = e."chunkId"/);
    assert.match(search.sql, /e.embedding IS NOT NULL/);
    assert.match(search.sql, /d.status = 'INDEXED'/);
    assert.match(search.sql, /knowledgeBaseId" IN/);
  });

  it("probes the stored dimension over the same tenant scope as the search", async () => {
    const { client, captured } = captureStoreClient();

    await store_(client, [1, 0, 0], ["kb_cuid_a"], ["doc_cuid_a"]);

    const probe = captured[0];
    assert.match(probe.sql, /SELECT vector_dims\(e\."embedding"\)/);
    assert.match(probe.sql, /knowledgeBaseId" IN \(\$1\)/);
    assert.match(probe.sql, /d\."id" IN \(\$2\)/);
    // The search reuses the same ids at $4/$5, after minSimilarity, topK and vector.
    assert.match(captured[1].sql, /knowledgeBaseId" IN \(\$4\)/);
    assert.match(captured[1].sql, /d\."id" IN \(\$5\)/);
  });

  it("binds the query vector as a parameter instead of splicing it into the SQL", async () => {
    const { client, captured } = captureStoreClient();

    await store_(client, [1, 0, 0], ["kb_cuid_a"], ["doc_cuid_a"]);

    const search = captured[1];
    assert.doesNotMatch(search.sql, /\[1,0,0\]/);
    assert.match(search.sql, /e\.embedding <=> \$3::vector/);
    assert.deepEqual(search.params, [0.7, 5, "[1,0,0]", "kb_cuid_a", "doc_cuid_a"]);
  });

  it("reports a dimension mismatch with both widths instead of a pgvector operator error", async () => {
    const { client, captured } = captureStoreClient(768);

    await assert.rejects(
      store_(client, Array.from({ length: 1536 }, () => 0.1)),
      /Query embedding has 1536 dimensions but the selected documents hold 768-dimensional vectors/,
    );
    // The search must not run once the probe has rejected.
    assert.equal(captured.length, 1);
  });

  it("allows the query through when the stored dimension matches", async () => {
    const { client, captured } = captureStoreClient(1536);

    await store_(client, Array.from({ length: 1536 }, () => 0.1));

    assert.equal(captured.length, 2);
  });

  it("allows the query through when nothing is indexed yet", async () => {
    const { client, captured } = captureStoreClient();

    await store_(client, [1, 0, 0]);

    assert.equal(captured.length, 2);
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