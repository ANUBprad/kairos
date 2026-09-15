"use client";

import { useEffect, useState } from "react";
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
import { parseFlashcardsContent } from "@/lib/artifacts/flashcards-view";
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
// survive reload. Marking a card records a verdict server-side; progress is the
// share of cards currently KNOWN.
export function FlashcardsArtifactViewer({ artifact, sources: _sources, onClose }: Props) {
  const content = parseFlashcardsContent(artifact.content);
  const kbId = artifact.knowledgeBaseId;
  const [reviews, setReviews] = useState<FlashcardReviewData[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cardCount = content?.cards.length ?? 0;
  const current = content?.cards[index];
  const knownCount = reviews?.filter((r) => r.status === "KNOWN").length ?? 0;

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
    if (!content || busy) return;
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
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{content.title}</h3>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Card {index + 1} of {cardCount}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium text-text-secondary">
                  {loading ? (
                    <Loader2 size={14} className="animate-spin text-text-tertiary" />
                  ) : (
                    <CheckCircle2 size={14} className="text-success" />
                  )}
                  {knownCount}/{cardCount} known
                </span>
              </div>

              {current ? (
                <div className="mt-4 rounded-xl border border-border p-6 text-center">
                  <p className="text-sm font-medium text-text-primary">{current.front}</p>
                  <div className="mx-auto my-4 h-px w-full max-w-xs bg-border" />
                  <div className="min-h-16">
                    {revealed ? (
                      <p className="text-sm leading-relaxed text-text-secondary">{current.back}</p>
                    ) : (
                      <p className="text-sm text-text-tertiary">Reveal the back to check yourself.</p>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setRevealed((r) => !r)}
                      disabled={busy}
                    >
                      {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                      {revealed ? "Hide back" : "Reveal back"}
                    </Button>
                    {revealed && (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={busy}
                          onClick={() => mark("AGAIN")}
                        >
                          <XCircle size={13} />
                          Again
                        </Button>
                        <Button
                          variant="primary"
                          size="sm"
                          disabled={busy}
                          onClick={() => mark("KNOWN")}
                        >
                          <CheckCircle2 size={13} />
                          Know it
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-border p-6 text-center text-sm text-text-tertiary">
                  No cards in this deck.
                </div>
              )}

              {reviewedAll(cardCount, index) && reviews && (
                <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-brand/5 px-3 py-3 text-sm text-brand">
                  <PartyPopper size={15} />
                  You&apos;ve reviewed every card. Keep going to lock them all as known.
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
                  onClick={() => {
                    setRevealed(false);
                    setIndex((i) => Math.max(0, i - 1));
                  }}
                  disabled={index === 0}
                >
                  <ChevronLeft size={13} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setRevealed(false);
                    setIndex((i) => Math.min(cardCount - 1, i + 1));
                  }}
                  disabled={cardCount === 0 || index >= cardCount - 1}
                >
                  Next
                  <ChevronRight size={13} />
                </Button>
              </div>
            </div>
          ))}
      </div>
    </section>
  );
}

function reviewedAll(cardCount: number, index: number): boolean {
  return cardCount > 0 && index >= cardCount - 1;
}