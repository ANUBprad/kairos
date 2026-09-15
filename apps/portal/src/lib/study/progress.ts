import { prisma } from "@/lib/prisma";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { AppError } from "@/lib/errors";

// Derived study progress, computed from the persisted quiz attempts and
// flashcard reviews. Only deterministic aggregates over stored rows — no
// mastery model and never a timestamp that was not actually recorded.
// Every query is scoped to the caller's userId, so different learners never
// observe each other's progress.

export interface ArtifactStudyProgress {
  // Quiz: number of completed attempts. Flashcards: number of distinct cards
  // ever marked (one review row per card).
  attempts: number;
  // Quiz: best completed score. Flashcards: null.
  bestScore: number | null;
  // Quiz: question count of the best attempt (content is immutable per
  // artifact, so it is constant across attempts). Flashcards: null.
  totalQuestions: number | null;
  // Flashcards: cards whose current status is KNOWN. Quiz: null.
  knownCount: number | null;
  lastStudiedAt: string | null;
}

// Per-user study summary for every studied artifact in one knowledge base,
// keyed by artifactId. Artifacts with no attempt/review rows get no entry — the
// caller reads that as "not started". One round trip covers the whole KB.
export async function getStudyProgressForUser(
  userId: string,
  knowledgeBaseId: string,
): Promise<Record<string, ArtifactStudyProgress>> {
  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }

  const [quizRows, cardRows] = await Promise.all([
    prisma.quizAttempt.groupBy({
      by: ["artifactId"],
      where: { userId, knowledgeBaseId, status: "COMPLETED" },
      _count: { _all: true },
      _max: { score: true, totalQuestions: true, completedAt: true },
    }),
    prisma.flashcardReview.groupBy({
      by: ["artifactId", "status"],
      where: { userId, knowledgeBaseId },
      _count: { _all: true },
      _max: { lastReviewedAt: true },
    }),
  ]);

  const progress: Record<string, ArtifactStudyProgress> = {};
  for (const row of quizRows) {
    progress[row.artifactId] = {
      attempts: row._count._all,
      bestScore: row._max.score ?? null,
      totalQuestions: row._max.totalQuestions ?? null,
      knownCount: null,
      lastStudiedAt: row._max.completedAt ? row._max.completedAt.toISOString() : null,
    };
  }
  for (const row of cardRows) {
    const entry = progress[row.artifactId] ?? {
      attempts: 0,
      bestScore: null,
      totalQuestions: null,
      knownCount: 0,
      lastStudiedAt: null,
    };
    entry.attempts += row._count._all;
    if (row.status === "KNOWN") entry.knownCount = (entry.knownCount ?? 0) + row._count._all;
    if (row._max.lastReviewedAt && (!entry.lastStudiedAt || row._max.lastReviewedAt > new Date(entry.lastStudiedAt))) {
      entry.lastStudiedAt = row._max.lastReviewedAt.toISOString();
    }
    progress[row.artifactId] = entry;
  }
  return progress;
}

export interface StudyCounts {
  quizzesTaken: number;
  cardsKnown: number;
}

// Rolling per-learner totals scoped to the knowledge bases of one project,
// for the home dashboard.
export async function getStudyCountsForProject(
  userId: string,
  projectId: string,
): Promise<StudyCounts> {
  const [quizzesTaken, cardsKnown] = await Promise.all([
    prisma.quizAttempt.count({
      where: { userId, status: "COMPLETED", knowledgeBase: { projectId } },
    }),
    prisma.flashcardReview.count({
      where: { userId, status: "KNOWN", knowledgeBase: { projectId } },
    }),
  ]);
  return { quizzesTaken, cardsKnown };
}