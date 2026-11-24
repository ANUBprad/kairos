"use client";

import React, { use } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Sparkles } from "lucide-react";
import { KairosLogo } from "@/components/brand/kairos-logo";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { StudioPanel, useArtifacts } from "@/features/learn";
import { useSources } from "@/features/sources";

interface WorkspaceLearnPageProps {
  params: Promise<{
    workspaceId: string;
  }>;
}

export default function WorkspaceLearnPage({
  params,
}: WorkspaceLearnPageProps) {
  const { workspaceId } = use(params);
  const {
    artifacts,
    createArtifact,
    deleteArtifact,
    retryArtifact,
    isCreating,
    isRetrying,
    retryingArtifactId,
    isLoading,
    isError,
    error,
  } = useArtifacts(workspaceId);
  const sourcesQuery = useSources(workspaceId);
  const sources = sourcesQuery.data || [];

  return (
    <div className="kairos-aurora min-h-screen bg-background text-foreground">
      <div className="kairos-grid pointer-events-none fixed inset-x-0 top-0 h-80 opacity-40" />

      <header className="sticky top-0 z-20 border-b border-border bg-panel/90 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3.5 sm:px-8">
          <Link
            href={`/workspace/${workspaceId}`}
            className="group inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand-soft hover:text-foreground"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            <span>Back to workspace chat</span>
          </Link>

          <KairosLogo
            size={20}
            textSize="text-base"
            subtitle="Study studio"
            className="text-foreground"
          />
        </div>
      </header>

      <main className="relative mx-auto w-full max-w-6xl px-5 pb-10 pt-8 sm:px-8 sm:pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="kairos-eyebrow flex items-center gap-2">
              <Sparkles className="size-3.5" />
              Learning studio
            </p>
            <h1 className="kairos-display mt-2 text-[28px] sm:text-[36px]">
              Turn sources into study material.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              Generate artifacts from your library, then open any one to review it
              without losing your place.
            </p>
          </div>

          <span className="kairos-tag">
            <span className="kairos-status-dot" />
            {sources.length} {sources.length === 1 ? "source" : "sources"} in library
          </span>
        </div>

        {isError && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-xs text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div>
              <p className="font-semibold">Couldn’t refresh studio artifacts</p>
              <p className="mt-1 text-danger/90">
                {error instanceof Error
                  ? error.message
                  : "Check your connection and try again later."}
              </p>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="mb-5 flex items-center gap-2 rounded-2xl border border-border bg-panel px-4 py-3 text-xs text-muted-foreground shadow-[var(--shadow-panel)]">
            <ThemeLoader size={16} />
            <span>Loading your studio…</span>
          </div>
        )}

        <div className="kairos-panel overflow-hidden">
          <StudioPanel
            artifacts={artifacts}
            onCreateArtifact={(type) => createArtifact({ type })}
            onDeleteArtifact={deleteArtifact}
            onRetryArtifact={retryArtifact}
            isCreating={isCreating}
            isRetrying={isRetrying}
            retryingArtifactId={retryingArtifactId}
            selectedSourcesCount={sources.length}
          />
        </div>
      </main>
    </div>
  );
}
