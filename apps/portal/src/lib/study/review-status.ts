import { AppError } from "@/lib/errors";

export const FLASHCARD_REVIEW_STATUSES = ["NEW", "LEARNING", "KNOWN"] as const;
export type FlashcardReviewStatus = (typeof FLASHCARD_REVIEW_STATUSES)[number];

export const FLASHCARD_VERDICTS = ["AGAIN", "KNOWN"] as const;
export type FlashcardVerdict = (typeof FLASHCARD_VERDICTS)[number];

export function parseFlashcardReviewStatus(value: string): FlashcardReviewStatus {
  if (!(FLASHCARD_REVIEW_STATUSES as readonly string[]).includes(value)) {
    throw new AppError("INVALID_FLASHCARD_STATUS", `Unknown flashcard status: ${value}`, 400);
  }
  return value as FlashcardReviewStatus;
}

export function parseFlashcardVerdict(value: string): FlashcardVerdict {
  if (!(FLASHCARD_VERDICTS as readonly string[]).includes(value)) {
    throw new AppError("INVALID_FLASHCARD_VERDICT", "Verdict must be AGAIN or KNOWN", 400);
  }
  return value as FlashcardVerdict;
}

// Deterministic NEW -> LEARNING -> KNOWN progression. Deliberately no spaced
// repetition: "Known" climbs one rung and "Again" drops a KNOWN card back to
// LEARNING (a seen card never returns to NEW — the counts carry that detail).
const TRANSITIONS: Readonly<
  Record<FlashcardReviewStatus, Readonly<Record<FlashcardVerdict, FlashcardReviewStatus>>>
> = {
  NEW: { AGAIN: "LEARNING", KNOWN: "LEARNING" },
  LEARNING: { AGAIN: "LEARNING", KNOWN: "KNOWN" },
  KNOWN: { AGAIN: "LEARNING", KNOWN: "KNOWN" },
};

export function nextFlashcardReviewStatus(
  status: FlashcardReviewStatus,
  verdict: FlashcardVerdict,
): FlashcardReviewStatus {
  return TRANSITIONS[status][verdict];
}