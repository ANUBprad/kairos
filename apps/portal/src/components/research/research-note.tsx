"use client";

import { BookOpen } from "lucide-react";

interface ResearchNoteProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function ResearchNote({ title = "Research Note", children, className = "" }: ResearchNoteProps) {
  return (
    <div className={`rounded-lg border border-brand/20 bg-brand/5 p-4 ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand/10">
          <BookOpen size={14} className="text-brand" />
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-brand tracking-wide uppercase">{title}</p>
          <div className="text-sm text-text-secondary leading-relaxed">{children}</div>
        </div>
      </div>
    </div>
  );
}
