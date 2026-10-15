"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  PartyPopper,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactSourceList } from "./artifact-source-list";
import { parseFlashcardsContent } from "@/lib/artifacts/flashcards-view";
import { summarizeFlashcardDeckProgress } from "@/lib/study/flashcards";
import {
  getFlashcardReviewsForWorkspace,
  markFlashcardReviewForWorkspace,
  type FlashcardReviewData,
} from "@/lib/actions/study-flashcards";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

// Review state is now persisted: per-card status + counts live in the DB and
// survive reload. Marking a card records a verdict server-side; progress and
// deck completion are always derived from those rows (a card counts as
// reviewed once it has reviewCount > 0), never from a stored flag.
export function FlashcardsArtifactViewer({ artifact, sources, onClose }: Props) {
  // parseFlashcardsContent returns a fresh object each call; memoizing on the
  // stable artifact.content keeps the load effect from re-running (and
  // re-fetching every review row) on every render.
  const content = useMemo(() => parseFlashcardsContent(artifact.content), [artifact.content]);
  const kbId = artifact.knowledgeBaseId;
  const [reviews, setReviews] = useState<FlashcardReviewData[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cardCount = content?.cards.length ?? 0;
  const current = content?.cards[index];
  const progress = reviews ? summarizeFlashcardDeckProgress(reviews) : null;
  const currentReview = reviews ? reviews[index] : undefined;
  const reviewsReady = reviews !== null;
  const pct =
    progress && progress.cardCount > 0
      ? Math.round((progress.reviewedCount / progress.cardCount) * 100)
      : 0;

  const goTo = (next: number) => {
    setRevealed(false);
    setIndex(() => Math.max(0, Math.min(cardCount - 1, next)));
  };

  // Keyboard access for the card reader: the deck is one focusable group, so
  // arrows page through cards and space/enter reveals the answer.
  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      setRevealed((r) => !r);
    }
  };

  useEffect(() => {
    if (artifact.status !== "COMPLETED" || !content) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    getFlashcardReviewsForWorkspace(kbId, artifact.id)
      .then((rows) => {
        if (cancelled) return;
        setReviews(rows);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load review progress");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kbId, artifact.id, content]);

  const mark = async (verdict: "AGAIN" | "KNOWN") => {
    if (!content || busy || !reviewsReady) return;
    setBusy(true);
    setError(null);
    try {
      const updated = await markFlashcardReviewForWorkspace(kbId, artifact.id, index, verdict);
      setReviews((prev) =>
        prev ? prev.map((r) => (r.cardId === updated.cardId ? updated : r)) : prev,
      );
      setRevealed(false);
      if (index < cardCount - 1) setIndex((i) => i + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record your review");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-surface" aria-label="Flashcards artifact">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-text-primary">
              {artifact.name || "Untitled flashcards"}
            </h2>
            <ArtifactStatusBadge status={artifact.status} />
          </div>
          <p className="mt-1 text-xs text-text-tertiary">
            {new Date(artifact.createdAt).toLocaleString()}
            {artifact.sourceIds.length > 0 &&
              ` · ${artifact.sourceIds.length} source${artifact.sourceIds.length !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </header>

      <div className="p-5">
        {artifact.status === "PENDING" && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 size={16} className="animate-spin text-text-tertiary" />
            Waiting to be processed.
          </div>
        )}

        {artifact.status === "PROCESSING" && (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 size={16} className="animate-spin text-text-tertiary" />
            This deck is still being generated.
          </div>
        )}

        {artifact.status === "FAILED" && (
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>This deck failed to generate. You can try again from a new source selection.</p>
          </div>
        )}

        {artifact.status === "COMPLETED" &&
          (!content ? (
            <div className="flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
              <p>This deck&apos;s content is unavailable to display.</p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="section-title">{content.title}</h3>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
                    <span className="tabular-nums">
                      Card {index + 1} of {cardCount}
                    </span>
                    {currentReview && (
                      <span
                        className={`rounded-md px-1.5 py-0.5 text-[11px] font-medium ${
                          STATUS_CHIP[currentReview.status].klass
                        }`}
                      >
                        {STATUS_CHIP[currentReview.status].label}
                      </span>
                    )}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-text-secondary">
                  {loading ? (
                    <Loader2 size={14} className="animate-spin text-text-tertiary" />
                  ) : (
                    <CheckCircle2 size={14} className="text-success" />
                  )}
                  {progress
                    ? `${progress.reviewedCount}/${progress.cardCount} reviewed · ${progress.knownCount} known · ${progress.learningCount} learning${
                        progress.totalReviews > progress.reviewedCount
                          ? ` · ${progress.totalReviews} total reviews`
                          : ""
                      }`
                    : `${cardCount} cards`}
                </span>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div
                  role="progressbar"
                  aria-valuenow={progress?.reviewedCount ?? 0}
                  aria-valuemin={0}
                  aria-valuemax={progress?.cardCount ?? cardCount}
                  aria-label="Cards reviewed"
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-hover"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width]"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="shrink-0 text-[11px] font-medium tabular-nums text-text-tertiary">
                  {pct}%
                </span>
              </div>

              {current ? (
                <div
                  role="group"
                  aria-label="Flashcard. Left and right arrows change cards; space reveals the answer."
                  tabIndex={0}
                  onKeyDown={handleCardKeyDown}
                  className="mt-4 rounded-xl border border-border p-6 outline-none transition-colors focus-visible:border-brand focus-visible:ring-1 focus-visible:ring-brand"
                >
                  <div className="text-center">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                      Prompt
                    </p>
                    <p className="mt-3 text-lg font-medium leading-snug text-text-primary">
                      {current.front}
                    </p>
                  </div>
                  <div className="mx-auto my-5 h-px w-full max-w-xs bg-border" />
                  <div className="min-h-20">
                    {revealed ? (
                      <div className="rounded-lg bg-bg-secondary px-4 py-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
                          Answer
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-text-primary">
                          {current.back}
                        </p>
                      </div>
                    ) : (
                      <p className="pt-6 text-center text-sm text-text-tertiary">
                        Reveal the answer to check yourself.
                      </p>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRevealed((r) => !r)}
                      disabled={busy}
                    >
                      {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                      {revealed ? "Hide answer" : "Reveal answer"}
                    </Button>
                    {revealed && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy || !reviewsReady}
                          onClick={() => mark("AGAIN")}
                        >
                          <XCircle size={13} />
                          Again
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busy || !reviewsReady}
                          onClick={() => mark("KNOWN")}
                        >
                          <CheckCircle2 size={13} />
                          Know it
                        </Button>
                      </>
                    )}
                  </div>
                  {!reviewsReady && (
                    <p className="mt-2 text-center text-[11px] text-text-tertiary">
                      Loading your review progress…
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-border p-6 text-center text-sm text-text-tertiary">
                  No cards in this deck.
                </div>
              )}

              {progress && progress.complete && (
                <div className="mt-4 flex flex-wrap items-center justify-center gap-2 rounded-lg bg-brand/5 px-3 py-3 text-sm text-brand">
                  <PartyPopper size={15} />
                  <span>Deck complete — every card has been reviewed at least once.</span>
                  <button
                    onClick={() => {
                      setRevealed(false);
                      setIndex(0);
                    }}
                    className="rounded-md font-semibold underline-offset-2 transition-colors hover:underline"
                  >
                    Review again
                  </button>
                </div>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
                >
                  {error}
                </p>
              )}

              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => goTo(index - 1)}
                  disabled={index === 0}
                >
                  <ChevronLeft size={13} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => goTo(index + 1)}
                  disabled={cardCount === 0 || index >= cardCount - 1}
                >
                  Next
                  <ChevronRight size={13} />
                </Button>
              </div>

              {artifact.sourceIds.length > 0 && (
                <div className="mt-5 rounded-lg border border-border p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                    Revisit the sources behind this deck
                  </h4>
                  <p className="mt-1 text-xs text-text-secondary">
                    Missed something? Go back to where the material came from.
                  </p>
                  <ArtifactSourceList artifact={artifact} sources={sources} />
                </div>
              )}
            </div>
          ))}
      </div>
    </section>
  );
}

const STATUS_CHIP: Record<FlashcardReviewData["status"], { label: string; klass: string }> = {
  NEW: { label: "Not reviewed", klass: "bg-surface-hover text-text-tertiary" },
  LEARNING: { label: "Learning", klass: "bg-brand/10 text-brand" },
  KNOWN: { label: "Known", klass: "bg-success/10 text-success" },
};