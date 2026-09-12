-- Extend workspace sources for source-library parity:
--   Document: sourceType (FILE/TEXT/URL/YOUTUBE), sourceUrl, and relax file-only
--   NOT NULL constraints (size, storageProvider, storageKey) so file-less sources
--   are representable without faking upload metadata. Existing rows keep sourceType
--   defaulting to 'FILE' and their current upload fields.
--   KnowledgeBase: icon, defaultModel (both optional, additive).
-- Conditional: safe to apply even if already present (e.g. via db push), matching
-- the repo's hand-written migration style.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentSourceType') THEN
    CREATE TYPE "DocumentSourceType" AS ENUM ('FILE', 'TEXT', 'URL', 'YOUTUBE');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'sourceType'
  ) THEN
    ALTER TABLE "Document" ADD COLUMN "sourceType" "DocumentSourceType" NOT NULL DEFAULT 'FILE';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'sourceUrl'
  ) THEN
    ALTER TABLE "Document" ADD COLUMN "sourceUrl" TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'KnowledgeBase' AND column_name = 'icon'
  ) THEN
    ALTER TABLE "KnowledgeBase" ADD COLUMN "icon" VARCHAR(32);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'KnowledgeBase' AND column_name = 'defaultModel'
  ) THEN
    ALTER TABLE "KnowledgeBase" ADD COLUMN "defaultModel" TEXT;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'size' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "Document" ALTER COLUMN "size" DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'storageProvider' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "Document" ALTER COLUMN "storageProvider" DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'storageKey' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "Document" ALTER COLUMN "storageKey" DROP NOT NULL;
  END IF;
END $$;