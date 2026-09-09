-- Add retrievalConfig to KnowledgeBase (schema drift from init migration).
-- Conditional: safe to apply even if the column already exists (e.g. via db push).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'KnowledgeBase' AND column_name = 'retrievalConfig'
  ) THEN
    ALTER TABLE "KnowledgeBase" ADD COLUMN "retrievalConfig" JSONB DEFAULT '{}';
  END IF;
END $$;
