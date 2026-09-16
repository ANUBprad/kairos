import { prisma } from "@/lib/prisma";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { listLearningArtifacts } from "@/lib/artifacts/persistence";
import { toWorkspaceArtifactData } from "@/lib/artifacts/dto";
import type { LearningArtifactWithStudy } from "@/lib/artifacts/types";
import { getStudyProgressForUser } from "./progress";
import { getRecentQuizAttemptsForUser, type RecentQuizAttempt } from "./quiz";
import type { ArtifactStudyProgress } from "./progress";

export interface StudyDashboardSummary {
  quizzesTaken: number;
  cardReviews: number;
  cardsKnown: number;
  studiedArtifacts: number;
}

export interface StudySummaryRow {
  type: string;
  study: ArtifactStudyProgress | null;
}

// Pure aggregation over an already-fetched projection, so every dashboard
// number is derived in one obvious place and unit-testable without a database.
// LearningArtifactWithStudy[] satisfies StudySummaryRow structurally.
export function summarizeStudyProgress(
  artifacts: readonly StudySummaryRow[],
): StudyDashboardSummary {
  let quizzesTaken = 0;
  let cardReviews = 0;
  let cardsKnown = 0;
  let studiedArtifacts = 0;

  for (const artifact of artifacts) {
    const study: ArtifactStudyProgress | null = artifact.study;
    if (artifact.type === "QUIZ") {
      // attempts = completed quiz attempts (one row per attempt).
      quizzesTaken += study?.attempts ?? 0;
    } else if (artifact.type === "FLASHCARDS") {
      // reviewCount = total verdict marks (repeats count); knownCount = cards
      // currently marked KNOWN. See ArtifactStudyProgress in progress.ts.
      cardReviews += study?.reviewCount ?? 0;
      cardsKnown += study?.knownCount ?? 0;
    }
    if (study && (study.attempts > 0 || (study.reviewCount ?? 0) > 0)) {
      studiedArtifacts += 1;
    }
  }

  return { quizzesTaken, cardReviews, cardsKnown, studiedArtifacts };
}

export interface StudyDashboardData {
  kbName: string;
  // QUIZ / FLASHCARDS artifacts only, studied-first: enties with study progress
  // sorted by lastStudiedAt desc, untouched ones by createdAt desc.
  artifacts: LearningArtifactWithStudy[];
  summary: StudyDashboardSummary;
  recentAttempts: RecentQuizAttempt[];
}

export async function getStudyDashboardForUser(
  userId: string,
  knowledgeBaseId: string,
): Promise<StudyDashboardData | null> {
  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) return null;

  // Four parallel queries, no N+1: kb name, artifact list, per-artifact study
  // projection (keyed group-bys in progress.ts), bounded recent attempts.
  const [kb, artifacts, progress, recentAttempts] = await Promise.all([
    prisma.knowledgeBase.findUnique({ where: { id: knowledgeBaseId }, select: { name: true } }),
    listLearningArtifacts(knowledgeBaseId),
    getStudyProgressForUser(userId, knowledgeBaseId),
    getRecentQuizAttemptsForUser(userId, { knowledgeBaseId }),
  ]);
  if (!kb) return null;

  // Same merge shape as listLearningArtifactsForWorkspace (artifacts + study),
  // duplicated deliberately: this loader filters artifact types and re-sorts,
  // so it merges in place instead of calling the workspace projection.
  const withStudy: LearningArtifactWithStudy[] = artifacts.map((artifact) => ({
    ...toWorkspaceArtifactData(artifact),
    study: progress[artifact.id] ?? null,
  }));

  const studyArtifacts = withStudy.filter(
    (artifact) => artifact.type === "QUIZ" || artifact.type === "FLASHCARDS",
  );

  studyArtifacts.sort((a, b) => {
    const aTime = a.study?.lastStudiedAt;
    const bTime = b.study?.lastStudiedAt;
    if (aTime && bTime) return bTime.localeCompare(aTime);
    if (aTime) return -1;
    if (bTime) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return {
    kbName: kb.name,
    artifacts: studyArtifacts,
    summary: summarizeStudyProgress(studyArtifacts),
    recentAttempts,
  };
}