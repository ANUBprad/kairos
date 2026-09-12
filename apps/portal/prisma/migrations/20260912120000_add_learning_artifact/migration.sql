-- Add the LearningArtifact persistence contract for OpenBook-style generated
-- knowledge artifacts:
--   LearningArtifact: type/status lifecycle, KB ownership, a String[] sourceIds
--   snapshot (historical, NOT a FK relation), structured Json content/payload,
--   and provenance metadata. Purely additive: creates two enums + one table.
--   No source table relation = deleting source documents never cascades here.
-- Conditional: safe to apply even if already present (e.g. via db push), matching
-- the repo's hand-written migration style.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArtifactType') THEN
    CREATE TYPE "ArtifactType" AS ENUM (
      'SUMMARY', 'REPORT', 'QUIZ', 'FLASHCARDS', 'MINDMAP', 'TAKEAWAYS', 'PODCAST'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ArtifactStatus') THEN
    CREATE TYPE "ArtifactStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "LearningArtifact" (
  "id" TEXT NOT NULL,
  "type" "ArtifactType" NOT NULL,
  "status" "ArtifactStatus" NOT NULL DEFAULT 'PENDING',
  "name" VARCHAR(255),
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "sourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "content" JSONB,
  "metadata" JSONB,
  "knowledgeBaseId" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LearningArtifact_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LearningArtifact_knowledgeBaseId_fkey'
  ) THEN
    ALTER TABLE "LearningArtifact" ADD CONSTRAINT "LearningArtifact_knowledgeBaseId_fkey"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'LearningArtifact_createdById_fkey'
  ) THEN
    ALTER TABLE "LearningArtifact" ADD CONSTRAINT "LearningArtifact_createdById_fkey"
      FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "LearningArtifact_knowledgeBaseId_type_idx"
  ON "LearningArtifact"("knowledgeBaseId", "type");
CREATE INDEX IF NOT EXISTS "LearningArtifact_knowledgeBaseId_status_idx"
  ON "LearningArtifact"("knowledgeBaseId", "status");
CREATE INDEX IF NOT EXISTS "LearningArtifact_knowledgeBaseId_createdAt_idx"
  ON "LearningArtifact"("knowledgeBaseId", "createdAt");