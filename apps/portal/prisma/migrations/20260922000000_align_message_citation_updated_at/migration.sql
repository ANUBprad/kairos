-- Close schema drift in the chat tables: the hand-written 20260915 migration
-- declared MessageCitation."updatedAt" TIMESTAMP(3) NOT NULL, but
-- schema.prisma's MessageCitation has no updatedAt field, so the generated
-- Prisma client never supplies it and every citation-bearing message insert
-- fails with a null-constraint violation on a freshly migrated database.
-- Aligned with the schema (and with Message, which has no updatedAt either):
-- the stray NOT NULL column is relaxed to nullable. No rows are affected —
-- existing rows simply keep carrying NULL in that column. Guarded like the
-- other alignment migrations so it is safe to apply on DBs db push'd from
-- newer schema state (where the column may not exist at all).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'MessageCitation' AND column_name = 'updatedAt'
  ) THEN
    ALTER TABLE "MessageCitation" ALTER COLUMN "updatedAt" DROP NOT NULL;
  END IF;
END $$;