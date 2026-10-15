"use client";

import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, RotateCcw, Sparkles, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ArtifactStatusBadge } from "./artifact-status-badge";
import { ArtifactSourceList } from "./artifact-source-list";
import { parseQuizContent } from "@/lib/artifacts/quiz-view";
import {
  getQuizAttemptForWorkspace,
  getQuizAttemptHistoryForWorkspace,
  startQuizAttemptForWorkspace,
  submitQuizAttemptForWorkspace,
  type QuizAttemptData,
  type QuizAttemptSummary,
} from "@/lib/actions/study-quiz";
import type { LearningArtifactData } from "@/lib/artifacts/types";

interface Props {
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  onClose: () => void;
}

type View =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "start" }
  | { kind: "answering"; attempt: QuizAttemptData }
  | { kind: "submitting"; attempt: QuizAttemptData }
  | { kind: "results"; attempt: QuizAttemptData };

// Study interaction is now persisted: attempts, per-question answer grading and
// the final score live in the DB and survive reload. Correctness is always
// computed by the server (submitQuizAttemptForWorkspace); this component only
// collects the caller's { questionId, selectedAnswer } and renders the result.
export function QuizArtifactViewer({ artifact, sources, onClose }: Props) {
  // parseQuizContent returns a fresh object each call, so memoizing on the
  // stable artifact.content keeps it out of the load effect's dependency list;
  // otherwise the effect would re-run (and re-fetch) on every render.
  const content = useMemo(() => parseQuizContent(artifact.content), [artifact.content]);
  const kbId = artifact.knowledgeBaseId;
  const [view, setView] = useState<View>({ kind: "loading" });
  const [history, setHistory] = useState<QuizAttemptSummary[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (artifact.status !== "COMPLETED" || !content) return;
    let cancelled = false;
    setView({ kind: "loading" });
    setActionError(null);
    Promise.all([
      getQuizAttemptForWorkspace(kbId, artifact.id),
      getQuizAttemptHistoryForWorkspace(kbId, artifact.id),
    ])
      .then(([attempt, history]) => {
        if (cancelled) return;
        setHistory(history);
        setView(
          attempt && attempt.status === "COMPLETED"
            ? { kind: "results", attempt }
            : attempt && attempt.status === "PENDING"
              ? { kind: "answering", attempt }
              : { kind: "start" },
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setView({ kind: "error", message: err instanceof Error ? err.message : "Failed to load your attempts" });
      });
    return () => {
      cancelled = true;
    };
  }, [kbId, artifact.id, content]);

  const start = async () => {
    setActionError(null);
    try {
      const attempt = await startQuizAttemptForWorkspace(kbId, artifact.id);
      setAnswers({});
      setView({ kind: "answering", attempt });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start the quiz");
    }
  };

  const submit = async () => {
    const attempt = view.kind === "answering" ? view.attempt : null;
    if (!attempt) return;
    setView({ kind: "submitting", attempt });
    setActionError(null);
    try {
      const list = Object.entries(answers).map(([questionId, selectedAnswer]) => ({
        questionId: Number(questionId),
        selectedAnswer,
      }));
      const completed = await submitQuizAttemptForWorkspace(kbId, attempt.id, list);
      setView({ kind: "results", attempt: completed });
    } catch (err) {
      setView({ kind: "answering", attempt });
      setActionError(err instanceof Error ? err.message : "Failed to submit the quiz");
    }
  };

  const tryAgain = async () => {
    setActionError(null);
    try {
      const attempt = await startQuizAttemptForWorkspace(kbId, artifact.id);
      setAnswers({});
      setView({ kind: "answering", attempt });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to start a new attempt");
    }
  };

  const resumeView = view.kind === "answering" || view.kind === "submitting" ? view : null;
  const resultsAttempt = view.kind === "results" ? view.attempt : null;
  const answeredCount = Object.keys(answers).length;

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
          ) : view.kind === "loading" ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="animate-spin text-text-tertiary" />
            </div>
          ) : view.kind === "error" ? (
            <div className="flex flex-col items-center gap-3 py-12">
              <p className="text-sm text-text-secondary">{view.message}</p>
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
                Reload
              </Button>
            </div>
          ) : resultsAttempt ? (
            <QuizResults
              content={content}
              attempt={resultsAttempt}
              artifactName={artifact.name ?? ""}
              artifact={artifact}
              sources={sources}
              history={history}
              onClose={onClose}
              onTryAgain={tryAgain}
            />
          ) : resumeView ? (
            <AnswerQuiz
              content={content}
              answers={answers}
              onSelect={(questionIndex, optionIndex) =>
                setAnswers((prev) => ({ ...prev, [questionIndex]: optionIndex }))
              }
              onReset={() => setAnswers({})}
              onSubmit={submit}
              submitting={resumeView.kind === "submitting"}
              answeredCount={answeredCount}
            />
          ) : (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">{content.title}</h3>
                <p className="mx-auto mt-2 max-w-sm text-xs text-text-secondary">
                  {content.instructions}
                </p>
                <p className="mt-1 text-xs text-text-tertiary">
                  {content.questions.length} question{content.questions.length !== 1 ? "s" : ""}
                </p>
                {history.length > 0 && (
                  <p className="mt-1 text-xs text-text-secondary">
                    Taken {history.length}× · best{" "}
                    {Math.max(...history.map((h) => h.score))}/{history[0].totalQuestions}
                  </p>
                )}
              </div>
              <Button variant="primary" size="sm" onClick={start}>
                <Sparkles size={13} />
                Start quiz
              </Button>
              {actionError && (
                <p role="alert" className="text-sm text-error">
                  {actionError}
                </p>
              )}
            </div>
          ))}
      </div>
    </section>
  );
}

function AnswerQuiz({
  content,
  answers,
  onSelect,
  onReset,
  onSubmit,
  submitting,
  answeredCount,
}: {
  content: NonNullable<ReturnType<typeof parseQuizContent>>;
  answers: Record<number, number>;
  onSelect: (questionIndex: number, optionIndex: number) => void;
  onReset: () => void;
  onSubmit: () => void;
  submitting: boolean;
  answeredCount: number;
}) {
  const allAnswered = answeredCount === content.questions.length;

  // Roving focus for the option radiogroup: arrow keys move (and select, per the
  // selection-follows-focus convention) so the group is one tab stop, not N.
  const handleOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    questionIndex: number,
    optionIndex: number,
    optionCount: number,
  ) => {
    const offset =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (offset === 0) return;
    event.preventDefault();
    const nextIndex = (optionIndex + offset + optionCount) % optionCount;
    onSelect(questionIndex, nextIndex);
    const group = event.currentTarget.closest<HTMLElement>('[role="radiogroup"]');
    group?.querySelectorAll<HTMLButtonElement>('[role="radio"]')[nextIndex]?.focus();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="section-title">{content.title}</h3>
          <p className="mt-1 text-sm text-text-secondary">{content.instructions}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-xs font-medium tabular-nums text-text-secondary">
            {answeredCount}/{content.questions.length} answered
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            disabled={submitting || answeredCount === 0}
            aria-label="Reset answers"
          >
            <RotateCcw size={13} />
            Reset
          </Button>
        </div>
      </div>

      <ol className="mt-6 divide-y divide-border">
        {content.questions.map((question, qi) => {
          const selected = answers[qi];
          const questionId = `quiz-question-${qi}`;
          return (
            <li key={qi} className="py-6 first:pt-0">
              <p
                id={questionId}
                className="flex gap-2.5 text-[15px] font-medium leading-relaxed text-text-primary"
              >
                <span className="shrink-0 tabular-nums text-text-tertiary">{qi + 1}.</span>
                <span>{question.question}</span>
              </p>
              <div role="radiogroup" aria-labelledby={questionId} className="mt-3 space-y-1.5">
                {question.options.map((option, oi) => {
                  const isSelected = selected === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={isSelected || (selected === undefined && oi === 0) ? 0 : -1}
                      disabled={submitting}
                      onClick={() => onSelect(qi, oi)}
                      onKeyDown={(event) => handleOptionKeyDown(event, qi, oi, question.options.length)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left text-sm transition-colors disabled:opacity-50 ${
                        isSelected
                          ? "border-brand bg-brand/5 text-text-primary"
                          : "border-border text-text-secondary hover:border-border-hover hover:bg-surface-hover"
                      }`}
                    >
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold ${
                          isSelected
                            ? "border-brand bg-brand text-white"
                            : "border-border text-text-tertiary"
                        }`}
                      >
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span>{option}</span>
                    </button>
                  );
                })}
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-xs text-text-tertiary">
          Your answers are graded and stored when you finish.
        </p>
        <Button variant="primary" disabled={!allAnswered || submitting} onClick={onSubmit}>
          {submitting ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          {submitting ? "Submitting…" : "Submit quiz"}
        </Button>
      </div>
    </div>
  );
}

function QuizResults({
  content,
  attempt,
  artifactName,
  artifact,
  sources,
  history,
  onClose,
  onTryAgain,
}: {
  content: NonNullable<ReturnType<typeof parseQuizContent>>;
  attempt: QuizAttemptData;
  artifactName: string;
  artifact: LearningArtifactData;
  sources: { id: string; name: string | null }[];
  history: QuizAttemptSummary[];
  onClose: () => void;
  onTryAgain: () => void;
}) {
  const correct = attempt.answers.filter((a) => a.isCorrect).length;
  const byQuestion = new Map(attempt.answers.map((a) => [a.questionId, a]));
  const past = history.filter((h) => h.id !== attempt.id);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">
            {artifactName || content.title}
          </h3>
          <p className="mt-1 text-xs text-text-tertiary">
            Attempt submitted on {new Date(attempt.completedAt ?? new Date()).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-lg px-3 py-1 text-sm font-semibold ${
              correct / Math.max(attempt.totalQuestions, 1) >= 0.6
                ? "bg-success/10 text-success"
                : "bg-error/10 text-error"
            }`}
          >
            {attempt.score}/{attempt.totalQuestions} correct
          </span>
          <Button variant="secondary" size="sm" onClick={onTryAgain}>
            <RotateCcw size={13} />
            Try again
          </Button>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>

      <ol className="mt-6 divide-y divide-border">
        {content.questions.map((question, qi) => {
          const answer = byQuestion.get(qi);
          const isCorrect = answer?.isCorrect ?? false;
          return (
            <li key={qi} className="py-6 first:pt-0">
              <p className="flex gap-2.5 text-[15px] font-medium leading-relaxed text-text-primary">
                <span className="shrink-0 tabular-nums text-text-tertiary">{qi + 1}.</span>
                <span>{question.question}</span>
              </p>
              <div className="mt-3 space-y-1.5">
                {question.options.map((option, oi) => {
                  const isAnswer = oi === question.correctAnswer;
                  const isSelected = answer?.selectedAnswer === oi;
                  const stateClass = isAnswer
                    ? "border-success bg-success/10 text-text-primary"
                    : isSelected
                      ? "border-error bg-error/10 text-text-primary"
                      : "border-border text-text-secondary opacity-60";
                  return (
                    <div
                      key={oi}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3.5 py-2.5 text-sm ${stateClass}`}
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold opacity-70">
                        {String.fromCharCode(65 + oi)}
                      </span>
                      <span>{option}</span>
                      {isAnswer && (
                        <span className="ml-auto shrink-0 text-[11px] font-semibold uppercase tracking-wide text-success">
                          Correct answer
                        </span>
                      )}
                      {isSelected && !isAnswer && (
                        <span className="ml-auto shrink-0 text-[11px] font-semibold uppercase tracking-wide text-error">
                          Your answer
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <div
                className={`mt-3 flex items-start gap-2 rounded-lg px-3.5 py-3 text-sm ${
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
                    {isCorrect
                      ? `Correct${answer ? ` (option ${String.fromCharCode(65 + answer.selectedAnswer)})` : ""}`
                      : "Incorrect"}
                  </p>
                  {!isCorrect && (
                    <p className="mt-0.5">
                      Correct answer: {question.options[question.correctAnswer]}
                    </p>
                  )}
                  <p className="mt-1 text-text-secondary">{question.explanation}</p>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {artifact.sourceIds.length > 0 && (
        <div className="mt-6 rounded-lg border border-border p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Revisit the sources behind this quiz
          </h4>
          <p className="mt-1 text-xs text-text-secondary">
            Missed something? Go back to where the material came from.
          </p>
          <ArtifactSourceList artifact={artifact} sources={sources} />
        </div>
      )}

      {past.length > 0 && (
        <div className="mt-4 rounded-lg border border-border p-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Past attempts
          </h4>
          <ul className="mt-2 space-y-1">
            {past.map((h) => (
              <li key={h.id} className="flex items-center justify-between text-xs text-text-secondary">
                <span>{h.completedAt ? new Date(h.completedAt).toLocaleString() : "—"}</span>
                <span className="font-medium tabular-nums">
                  {h.score}/{h.totalQuestions}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}