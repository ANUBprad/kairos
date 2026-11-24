"use client";

import React from "react";
import { Plus } from "lucide-react";

interface CreateWorkspaceCardProps {
  onClick: () => void;
}

export function CreateWorkspaceCard({ onClick }: CreateWorkspaceCardProps) {
  return (
    <button
      onClick={onClick}
      className="group flex h-44 flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-panel p-5 text-center shadow-[var(--shadow-panel)] transition-colors hover:border-brand/50 hover:bg-brand-quiet focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors group-hover:text-brand">
        <Plus className="h-5 w-5" aria-hidden="true" />
      </div>
      <span className="text-sm font-medium text-foreground">
        Create New Workspace
      </span>
      <span className="mt-1 text-xs text-muted-foreground">
        Upload PDFs, audio, YouTube &amp; web links
      </span>
    </button>
  );
}
