-- Study Loop foundation (Phase 3, Slice 3): persistent quiz attempts and
-- flashcard review state. Additive only — three new tables, an enum type each
-- for attempt/review status, and no changes to existing tables. Conditional /
-- IF NOT EXISTS so it is safe to apply onto a database that already received
-- the models via db push during development.

CREATE TYPE "QuizAttemptStatus" AS ENUM ('PENDING', 'COMPLETED');
CREATE TYPE "FlashcardReviewStatus" AS ENUM ('NEW', 'LEARNING', 'KNOWN');

CREATE TABLE IF NOT EXISTS "QuizAttempt" (
  "id" TEXT NOT NULL,
  "status" "QuizAttemptStatus" NOT NULL DEFAULT 'PENDING',
  "score" INTEGER NOT NULL DEFAULT 0,
  "totalQuestions" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "artifactId" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "QuizAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QuizAttemptAnswer" (
  "id" TEXT NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" INTEGER NOT NULL,
  "selectedAnswer" INTEGER NOT NULL,
  "isCorrect" BOOLEAN NOT NULL,
  CONSTRAINT "QuizAttemptAnswer_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "FlashcardReview" (
  "id" TEXT NOT NULL,
  "status" "FlashcardReviewStatus" NOT NULL DEFAULT 'NEW',
  "knownCount" INTEGER NOT NULL DEFAULT 0,
  "againCount" INTEGER NOT NULL DEFAULT 0,
  "reviewCount" INTEGER NOT NULL DEFAULT 0,
  "lastReviewedAt" TIMESTAMP(3),
  "cardId" INTEGER NOT NULL,
  "artifactId" TEXT NOT NULL,
  "knowledgeBaseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FlashcardReview_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'QuizAttempt_artifactId_fkey'
  ) THEN
    ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "LearningArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'QuizAttempt_knowledgeBaseId_fkey'
  ) THEN
    ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_knowledgeBaseId_fkey"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'QuizAttempt_userId_fkey'
  ) THEN
    ALTER TABLE "QuizAttempt" ADD CONSTRAINT "QuizAttempt_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'QuizAttemptAnswer_attemptId_fkey'
  ) THEN
    ALTER TABLE "QuizAttemptAnswer" ADD CONSTRAINT "QuizAttemptAnswer_attemptId_fkey"
      FOREIGN KEY ("attemptId") REFERENCES "QuizAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FlashcardReview_artifactId_fkey'
  ) THEN
    ALTER TABLE "FlashcardReview" ADD CONSTRAINT "FlashcardReview_artifactId_fkey"
      FOREIGN KEY ("artifactId") REFERENCES "LearningArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FlashcardReview_knowledgeBaseId_fkey'
  ) THEN
    ALTER TABLE "FlashcardReview" ADD CONSTRAINT "FlashcardReview_knowledgeBaseId_fkey"
      FOREIGN KEY ("knowledgeBaseId") REFERENCES "KnowledgeBase"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'FlashcardReview_userId_fkey'
  ) THEN
    ALTER TABLE "FlashcardReview" ADD CONSTRAINT "FlashcardReview_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "QuizAttemptAnswer_attemptId_questionId_key"
  ON "QuizAttemptAnswer"("attemptId", "questionId");
CREATE UNIQUE INDEX IF NOT EXISTS "FlashcardReview_userId_artifactId_cardId_key"
  ON "FlashcardReview"("userId", "artifactId", "cardId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_artifactId_idx"
  ON "QuizAttempt"("artifactId");
CREATE INDEX IF NOT EXISTS "QuizAttempt_knowledgeBaseId_userId_idx"
  ON "QuizAttempt"("knowledgeBaseId", "userId");
CREATE INDEX IF NOT EXISTS "QuizAttemptAnswer_attemptId_idx"
  ON "QuizAttemptAnswer"("attemptId");
CREATE INDEX IF NOT EXISTS "FlashcardReview_artifactId_idx"
  ON "FlashcardReview"("artifactId");
CREATE INDEX IF NOT EXISTS "FlashcardReview_knowledgeBaseId_userId_idx"
  ON "FlashcardReview"("knowledgeBaseId", "userId");