"use client";

import React, { useState } from "react";
import { QuizQuestion } from "../types";
import { CheckCircle2, HelpCircle, RefreshCw, Trophy, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuizViewerProps {
  questions: QuizQuestion[];
}

export function QuizViewer({ questions }: QuizViewerProps) {
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [showResults, setShowResults] = useState(false);

  if (!questions || questions.length === 0) {
    return (
      <div className="kairos-inset space-y-2 px-5 py-8 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <HelpCircle className="size-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">No quiz questions yet</p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          Generated questions will appear here when they are available.
        </p>
      </div>
    );
  }

  const handleSelectOption = (questionIndex: number, optionIndex: number) => {
    if (showResults) return;
    setUserAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
  };

  const calculateScore = () => {
    let score = 0;
    questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.correctIndex) {
        score += 1;
      }
    });
    return score;
  };

  const handleReset = () => {
    setUserAnswers({});
    setShowResults(false);
  };

  const isAllAnswered = questions.every((_, idx) => userAnswers[idx] !== undefined);
  const score = calculateScore();

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 select-none">
      {/* Score Banner when completed */}
      {showResults && (
        <div className="kairos-panel space-y-3 px-6 py-6 text-center animate-fadeIn motion-reduce:animate-none">
          <div className="kairos-inset mx-auto flex size-12 items-center justify-center rounded-full text-primary">
            <Trophy className="size-6" />
          </div>
          <div>
            <p className="kairos-eyebrow">Session complete</p>
            <h3 className="kairos-display mt-1 text-2xl">Quiz complete</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              You scored <span className="font-bold text-foreground">{score}</span> out of{" "}
              <span className="font-bold text-foreground">{questions.length}</span> (
              {Math.round((score / questions.length) * 100)}%)
            </p>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 motion-reduce:transition-none"
          >
            <RefreshCw className="size-3.5" />
            <span>Retake quiz</span>
          </button>
        </div>
      )}

      {/* Questions list */}
      <div className="space-y-5">
        <div>
          <p className="kairos-eyebrow">Practice set</p>
          <h3 className="kairos-section-title mt-1 text-base">
            {questions.length} {questions.length === 1 ? "question" : "questions"}
          </h3>
        </div>

        {questions.map((q, qIndex) => {
          const selectedOption = userAnswers[qIndex];

          return (
            <section
              key={qIndex}
              className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-panel)]"
            >
              {/* Question text */}
              <div className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-brand-soft font-mono text-xs font-semibold text-primary">
                  {qIndex + 1}
                </span>
                <p className="text-sm leading-relaxed font-medium text-foreground">
                  {q.question}
                </p>
              </div>

              {/* Options list */}
              <div className="space-y-2 pl-9">
                {q.options.map((opt, optIndex) => {
                  const isSelected = selectedOption === optIndex;
                  const isCorrect = optIndex === q.correctIndex;

                  let optionStyle =
                    "border-border bg-surface hover:border-brand/40 hover:bg-brand-quiet/60 text-foreground";

                  if (showResults) {
                    if (isCorrect) {
                      optionStyle =
                        "border-success/50 bg-success/10 text-success font-medium";
                    } else if (isSelected && !isCorrect) {
                      optionStyle =
                        "border-danger/50 bg-danger/10 text-danger";
                    }
                  } else if (isSelected) {
                    optionStyle =
                      "border-primary bg-brand-soft font-medium shadow-[var(--shadow-panel)]";
                  }

                  return (
                    <button
                      key={optIndex}
                      type="button"
                      onClick={() => handleSelectOption(qIndex, optIndex)}
                      aria-pressed={isSelected}
                      className={cn(
                        "flex w-full items-center justify-between rounded-xl border p-3 text-left text-xs transition-colors cursor-pointer motion-reduce:transition-none",
                        optionStyle
                      )}
                    >
                      <span className="pr-3 leading-relaxed">{opt}</span>
                      {showResults && isCorrect && (
                        <CheckCircle2 className="size-4 shrink-0 text-success" />
                      )}
                      {showResults && isSelected && !isCorrect && (
                        <XCircle className="size-4 shrink-0 text-danger" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Explanation Reveal */}
              {showResults && q.explanation && (
                <div className="ml-9 space-y-1 rounded-xl border border-border bg-brand-quiet/60 p-3 text-xs text-muted-foreground">
                  <span className="block font-semibold text-foreground">
                    Why this works
                  </span>
                  <p className="leading-relaxed">{q.explanation}</p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      {/* Submit button */}
      {!showResults && (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-muted-foreground">
            {isAllAnswered
              ? "Ready when you are."
              : "Answer every question to check your score."}
          </p>
          <button
            type="button"
            onClick={() => setShowResults(true)}
            disabled={!isAllAnswered}
            className="rounded-full bg-primary px-6 py-2.5 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          >
            Submit &amp; check answers
          </button>
        </div>
      )}
    </div>
  );
}
