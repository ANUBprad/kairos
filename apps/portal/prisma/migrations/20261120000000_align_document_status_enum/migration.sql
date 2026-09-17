-- Additive enum expansion for DocumentStatus.
-- The schema defines ten statuses; the initial migration only created four.
-- VALUES are added before anything references them so the default change in a
-- follow-up migration is safe on PostgreSQL (a newly added enum value cannot be
-- used in the same transaction that creates it).
ALTER TYPE "DocumentStatus" ADD VALUE 'QUEUED';
ALTER TYPE "DocumentStatus" ADD VALUE 'UPLOADING';
ALTER TYPE "DocumentStatus" ADD VALUE 'STORED';
ALTER TYPE "DocumentStatus" ADD VALUE 'EXTRACTING';
ALTER TYPE "DocumentStatus" ADD VALUE 'CHUNKING';
ALTER TYPE "DocumentStatus" ADD VALUE 'EMBEDDING_PENDING';
ALTER TYPE "DocumentStatus" ADD VALUE 'EMBEDDING';
ALTER TYPE "DocumentStatus" ADD VALUE 'INDEXED';

-- The application writes fileHash on every upload; a fresh deploy must accept
-- a Document insert (Prisma rejects a model/DB drift before the write lands).
ALTER TABLE "Document" ADD COLUMN "fileHash" VARCHAR(128);

-- Match the schema's index contract (`@@unique([knowledgeBaseId, fileHash])`
-- and `@@index([knowledgeBaseId, status])`).
CREATE UNIQUE INDEX "Document_knowledgeBaseId_fileHash_key" ON "Document"("knowledgeBaseId", "fileHash");
CREATE INDEX "Document_knowledgeBaseId_status_idx" ON "Document"("knowledgeBaseId", "status");