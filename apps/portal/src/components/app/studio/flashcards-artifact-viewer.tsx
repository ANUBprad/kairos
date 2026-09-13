"use client";

import { useState } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, Eye, EyeOff, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { parseFlashcardsContent } from "@/lib/artifacts/flashcards-view";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

// Client-side study interaction only: the current card and reveal state live
// in React state and are never persisted. The generated artifact stays intact.
export function FlashcardsArtifactViewer({ artifact, sources: _sources, onClose }: Props) {
  const content = parseFlashcardsContent(artifact.content);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const cardCount = content?.cards.length ?? 0;
  const current = content?.cards[index];

  const goNext = () => {
    setRevealed(false);
    setIndex((i) => Math.min(cardCount - 1, i + 1));
  };

  const goPrev = () => {
    setRevealed(false);
    setIndex((i) => Math.max(0, i - 1));
  };

  const reset = () => {
    setIndex(0);
    setRevealed(false);
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
                <Button variant="ghost" size="sm" onClick={reset} aria-label="Reset deck">
                  <RotateCcw size={13} />
                  Reset
                </Button>
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
                  <Button variant="secondary" size="sm" onClick={() => setRevealed((r) => !r)}>
                    {revealed ? <EyeOff size={13} /> : <Eye size={13} />}
                    {revealed ? "Hide back" : "Reveal back"}
                  </Button>
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-border p-6 text-center text-sm text-text-tertiary">
                  No cards in this deck.
                </div>
              )}

              <div className="mt-4 flex items-center justify-between">
                <Button variant="secondary" size="sm" onClick={goPrev} disabled={index === 0}>
                  <ChevronLeft size={13} />
                  Previous
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={goNext}
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