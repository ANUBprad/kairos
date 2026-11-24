"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Brain, Plus } from "lucide-react";
import { ThemeLoader } from "@/components/ui/theme-loader";
import { useMemories } from "../hooks/use-memories";
import { MemoryList } from "./memory-list";
import { AddMemoryDialog } from "./add-memory-dialog";

type MemorySettingsViewProps = {
  workspaceId?: string;
};

export function MemorySettingsView({
  workspaceId,
}: MemorySettingsViewProps = {}) {
  const { memories, isLoading, error } = useMemories();
  const [addOpen, setAddOpen] = useState(false);

  const backHref = workspaceId
    ? `/workspace/${workspaceId}`
    : "/dashboard";

  const content = (
    <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          {!workspaceId && (
            <Link
              href={backHref}
              aria-label="Back to dashboard"
              className="kairos-inset flex size-10 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
            >
              <ArrowLeft className="size-4" />
            </Link>
          )}
          <div className="min-w-0 space-y-1">
            <p className="kairos-eyebrow">Personal context</p>
            <div className="flex items-center gap-3">
              <span className="kairos-inset flex size-10 shrink-0 items-center justify-center text-primary">
                <Brain className="size-5" />
              </span>
              <h2 className="kairos-section-title text-2xl text-foreground sm:text-3xl">
                Memory &amp; insights
              </h2>
            </div>
            <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
              Review what Kairos has learned and add facts you want it to remember
              when shaping answers and study material.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-[var(--shadow-panel)] transition-opacity hover:opacity-90 motion-reduce:transition-none"
        >
          <Plus className="size-4" />
          Add memory fact
        </button>
      </div>

      {/* Memory Content */}
      {isLoading ? (
        <div className="kairos-panel flex min-h-64 items-center justify-center gap-3 px-6 text-center text-xs text-muted-foreground">
          <ThemeLoader size={28} />
          <span>Loading your memory profile…</span>
        </div>
      ) : error ? (
        <div
          role="alert"
          className="kairos-panel flex items-start gap-3 border-danger/25 bg-danger/5 p-5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>
            We couldn&apos;t load your memories. Please refresh the page and try
            again.
          </span>
        </div>
      ) : (
        <MemoryList memories={memories} />
      )}

      {/* Add Memory Dialog */}
      <AddMemoryDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );

  if (workspaceId) {
    return content;
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="flex items-center justify-between gap-3 border-b border-border bg-panel px-4 py-3.5 sm:px-6">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
        >
          <ArrowLeft className="size-4" />
          Back to dashboard
        </Link>
        <span className="kairos-eyebrow">Memory</span>
      </div>
      {content}
    </div>
  );
}
