"use client";

import React, { use } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Sparkles } from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { useArtifacts } from "@/features/learn";
import { FlashcardsViewer } from "@/features/learn/components/flashcards-viewer";
import { QuizViewer } from "@/features/learn/components/quiz-viewer";
import { MindmapViewer } from "@/features/learn/components/mindmap-viewer";
import { TakeawaysViewer } from "@/features/learn/components/takeaways-viewer";
import { SummaryViewer } from "@/features/learn/components/summary-viewer";
import { PodcastViewer } from "@/features/learn/components/podcast-viewer";
import { formatDate } from "@/lib/utils";

interface FullscreenArtifactPageProps {
  params: Promise<{
    workspaceId: string;
    artifactId: string;
  }>;
}

export default function FullscreenArtifactPage({
  params,
}: FullscreenArtifactPageProps) {
  const { workspaceId, artifactId } = use(params);
  const { artifacts, isLoading } = useArtifacts(workspaceId);

  const artifact = artifacts.find((a) => a.id === artifactId);

  if (isLoading) {
    return (
      <div className="kairos-aurora flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="kairos-inset flex size-12 items-center justify-center text-primary">
          <ThemeLoader size={28} />
        </div>
        <div>
          <p className="kairos-eyebrow">Opening artifact</p>
          <p className="mt-1 text-sm text-muted-foreground">Preparing your study view…</p>
        </div>
      </div>
    );
  }

  if (!artifact) {
    return (
      <div className="kairos-aurora flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
        <div className="kairos-inset flex size-12 items-center justify-center text-danger">
          <AlertCircle className="size-5" />
        </div>
        <div>
          <p className="kairos-section-title text-lg">Artifact not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been removed from this workspace.
          </p>
        </div>
        <Link
          href={`/workspace/${workspaceId}/learn`}
          className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-brand-soft"
        >
          <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
          Back to studio
        </Link>
      </div>
    );
  }

  return (
    <div className="kairos-aurora min-h-screen bg-background text-foreground">
      <div className="kairos-grid pointer-events-none fixed inset-x-0 top-0 h-72 opacity-35" />

      <header className="sticky top-0 z-20 border-b border-border bg-panel/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <Link
            href={`/workspace/${workspaceId}/learn`}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            <span>Back to studio</span>
          </Link>

          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground sm:block">
              {artifact.type}
            </span>
            <KairosLogo
              size={20}
              textSize="text-base"
              subtitle="Full view"
              className="text-foreground"
            />
          </div>
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-5 pb-12 pt-8 sm:px-8 sm:pt-10">
        <div className="mb-6">
          <p className="kairos-eyebrow flex items-center gap-2">
            <Sparkles className="size-3.5" />
            {artifact.type === "PODCAST" ? "Audio session" : "Study artifact"}
          </p>
          <h1 className="kairos-display mt-2 text-[28px] sm:text-[36px]">
            {artifact.title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="kairos-tag">
              <span className="kairos-status-dot" />
              {artifact.type}
            </span>
            <span className="kairos-tag">Created {formatDate(artifact.createdAt)}</span>
          </div>
        </div>

        <div className="kairos-panel p-4 sm:p-6">
          {artifact.type === "FLASHCARDS" && artifact.content?.cards && (
            <FlashcardsViewer cards={artifact.content.cards} />
          )}
          {artifact.type === "QUIZ" && artifact.content?.questions && (
            <QuizViewer questions={artifact.content.questions} />
          )}
          {artifact.type === "TAKEAWAYS" && (
            <TakeawaysViewer content={artifact.content?.items || []} />
          )}
          {(artifact.type === "SUMMARY" || artifact.type === "REPORT") && (
            <SummaryViewer
              content={artifact.content?.markdown || ""}
              title={artifact.title}
            />
          )}
          {(artifact.type === "MINDMAP" || artifact.type === "DIAGRAM") && (
            <MindmapViewer content={artifact.content} />
          )}
          {artifact.type === "PODCAST" && (
            <PodcastViewer
              content={artifact.content}
              artifactId={artifact.id}
              workspaceId={artifact.workspaceId}
            />
          )}
        </div>
      </main>
    </div>
  );
}
