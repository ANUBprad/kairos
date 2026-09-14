-- Create the Conversation / Message / MessageCitation tables for the
-- unified research chat (Phase 2, D8 chat-table slice). Previously these
-- models existed only in schema.prisma (via db push / dev), so a fresh
-- `prisma migrate deploy` could not persist conversations.
-- Conditional: safe to apply even if already present (e.g. via db push).

CREATE TABLE IF NOT EXISTS "Conversation" (
  "id" TEXT NOT NULL,
  "title" VARCHAR(255),
  "model" TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  "provider" TEXT NOT NULL DEFAULT 'openai',
  "knowledgeBaseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Message" (
  "id" TEXT NOT NULL,
  "role" VARCHAR(16) NOT NULL,
  "content" TEXT NOT NULL,
  "tokens" INTEGER,
  "conversationId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageCitation" (
  "id" TEXT NOT NULL,
  "chunkId" TEXT NOT NULL,
  "documentId" VARCHAR(255) NOT NULL,
  "documentName" VARCHAR(255) NOT NULL,
  "chunkIndex" INTEGER NOT NULL,
  "pageNumber" INTEGER,
  "excerpt" TEXT NOT NULL,
  "similarity" DOUBLE PRECISION,
  "messageId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageCitation_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Conversation_knowledgeBaseId_fkey'
  ) THEN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_knowledgeBaseId_fkey"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Conversation_userId_fkey'
  ) THEN
    ALTER TABLE "Conversation" ADD CONSTRAINT "Conversation_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'Message_conversationId_fkey'
  ) THEN
    ALTER TABLE "Message" ADD CONSTRAINT "Message_conversationId_fkey"
      FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'MessageCitation_messageId_fkey'
  ) THEN
    ALTER TABLE "MessageCitation" ADD CONSTRAINT "MessageCitation_messageId_fkey"
      FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Conversation_knowledgeBaseId_idx"
  ON "Conversation"("knowledgeBaseId");
CREATE INDEX IF NOT EXISTS "Conversation_userId_idx"
  ON "Conversation"("userId");
CREATE INDEX IF NOT EXISTS "Conversation_knowledgeBaseId_userId_idx"
  ON "Conversation"("knowledgeBaseId", "userId");
CREATE INDEX IF NOT EXISTS "Message_conversationId_createdAt_idx"
  ON "Message"("conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "MessageCitation_messageId_idx"
  ON "MessageCitation"("messageId");