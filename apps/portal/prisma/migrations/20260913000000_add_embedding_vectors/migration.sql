-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "DocumentEmbedding" ADD COLUMN IF NOT EXISTS "embedding" vector;