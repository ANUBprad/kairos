import type { FlashcardReview } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { canAccessKnowledgeBase } from "@/lib/ai/chat/access";
import { AppError } from "@/lib/errors";
import { getLearningArtifactInKb } from "@/lib/artifacts";
import { parseFlashcardsContent } from "@/lib/artifacts/flashcards-view";
import {
  nextFlashcardReviewStatus,
  parseFlashcardReviewStatus,
  parseFlashcardVerdict,
  type FlashcardReviewStatus,
} from "./review-status";

// Per-card persistent review state on a FLASHCARDS artifact. cardId is the
// 0-based index into the artifact's (immutable) cards array. One row per
// (user, artifact, card); verified explicitly under "@@unique".

export interface FlashcardReviewData {
  cardId: number;
  status: FlashcardReviewStatus;
  knownCount: number;
  againCount: number;
  reviewCount: number;
  lastReviewedAt: string | null;
}

type FlashcardReviewRow = FlashcardReview;

function toFlashcardReviewData(row: FlashcardReviewRow): FlashcardReviewData {
  return {
    cardId: row.cardId,
    status: row.status,
    knownCount: row.knownCount,
    againCount: row.againCount,
    reviewCount: row.reviewCount,
    lastReviewedAt: row.lastReviewedAt ? row.lastReviewedAt.toISOString() : null,
  };
}

async function loadDeckForReview(
  knowledgeBaseId: string,
  artifactId: string,
): Promise<{ cardCount: number }> {
  const artifact = await getLearningArtifactInKb(artifactId, knowledgeBaseId);
  if (!artifact) throw new AppError("NOT_FOUND", "Artifact not found", 404);
  if (artifact.type !== "FLASHCARDS") {
    throw new AppError("ARTIFACT_NOT_FLASHCARDS", "Artifact is not a flashcard deck", 400);
  }
  if (artifact.status !== "COMPLETED") {
    throw new AppError("ARTIFACT_NOT_COMPLETED", "This deck is not ready to review", 409);
  }
  const content = parseFlashcardsContent(artifact.content);
  if (!content) throw new AppError("ARTIFACT_CONTENT_INVALID", "The deck content is unavailable", 400);
  return { cardCount: content.cards.length };
}

// Returns one review state per card in deck order, defaulting untouched cards
// so the caller always gets full coverage for the progress display.
export async function getFlashcardReviewsForUser(
  userId: string,
  request: { knowledgeBaseId: string; artifactId: string },
): Promise<FlashcardReviewData[]> {
  const { knowledgeBaseId, artifactId } = request;

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }
  const { cardCount } = await loadDeckForReview(knowledgeBaseId, artifactId);

  const rows = await prisma.flashcardReview.findMany({
    where: { userId, artifactId },
    orderBy: { cardId: "asc" },
  });
  const byCard = new Map(rows.map((row) => [row.cardId, row]));

  return Array.from({ length: cardCount }, (_, cardId) => {
    const row = byCard.get(cardId);
    return row
      ? toFlashcardReviewData(row)
      : { cardId, status: "NEW" as const, knownCount: 0, againCount: 0, reviewCount: 0, lastReviewedAt: null };
  });
}

// Records a single verdict on one card of a deck the user can access. Reads
// then upserts so counts accumulate; concurrent marks from the same user would
// last-write-wins on status, but the UI serializes per card so this is safe in
// practice (ponytail: counts could be made atomic with Prisma { increment },
// status transitions are inherently last-write-wins).
export async function markFlashcardReviewForUser(
  userId: string,
  request: { knowledgeBaseId: string; artifactId: string; cardId: number; verdict: string },
): Promise<FlashcardReviewData> {
  const { knowledgeBaseId, artifactId, cardId, verdict: verdictRaw } = request;
  const verdict = parseFlashcardVerdict(verdictRaw);

  if (!(await canAccessKnowledgeBase(userId, knowledgeBaseId))) {
    throw new AppError("NOT_FOUND", "Knowledge base not found", 404);
  }
  const { cardCount } = await loadDeckForReview(knowledgeBaseId, artifactId);
  if (!Number.isInteger(cardId) || cardId < 0 || cardId >= cardCount) {
    throw new AppError("FLASHCARD_INVALID_CARD", `No card with id ${cardId} in this deck`, 400);
  }

  const existing = await prisma.flashcardReview.findUnique({
    where: { userId_artifactId_cardId: { userId, artifactId, cardId } },
  });
  const base = existing
    ? {
        status: parseFlashcardReviewStatus(existing.status),
        knownCount: existing.knownCount,
        againCount: existing.againCount,
        reviewCount: existing.reviewCount,
      }
    : { status: "NEW" as const, knownCount: 0, againCount: 0, reviewCount: 0 };

  const status = nextFlashcardReviewStatus(base.status, verdict);
  const now = new Date();

  const row = await prisma.flashcardReview.upsert({
    where: { userId_artifactId_cardId: { userId, artifactId, cardId } },
    create: {
      cardId,
      artifactId,
      knowledgeBaseId,
      userId,
      status,
      knownCount: base.knownCount + (verdict === "KNOWN" ? 1 : 0),
      againCount: base.againCount + (verdict === "AGAIN" ? 1 : 0),
      reviewCount: base.reviewCount + 1,
      lastReviewedAt: now,
    },
    update: {
      status,
      knownCount: base.knownCount + (verdict === "KNOWN" ? 1 : 0),
      againCount: base.againCount + (verdict === "AGAIN" ? 1 : 0),
      reviewCount: base.reviewCount + 1,
      lastReviewedAt: now,
    },
  });
  return toFlashcardReviewData(row);
}