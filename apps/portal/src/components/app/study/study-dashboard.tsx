"use client";

import Link from "next/link";
import { BookOpen, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-display";
import {
  ARTIFACT_TYPE_META,
  isActiveStudioArtifactType,
} from "@/components/app/studio/artifact-type-meta";
import { flashcardsStudyLine } from "@/components/app/studio/artifact-list";
import { parseFlashcardsContent } from "@/lib/artifacts/flashcards-view";
import { studyArtifactHref } from "@/lib/study/hrefs";
import { KbWorkspaceTabs } from "@/components/app/kb-workspace-tabs";
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

function ArtifactRow({
  artifact,
  action,
}: {
  artifact: LearningArtifactWithStudy;
  action: "continue" | "view";
}) {
  const meta = isActiveStudioArtifactType(artifact.type) ? ARTIFACT_TYPE_META[artifact.type] : null;
  const href = studyArtifactHref(artifact.knowledgeBaseId, artifact.id);
  const title = artifact.name || `Untitled ${meta?.label.toLowerCase() ?? "artifact"}`;
  const complete = deckComplete(artifact);

  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
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
          {complete ? (
            <Badge variant="success" className="shrink-0 gap-1">
              <Check size={11} />
              Deck complete
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-text-secondary">
          {studyLine(artifact)}
          <span className="text-text-tertiary">
            {" · "}
            {new Date(artifact.createdAt).toLocaleDateString()}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center">
        <Button variant={action === "continue" ? "primary" : "secondary"} size="sm" asChild>
          <Link href={href}>{action === "continue" ? continueLabel(artifact) : "View"}</Link>
        </Button>
      </div>
    </li>
  );
}

export function StudyDashboard({ kbId, kbName, data }: Props) {
  const { artifacts, summary, recentAttempts } = data;
  const continueList = artifacts.filter(isStudied).slice(0, 5);

  return (
    <div>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Study</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Your study state across the artifacts in {kbName}.
        </p>
        <KbWorkspaceTabs kbId={kbId} active="study" />
      </header>

      {artifacts.length === 0 ? (
        <section className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-5 py-14 text-center">
          <BookOpen size={24} className="text-text-tertiary" />
          <p className="mt-3 text-sm font-medium text-text-primary">No study content yet</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Generate a quiz or flashcards in Studio to begin studying.
          </p>
          <Link href={`/app/knowledge-bases/${kbId}/studio`} className="mt-4">
            <Button variant="primary" size="sm">
              <Sparkles size={14} />
              Open Studio
            </Button>
          </Link>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-border bg-surface p-5" aria-label="Study overview">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <MetricCard label="Quizzes taken" value={summary.quizzesTaken} />
              <MetricCard label="Cards known" value={summary.cardsKnown} />
              <MetricCard label="Card reviews" value={summary.cardReviews} />
              <MetricCard label="Artifacts studied" value={summary.studiedArtifacts} />
            </div>
            <p className="mt-3 text-xs text-text-tertiary">
              Cards known = flashcards currently marked KNOWN. Card reviews = total verdict
              marks recorded, including repeats.
            </p>
          </section>

          {continueList.length > 0 && (
            <section className="mt-6 rounded-xl border border-border bg-surface" aria-label="Continue studying">
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-text-primary">Continue studying</h2>
                <span className="text-xs font-medium text-text-tertiary">By last studied</span>
              </header>
              <ul className="divide-y divide-border">
                {continueList.map((artifact) => (
                  <ArtifactRow key={artifact.id} artifact={artifact} action="continue" />
                ))}
              </ul>
            </section>
          )}

          {recentAttempts.length > 0 && (
            <section className="mt-6 rounded-xl border border-border bg-surface" aria-label="Recent quizzes">
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <h2 className="text-base font-semibold text-text-primary">Recent quizzes</h2>
                <span className="text-xs font-medium text-text-tertiary">
                  Last {recentAttempts.length} completed
                </span>
              </header>
              <ul className="divide-y divide-border">
                {recentAttempts.map((attempt) => (
                  <li key={attempt.id} className="flex items-center gap-3 px-5 py-2.5">
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
                      Score {attempt.score}/{attempt.totalQuestions}
                    </Badge>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            className="mt-6 rounded-xl border border-border bg-surface"
            aria-label="Artifact study progress"
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-text-primary">Artifact study progress</h2>
              <span className="text-xs font-medium text-text-tertiary">
                {artifacts.length} study artifact{artifacts.length !== 1 ? "s" : ""}
              </span>
            </header>
            <ul className="divide-y divide-border">
              {artifacts.map((artifact) => (
                <ArtifactRow key={artifact.id} artifact={artifact} action="view" />
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}