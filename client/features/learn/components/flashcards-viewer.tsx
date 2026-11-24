"use client";

import React, { useState } from "react";
import { FlashcardItem } from "../types";
import { ChevronLeft, ChevronRight, Layers, RotateCw, Shuffle } from "lucide-react";

interface FlashcardsViewerProps {
  cards: FlashcardItem[];
}

export function FlashcardsViewer({ cards: initialCards }: FlashcardsViewerProps) {
  const [cards, setCards] = useState<FlashcardItem[]>(initialCards || []);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  if (!cards || cards.length === 0) {
    return (
      <div className="kairos-inset space-y-2 px-5 py-8 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <Layers className="size-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">No flashcards yet</p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          Generated flashcards will appear here when they are available.
        </p>
      </div>
    );
  }

  const currentCard = cards[currentIndex] as unknown as Record<string, unknown> | undefined;
  const frontText =
    (currentCard?.front as string) ||
    (currentCard?.question as string) ||
    (currentCard?.term as string) ||
    "No question text";
  const backText =
    (currentCard?.back as string) ||
    (currentCard?.answer as string) ||
    (currentCard?.definition as string) ||
    (currentCard?.explanation as string) ||
    "No answer text";

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % cards.length);
  };

  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + cards.length) % cards.length);
  };

  const handleShuffle = () => {
    setIsFlipped(false);
    const shuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(shuffled);
    setCurrentIndex(0);
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5 select-none">
      {/* Top Controls */}
      <div className="flex w-full flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <p className="kairos-eyebrow">Study deck</p>
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            Card {currentIndex + 1} of {cards.length}
          </p>
        </div>
        <button
          type="button"
          onClick={handleShuffle}
          aria-label="Shuffle flashcards"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground motion-reduce:transition-none"
        >
          <Shuffle className="size-3.5" />
          <span>Shuffle</span>
        </button>
      </div>

      {/* 3D Interactive Flip Card Container */}
      <div
        onClick={() => setIsFlipped(!isFlipped)}
        title="Flip card"
        className="h-72 w-full cursor-pointer sm:h-80"
        style={{ perspective: "1000px" }}
      >
        <div
          className="relative h-full w-full rounded-3xl shadow-[var(--shadow-lift)] transition-transform duration-500 motion-reduce:transition-none"
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front Face (Question) */}
          <div
            className="absolute inset-0 flex flex-col justify-between rounded-3xl border border-border bg-surface p-6 sm:p-8"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Question / Concept
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <RotateCw className="size-3 text-primary animate-pulse motion-reduce:animate-none" />
                Click to reveal answer
              </span>
            </div>

            <p className="my-auto max-h-40 overflow-y-auto px-2 text-center text-base leading-relaxed font-medium text-foreground sm:text-lg">
              {frontText}
            </p>

            <div className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              Front side
            </div>
          </div>

          {/* Back Face (Answer) */}
          <div
            className="absolute inset-0 flex flex-col justify-between rounded-3xl border border-primary/30 bg-brand-quiet p-6 sm:p-8"
            style={{
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Answer / Definition
              </span>
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <RotateCw className="size-3 text-primary" />
                Click to flip back
              </span>
            </div>

            <p className="my-auto max-h-40 overflow-y-auto px-2 text-center text-sm leading-relaxed text-foreground sm:text-base">
              {backText}
            </p>

            <div className="text-center font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/70">
              Back side
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Previous flashcard"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-brand-soft motion-reduce:transition-none"
        >
          <ChevronLeft className="size-4" />
          <span>Previous</span>
        </button>

        <button
          type="button"
          onClick={handleNext}
          aria-label="Next flashcard"
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-opacity hover:opacity-90 motion-reduce:transition-none"
        >
          <span>Next</span>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}
