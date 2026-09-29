import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isValidEntityId } from "@/lib/validation";

export interface VectorSearchResult {
  chunkId: string;
  documentId: string;
  content: string;
  index: number;
  tokenCount: number | null;
  metadata: Record<string, unknown> | null;
  similarity: number;
}

export interface VectorStore {
  bulkUpsertEmbeddings(
    entries: { chunkId: string; embedding: number[] }[],
    dimensions: number,
  ): Promise<void>;
  similaritySearch(
    embedding: number[],
    options: {
      knowledgeBaseIds?: string[];
      documentIds?: string[];
      topK?: number;
      minSimilarity?: number;
    },
  ): Promise<VectorSearchResult[]>;
  deleteEmbedding(chunkId: string): Promise<void>;
  deleteEmbeddingsByDocument(documentId: string): Promise<void>;
}

function vecLiteral(values: number[]): string {
  return `[${values.join(",")}]`;
}

// Tenant/document scoping shared by the dimension probe and the search itself,
// so the probe can never disagree with the rows the search actually touches.
function scopeClause(
  kbIds: string[] | undefined,
  docIds: string[] | undefined,
  startIndex: number,
): { clause: string; params: unknown[] } {
  let nextIndex = startIndex;
  const parts: string[] = [];
  const params: unknown[] = [];

  if (kbIds?.length) {
    parts.push(`AND d."knowledgeBaseId" IN (${kbIds.map(() => `$${nextIndex++}`).join(",")})`);
    params.push(...kbIds);
  }
  if (docIds?.length) {
    parts.push(`AND d."id" IN (${docIds.map(() => `$${nextIndex++}`).join(",")})`);
    params.push(...docIds);
  }

  return { clause: parts.join("\n        "), params };
}

export class PgVectorStore implements VectorStore {
  private readonly client: Prisma.TransactionClient;
  // Accepts a transaction client so a caller can commit the vector and the
  // metadata that describes it together; without that, a crash between the two
  // leaves a vector claiming the schema's default model and dimension.
  constructor(client: Prisma.TransactionClient = prisma) {
    this.client = client;
  }

  async bulkUpsertEmbeddings(
    entries: { chunkId: string; embedding: number[] }[],
    _dimensions: number,
  ): Promise<void> {
    if (entries.length === 0) return;

    // One round trip per statement (capped so a caller cannot exceed the
    // ~65k server parameter limit); the old per-chunk INSERT was N+1 trips
    // for a 20-chunk embedding batch.
    const UPSERT_BATCH = 500;
    for (let i = 0; i < entries.length; i += UPSERT_BATCH) {
      const batch = entries.slice(i, i + UPSERT_BATCH);
      const placeholders = batch
        .map((_, j) => `(gen_random_uuid(), $${j * 2 + 1}, $${j * 2 + 2}::vector)`)
        .join(", ");
      const params = batch.flatMap((e) => [e.chunkId, vecLiteral(e.embedding)]);
      await this.client.$executeRawUnsafe(
        `INSERT INTO "DocumentEmbedding" ("id", "chunkId", "embedding")
         VALUES ${placeholders}
         ON CONFLICT ("chunkId") DO UPDATE SET "embedding" = EXCLUDED."embedding"`,
        ...params,
      );
    }
  }

  /**
   * A query vector whose width differs from the stored vectors is not a
   * "no results" case, it is a misconfigured index, and pgvector reports it as an
   * opaque operator error. Fail with the actual numbers instead.
   */
  private async assertQueryDimension(
    queryEmbedding: number[],
    scope: { clause: string; params: unknown[] },
  ): Promise<void> {
    // ponytail: one single-row probe per search, O(1) off the chunkId index. It
    // assumes one dimension per knowledge base, which ingestion enforces. Upgrade
    // path: store the authoritative dimension on KnowledgeBase and read that
    // instead of probing.
    const rows = await this.client.$queryRawUnsafe<{ dims: number }[]>(
      `SELECT vector_dims(e."embedding")::int AS dims
       FROM "DocumentEmbedding" e
       JOIN "DocumentChunk" c ON c.id = e."chunkId"
       JOIN "Document" d ON d.id = c."documentId"
       WHERE e.embedding IS NOT NULL
         ${scope.clause}
       LIMIT 1`,
      ...scope.params,
    );

    const stored = rows[0]?.dims;
    if (stored !== undefined && stored !== queryEmbedding.length) {
      throw new Error(
        `Query embedding has ${queryEmbedding.length} dimensions but the selected documents hold ` +
          `${stored}-dimensional vectors. Reindex those documents with the model configured on the ` +
          `knowledge base before searching them.`,
      );
    }
  }

  async similaritySearch(
    queryEmbedding: number[],
    options: {
      knowledgeBaseIds?: string[];
      documentIds?: string[];
      topK?: number;
      minSimilarity?: number;
    },
  ): Promise<VectorSearchResult[]> {
    const topK = options.topK ?? 10;
    const minSim = options.minSimilarity ?? 0.7;
    const queryVec = vecLiteral(queryEmbedding);

    const kbIds = options.knowledgeBaseIds?.filter(isValidEntityId);
    const docIds = options.documentIds?.filter(isValidEntityId);
    if (docIds?.length === 0) return [];

    const scope = scopeClause(kbIds, docIds, 1);
    await this.assertQueryDimension(queryEmbedding, scope);

    // $1 minSimilarity, $2 topK, $3 query vector, $4+ tenant scope. The vector is
    // bound as a parameter rather than spliced into the statement so the plan is
    // reusable and the literal is parsed once by Postgres.
    const searchScope = scopeClause(kbIds, docIds, 4);
    const sql = `
      SELECT
        c.id AS "chunkId",
        c."documentId",
        c.content,
        c.index,
        c."tokenCount",
        c.metadata,
        1 - (e.embedding <=> $3::vector) AS similarity
      FROM "DocumentEmbedding" e
      JOIN "DocumentChunk" c ON c.id = e."chunkId"
      JOIN "Document" d ON d.id = c."documentId"
      WHERE e.embedding IS NOT NULL
        AND d.status = 'INDEXED'
        ${searchScope.clause}
        AND 1 - (e.embedding <=> $3::vector) >= $1
      ORDER BY e.embedding <=> $3::vector
      LIMIT $2
    `;

    const params: unknown[] = [minSim, topK, queryVec, ...searchScope.params];

    const rows = await this.client.$queryRawUnsafe<
      {
        chunkId: string;
        documentId: string;
        content: string;
        index: number;
        tokenCount: number | null;
        metadata: Record<string, unknown> | null;
        similarity: number;
      }[]
    >(sql, ...params);

    return (rows || []).map((r) => ({
      ...r,
      similarity: Math.round(r.similarity * 10000) / 10000,
    }));
  }

  async deleteEmbedding(chunkId: string): Promise<void> {
    await this.client.$executeRawUnsafe(
      `UPDATE "DocumentEmbedding" SET embedding = NULL WHERE "chunkId" = $1`,
      chunkId,
    );
  }

  async deleteEmbeddingsByDocument(documentId: string): Promise<void> {
    await this.client.$executeRawUnsafe(
      `UPDATE "DocumentEmbedding" e SET embedding = NULL
       FROM "DocumentChunk" c
       WHERE c.id = e."chunkId" AND c."documentId" = $1`,
      documentId,
    );
  }
}

export const vectorStore: VectorStore = new PgVectorStore();
