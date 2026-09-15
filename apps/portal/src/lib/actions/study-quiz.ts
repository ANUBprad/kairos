"use server";

import { requireSession } from "@/lib/server/auth-utils";
import {
  getQuizAttemptForUser,
  startQuizAttemptForUser,
  submitQuizAttemptForUser,
} from "@/lib/study";

export type { QuizAnswerInput, QuizAttemptData } from "@/lib/study";

// Authenticated surface for the persistent quiz attempt flow. All authorization
// happens below in the study layer (session user + KB scope); this file only
// pins the typed public signatures for the browser.
export async function startQuizAttemptForWorkspace(
  knowledgeBaseId: string,
  artifactId: string,
) {
  const session = await requireSession();
  return startQuizAttemptForUser(session.user.id, { knowledgeBaseId, artifactId });
}

export async function submitQuizAttemptForWorkspace(
  knowledgeBaseId: string,
  attemptId: string,
  answers: { questionId: number; selectedAnswer: number }[],
) {
  const session = await requireSession();
  return submitQuizAttemptForUser(session.user.id, { attemptId, answers });
}

export async function getQuizAttemptForWorkspace(
  knowledgeBaseId: string,
  artifactId: string,
) {
  const session = await requireSession();
  return getQuizAttemptForUser(session.user.id, { knowledgeBaseId, artifactId });
}