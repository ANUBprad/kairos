import { prisma } from "@/lib/prisma";

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
  ensureSchema(): Promise<void>;
  bulkUpsertEmbeddings(
    entries: { chunkId: string; embedding: number[] }[],
    dimensions: number,
  ): Promise<void>;
  similaritySearch(
    embedding: number[],
    options: {
      knowledgeBaseIds?: string[];
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

class PgVectorStore implements VectorStore {
  async ensureSchema(): Promise<void> {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS vector`);

    await prisma.$executeRawUnsafe(`
      ALTER TABLE "DocumentEmbedding"
      ADD COLUMN IF NOT EXISTS embedding vector(3072)
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_document_embedding_vector
      ON "DocumentEmbedding"
      USING ivfflat (embedding vector_cosine_ops)
      WITH (lists = 100)
    `);
  }

  async bulkUpsertEmbeddings(
    entries: { chunkId: string; embedding: number[] }[],
    _dimensions: number,
  ): Promise<void> {
    for (const entry of entries) {
      await prisma.$executeRawUnsafe(
        `UPDATE "DocumentEmbedding" SET embedding = $1::vector WHERE "chunkId" = $2`,
        vecLiteral(entry.embedding),
        entry.chunkId,
      );
    }
  }

  async similaritySearch(
    queryEmbedding: number[],
    options: {
      knowledgeBaseIds?: string[];
      topK?: number;
      minSimilarity?: number;
    },
  ): Promise<VectorSearchResult[]> {
    const topK = options.topK ?? 10;
    const minSim = options.minSimilarity ?? 0.7;
    const queryVec = vecLiteral(queryEmbedding);

    const kbFilter = options.knowledgeBaseIds?.length
      ? `AND d."knowledgeBaseId" IN (${options.knowledgeBaseIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(",")})`
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
        ${kbFilter}
        AND 1 - (e.embedding <=> '${queryVec}'::vector) >= $1
      ORDER BY e.embedding <=> '${queryVec}'::vector
      LIMIT $2
    `;

    const rows = await prisma.$queryRawUnsafe<
      {
        chunkId: string;
        documentId: string;
        content: string;
        index: number;
        tokenCount: number | null;
        metadata: Record<string, unknown> | null;
        similarity: number;
      }[]
    >(sql, minSim, topK);

    return (rows || []).map((r) => ({
      ...r,
      similarity: Math.round(r.similarity * 10000) / 10000,
    }));
  }

  async deleteEmbedding(chunkId: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `UPDATE "DocumentEmbedding" SET embedding = NULL WHERE "chunkId" = $1`,
      chunkId,
    );
  }

  async deleteEmbeddingsByDocument(documentId: string): Promise<void> {
    await prisma.$executeRawUnsafe(
      `UPDATE "DocumentEmbedding" e SET embedding = NULL
       FROM "DocumentChunk" c
       WHERE c.id = e."chunkId" AND c."documentId" = $1`,
      documentId,
    );
  }
}

export const vectorStore: VectorStore = new PgVectorStore();
