"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
}

export function MarkdownPreview({ content, className }: MarkdownPreviewProps) {
  if (!content) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-brand-quiet p-6 text-center text-xs text-muted-foreground">
        No preview content available
      </div>
    );
  }

  return (
    <div
      className={cn(
        "kairos-inset max-h-[60vh] select-text overflow-y-auto p-4 font-mono text-xs leading-relaxed text-foreground whitespace-pre-wrap sm:text-sm",
        className
      )}
    >
      {content}
    </div>
  );
}
