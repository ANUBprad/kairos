import { flashcardsArtifactSchema } from "./flashcards";

// Typed window into a stored FLASHCARDS payload. The O4-T6 schema is the
// single source of truth; this only guards rendering against malformed or
// legacy content so the viewer never crashes on stored data.
export interface FlashcardsViewContent {
  title: string;
  cards: { front: string; back: string }[];
}

export function parseFlashcardsContent(content: unknown): FlashcardsViewContent | null {
  const parsed = flashcardsArtifactSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}