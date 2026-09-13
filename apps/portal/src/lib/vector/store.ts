import type { PrismaClient } from "@prisma/client";
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

export class PgVectorStore implements VectorStore {
  private readonly client: PrismaClient;
  constructor(client: PrismaClient = prisma) {
    this.client = client;
  }

  async bulkUpsertEmbeddings(
    entries: { chunkId: string; embedding: number[] }[],
    _dimensions: number,
  ): Promise<void> {
    for (const entry of entries) {
      await this.client.$executeRawUnsafe(
        `INSERT INTO "DocumentEmbedding" ("id", "chunkId", "embedding")
         VALUES (gen_random_uuid(), $1, $2::vector)
         ON CONFLICT ("chunkId") DO UPDATE SET "embedding" = EXCLUDED."embedding"`,
        entry.chunkId,
        vecLiteral(entry.embedding),
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

    let paramIndex = 3;
    const kbPlaceholders = kbIds?.length
      ? `AND d."knowledgeBaseId" IN (${kbIds.map(() => `$${paramIndex++}`).join(",")})`
      : "";
    const docPlaceholders = docIds?.length
      ? `AND d."id" IN (${docIds.map(() => `$${paramIndex++}`).join(",")})`
      : "";

    const sql = `
      SELECT
        c.id AS "chunkId",
        c."documentId",
        c.content,
        c.index,
        c."tokenCount",
        c.metadata,
        1 - (e.embedding <=> '${queryVec}'::vector) AS similarity
      FROM "DocumentEmbedding" e
      JOIN "DocumentChunk" c ON c.id = e."chunkId"
      JOIN "Document" d ON d.id = c."documentId"
      WHERE e.embedding IS NOT NULL
        AND d.status = 'INDEXED'
        ${kbPlaceholders}
        ${docPlaceholders}
        AND 1 - (e.embedding <=> '${queryVec}'::vector) >= $1
      ORDER BY e.embedding <=> '${queryVec}'::vector
      LIMIT $2
    `;

    const params: unknown[] = [minSim, topK];
    if (kbIds?.length) {
      params.push(...kbIds);
    }
    if (docIds?.length) {
      params.push(...docIds);
    }

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
