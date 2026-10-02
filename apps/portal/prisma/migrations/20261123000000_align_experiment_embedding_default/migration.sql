-- Align the Experiment default embedding model with the pinned vector width.
--
-- DocumentEmbedding's default was corrected to text-embedding-004 in
-- migration 20261122000000_pin_embedding_dimension_768 for the same reason.
-- Experiment.embeddingModel was left claiming text-embedding-3-small, a
-- 1536-dim model that cannot retrieve against the pinned vector(768) column.
--
-- This changes only the column default. It rewrites no rows: every current
-- Experiment already stores an explicit model (the API resolves an omitted
-- value to DEFAULT_EMBEDDING_MODEL.gemini and validates it with
-- assertIndexableEmbeddingModel), so this only removes the trap for a future
-- writer that omits the column.
ALTER TABLE "Experiment"
  ALTER COLUMN "embeddingModel" SET DEFAULT 'text-embedding-004';