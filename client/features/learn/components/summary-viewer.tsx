"use client";

import React from "react";
import { StreamdownContent } from "@/shared/components/streamdown-content";
import { BookOpen } from "lucide-react";

interface SummaryViewerProps {
  content: string;
  title?: string;
}

export function SummaryViewer({ content, title }: SummaryViewerProps) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-brand-quiet/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="kairos-inset flex size-8 items-center justify-center rounded-xl text-primary">
            <BookOpen className="size-4" />
          </div>
          <div>
            <p className="kairos-eyebrow">Reading view</p>
            <h3 className="kairos-section-title mt-0.5 text-sm">
              {title || "Study Guide & Executive Summary"}
            </h3>
          </div>
        </div>
        <span className="kairos-tag font-mono">Markdown</span>
      </div>

      {content.trim() ? (
        <div className="max-h-[60vh] overflow-y-auto px-5 py-5 sm:px-6">
          <StreamdownContent content={content} />
        </div>
      ) : (
        <div className="kairos-inset m-5 space-y-1 rounded-xl px-5 py-8 text-center">
          <p className="text-sm font-semibold text-foreground">No summary content yet</p>
          <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
            The generated text will appear here once it is available.
          </p>
        </div>
      )}
    </section>
  );
}
