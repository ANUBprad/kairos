"use client";

import Link from "next/link";
import { BookOpen, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ARTIFACT_TYPE_META,
  isActiveStudioArtifactType,
} from "@/components/app/studio/artifact-type-meta";
import { flashcardsStudyLine } from "@/components/app/studio/artifact-list";
import { parseFlashcardsContent } from "@/lib/artifacts/flashcards-view";
import { studyArtifactHref } from "@/lib/study/hrefs";
import { WorkspaceHeader } from "@/components/app/kb-workspace-tabs";
import type { StudyDashboardData } from "@/lib/study/dashboard";
import type { LearningArtifactWithStudy } from "@/lib/artifacts/types";

interface Props {
  kbId: string;
  kbName: string;
  data: StudyDashboardData;
}

// Attempts is a distinct-reviewed-cards count for decks (one review row per
// card), so "reviewed" below never inflates with repeat verdict marks; the
// helper appends the honest grand total of reviews only when it exceeds that.
function studyLine(artifact: LearningArtifactWithStudy): string {
  const study = artifact.study;
  if (artifact.type === "QUIZ") {
    return study && study.attempts > 0
      ? `Took it ${study.attempts}× · best ${study.bestScore ?? 0}/${study.totalQuestions ?? 0}`
      : "Not taken yet";
  }
  return study && study.attempts > 0
    ? flashcardsStudyLine(study, artifact.content)
    : "Not reviewed yet";
}

function deckComplete(artifact: LearningArtifactWithStudy): boolean {
  if (artifact.type !== "FLASHCARDS") return false;
  const cardCount = parseFlashcardsContent(artifact.content)?.cards.length ?? null;
  return cardCount !== null && cardCount > 0 && (artifact.study?.attempts ?? 0) >= cardCount;
}

function isStudied(artifact: LearningArtifactWithStudy): boolean {
  const study = artifact.study;
  return !!study && (study.attempts > 0 || (study.reviewCount ?? 0) > 0);
}

function continueLabel(artifact: LearningArtifactWithStudy): string {
  return artifact.type === "QUIZ" ? "Retake quiz" : deckComplete(artifact) ? "Review again" : "Review deck";
}

// Reviewed percent for a deck's thin progress bar; null when card count is
// unknown (quiz or unparseable content) so we draw nothing rather than a lie.
function deckPercent(artifact: LearningArtifactWithStudy): number | null {
  if (artifact.type !== "FLASHCARDS") return null;
  const total = parseFlashcardsContent(artifact.content)?.cards.length ?? 0;
  if (total === 0) return null;
  const reviewed = Math.min(artifact.study?.attempts ?? 0, total);
  return Math.round((reviewed / total) * 100);
}

function ArtifactTitle({ artifact }: { artifact: LearningArtifactWithStudy }) {
  const meta = isActiveStudioArtifactType(artifact.type) ? ARTIFACT_TYPE_META[artifact.type] : null;
  const href = studyArtifactHref(artifact.knowledgeBaseId, artifact.id);
  const title = artifact.name || `Untitled ${meta?.label.toLowerCase() ?? "artifact"}`;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {meta ? <meta.Icon size={14} className="shrink-0 text-text-tertiary" /> : null}
      <Link
        href={href}
        className="truncate text-sm font-medium text-text-primary transition-colors hover:text-brand"
      >
        {title}
      </Link>
      {meta ? (
        <Badge variant="secondary" className="shrink-0">
          {meta.label}
        </Badge>
      ) : null}
    </div>
  );
}

function DeckBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 flex max-w-xs items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
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
  );
}

function ResumeHero({ artifact }: { artifact: LearningArtifactWithStudy }) {
  const href = studyArtifactHref(artifact.knowledgeBaseId, artifact.id);
  const pct = deckPercent(artifact);
  return (
    <section className="rounded-xl border border-border bg-surface p-5" aria-label="Continue studying">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        Continue studying
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <ArtifactTitle artifact={artifact} />
          <p className="mt-1 text-sm text-text-secondary">{studyLine(artifact)}</p>
          {pct !== null && <DeckBar pct={pct} />}
        </div>
        <Button variant="primary" size="sm" asChild>
          <Link href={href}>{continueLabel(artifact)}</Link>
        </Button>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface p-5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
        {label}
      </dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">{value}</dd>
    </div>
  );
}

function StudySetRow({ artifact }: { artifact: LearningArtifactWithStudy }) {
  const href = studyArtifactHref(artifact.knowledgeBaseId, artifact.id);
  const complete = deckComplete(artifact);
  const pct = deckPercent(artifact);
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <ArtifactTitle artifact={artifact} />
          {complete ? (
            <Badge variant="success" className="shrink-0 gap-1">
              <Check size={11} />
              Deck complete
            </Badge>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-text-secondary">
          {studyLine(artifact)}
          <span className="text-text-tertiary"> · {new Date(artifact.createdAt).toLocaleDateString()}</span>
        </p>
        {pct !== null && <DeckBar pct={pct} />}
      </div>
      <Button variant="secondary" size="sm" asChild className="shrink-0">
        <Link href={href}>{isStudied(artifact) ? continueLabel(artifact) : "Start"}</Link>
      </Button>
    </li>
  );
}

export function StudyDashboard({ kbId, kbName, data }: Props) {
  const { artifacts, summary, recentAttempts } = data;
  const resume = artifacts.find(isStudied);
  const hasRecent = recentAttempts.length > 0;

  return (
    <div>
      <WorkspaceHeader
        kbId={kbId}
        kbName={kbName}
        title="Study"
        description="Your study state across the artifacts in this workspace."
        active="study"
        action={
          <Button variant="secondary" size="sm" asChild>
            <Link href={`/app/knowledge-bases/${kbId}/studio`}>
              <Sparkles size={14} />
              Studio
            </Link>
          </Button>
        }
      />

      {artifacts.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-5 py-16 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand/10">
            <BookOpen size={22} className="text-brand" />
          </span>
          <p className="mt-4 text-base font-semibold text-text-primary">No study content yet</p>
          <p className="mt-1 max-w-sm text-sm text-text-secondary">
            Generate a quiz or flashcard deck in Studio, then study from here.
          </p>
          <Link href={`/app/knowledge-bases/${kbId}/studio`} className="mt-5">
            <Button variant="primary" size="sm">
              <Sparkles size={14} />
              Open Studio
            </Button>
          </Link>
        </section>
      ) : (
        <>
          {resume && <ResumeHero artifact={resume} />}

          <section
            className="mt-6 overflow-hidden rounded-xl border border-border bg-surface"
            aria-label="Study overview"
          >
            <dl className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
              <Stat label="Quizzes taken" value={summary.quizzesTaken} />
              <Stat label="Cards known" value={summary.cardsKnown} />
              <Stat label="Card reviews" value={summary.cardReviews} />
              <Stat label="Artifacts studied" value={summary.studiedArtifacts} />
            </dl>
            <p className="border-t border-border px-5 py-3 text-xs text-text-tertiary">
              Cards known = flashcards currently marked Known. Card reviews = total verdict marks
              recorded, including repeats.
            </p>
          </section>

          <div
            className={`mt-6 grid gap-6 ${hasRecent ? "lg:grid-cols-[minmax(0,1fr)_20rem]" : ""}`}
          >
            <section
              className="overflow-hidden rounded-xl border border-border bg-surface"
              aria-label="Study sets"
            >
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="section-title">Study sets</h2>
                <span className="text-xs font-medium text-text-tertiary">
                  {artifacts.length} artifact{artifacts.length !== 1 ? "s" : ""}
                </span>
              </header>
              <ul className="divide-y divide-border">
                {artifacts.map((artifact) => (
                  <StudySetRow key={artifact.id} artifact={artifact} />
                ))}
              </ul>
            </section>

            {hasRecent && (
              <aside
                className="self-start overflow-hidden rounded-xl border border-border bg-surface"
                aria-label="Recent quizzes"
              >
                <header className="border-b border-border px-5 py-4">
                  <h2 className="section-title">Recent quizzes</h2>
                  <p className="mt-1 text-xs text-text-tertiary">
                    Last {recentAttempts.length} completed
                  </p>
                </header>
                <ul className="divide-y divide-border">
                  {recentAttempts.map((attempt) => (
                    <li key={attempt.id} className="flex items-center gap-3 px-5 py-3">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={studyArtifactHref(kbId, attempt.artifactId)}
                          className="block truncate text-sm font-medium text-text-primary transition-colors hover:text-brand"
                        >
                          {attempt.artifactName || "Untitled quiz"}
                        </Link>
                        <p className="mt-0.5 text-xs text-text-tertiary">
                          {new Date(attempt.completedAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0 tabular-nums">
                        {attempt.score}/{attempt.totalQuestions}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
