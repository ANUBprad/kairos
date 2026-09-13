"use client";

import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { parseQuizContent } from "@/lib/artifacts/quiz-view";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

// Client-side study interaction only: answers and revealed state live in React
// state and are never persisted. The generated artifact itself stays immutable.
export function QuizArtifactViewer({ artifact, sources: _sources, onClose }: Props) {
  const content = parseQuizContent(artifact.content);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());

  const score = content ? content.questions.filter((q, i) => answers[i] === q.correctAnswer).length : 0;

  const selectOption = (questionIndex: number, optionIndex: number) => {
    if (revealed.has(questionIndex)) return;
    setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }));
  };

  const reveal = (questionIndex: number) => {
    if (answers[questionIndex] === undefined) return;
    setRevealed((prev) => new Set(prev).add(questionIndex));
  };

  const reset = () => {
    setAnswers({});
    setRevealed(new Set());
  };

  return (
    <section className="rounded-xl border border-border bg-surface" aria-label="Quiz artifact">
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-text-primary">
              {artifact.name || "Untitled quiz"}
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
            This quiz is still being generated.
          </div>
        )}

        {artifact.status === "FAILED" && (
          <div className="flex items-start gap-2 text-sm text-error">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p>This quiz failed to generate. You can try again from a new source selection.</p>
          </div>
        )}

        {artifact.status === "COMPLETED" &&
          (!content ? (
            <div className="flex items-start gap-2 text-sm text-text-secondary">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-text-tertiary" />
              <p>This quiz&apos;s content is unavailable to display.</p>
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">{content.title}</h3>
                  <p className="mt-1 text-xs text-text-tertiary">{content.instructions}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-secondary">
                    {score}/{content.questions.length} correct
                  </span>
                  <Button variant="ghost" size="sm" onClick={reset} aria-label="Reset quiz">
                    <RotateCcw size={13} />
                    Reset
                  </Button>
                </div>
              </div>

              <ol className="mt-5 space-y-5">
                {content.questions.map((question, qi) => {
                  const selected = answers[qi];
                  const isRevealed = revealed.has(qi);
                  const isCorrect = selected === question.correctAnswer;
                  return (
                    <li key={qi} className="rounded-lg border border-border p-4">
                      <p className="text-sm font-medium text-text-primary">
                        {qi + 1}. {question.question}
                      </p>
                      <div className="mt-3 space-y-1.5">
                        {question.options.map((option, oi) => {
                          const isSelected = selected === oi;
                          const isAnswer = oi === question.correctAnswer;
                          const stateClass = !isRevealed
                            ? isSelected
                              ? "border-brand bg-brand/5"
                              : "border-border hover:bg-surface-hover"
                            : isAnswer
                              ? "border-success bg-success/10"
                              : isSelected
                                ? "border-error bg-error/10"
                                : "border-border opacity-60";
                          return (
                            <button
                              key={oi}
                              disabled={isRevealed}
                              onClick={() => selectOption(qi, oi)}
                              className={`flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm text-text-secondary transition-colors ${stateClass}`}
                            >
                              <span className="w-4 shrink-0 text-xs font-medium text-text-tertiary">
                                {String.fromCharCode(65 + oi)}
                              </span>
                              <span>{option}</span>
                              {isRevealed && isAnswer && (
                                <CheckCircle2 size={14} className="ml-auto shrink-0 text-success" />
                              )}
                              {isRevealed && isSelected && !isAnswer && (
                                <XCircle size={14} className="ml-auto shrink-0 text-error" />
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {!isRevealed ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="mt-3"
                          disabled={selected === undefined}
                          onClick={() => reveal(qi)}
                        >
                          Reveal answer
                        </Button>
                      ) : (
                        <div
                          className={`mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${
                            isCorrect ? "bg-success/10 text-success" : "bg-error/10 text-error"
                          }`}
                        >
                          {isCorrect ? (
                            <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
                          ) : (
                            <XCircle size={15} className="mt-0.5 shrink-0" />
                          )}
                          <div>
                            <p className="font-medium">
                              {isCorrect ? "Correct" : "Incorrect"}
                            </p>
                            {!isCorrect && (
                              <p className="mt-0.5">
                                Correct answer: {question.options[question.correctAnswer]}
                              </p>
                            )}
                            <p className="mt-1 text-text-secondary">{question.explanation}</p>
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
      </div>
    </section>
  );
}