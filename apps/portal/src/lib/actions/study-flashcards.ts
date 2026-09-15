"use server";

import { requireSession } from "@/lib/server/auth-utils";
import { getFlashcardReviewsForUser, markFlashcardReviewForUser } from "@/lib/study";

export type { FlashcardReviewData } from "@/lib/study";

// Authenticated surface for persistent flashcard review. All authorization
// happens below in the study layer (session user + KB scope).
export async function getFlashcardReviewsForWorkspace(
  knowledgeBaseId: string,
  artifactId: string,
) {
  const session = await requireSession();
  return getFlashcardReviewsForUser(session.user.id, { knowledgeBaseId, artifactId });
}

export async function markFlashcardReviewForWorkspace(
  knowledgeBaseId: string,
  artifactId: string,
  cardId: number,
  verdict: string,
) {
  const session = await requireSession();
  return markFlashcardReviewForUser(session.user.id, {
    knowledgeBaseId,
    artifactId,
    cardId,
    verdict,
  });
}