-- Pin the embedding column to a single dimension so pgvector can build an HNSW
-- index. A typmod-less `vector` column cannot be indexed at all: PostgreSQL
-- rejects it with `column does not have dimensions`.
--
-- 768 matches the deployed AI_PROVIDER=gemini / text-embedding-004 configuration
-- (768-dim). This ALTER deliberately fails if any stored vector has a different
-- width, rather than truncating or dropping data: a knowledge base that used
-- another model must be reprocessed at the new width first.
ALTER TABLE "DocumentEmbedding"
  ALTER COLUMN "embedding" TYPE vector(768);

-- Record the authoritative dimension instead of leaving it to the schema
-- default, which claimed 1536 for every row regardless of the real model.
ALTER TABLE "DocumentEmbedding"
  ALTER COLUMN "dimensions" SET DEFAULT 768;

-- Same for the model default: it claimed text-embedding-3-small, a 1536-dim
-- model this column cannot hold. Ingestion always writes the model explicitly,
-- but the default must not contradict the pinned width either.
ALTER TABLE "DocumentEmbedding"
  ALTER COLUMN "model" SET DEFAULT 'text-embedding-004';

-- cosine distance, matching the `<=>` operator the search actually uses.
CREATE INDEX "DocumentEmbedding_embedding_hnsw_idx"
  ON "DocumentEmbedding"
  USING hnsw ("embedding" vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);
