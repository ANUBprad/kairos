"use client";

import React from "react";
import { Plus } from "lucide-react";
import { GooeyInput } from "@/components/ui/gooey-input";

interface DashboardBannerProps {
  userName?: string | null;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onNewNotebook: () => void;
}

export function DashboardBanner({
  userName,
  searchQuery,
  onSearchChange,
  onNewNotebook,
}: DashboardBannerProps) {
  return (
    <section className="kairos-panel kairos-aurora relative overflow-hidden p-6 sm:p-8">
      <div className="kairos-grid pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="kairos-eyebrow">Your library</p>
          <h1 className="kairos-display mt-3 text-3xl text-foreground sm:text-4xl">
            Welcome back, {userName || "Explorer"}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
            Organize your research, notes, and sources with AI-powered synthesis.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
          <GooeyInput
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notebooks..."
            aria-label="Search notebooks"
          />

          <button
            onClick={onNewNotebook}
            className="flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-medium text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" aria-hidden="true" />
            <span>New Notebook</span>
          </button>
        </div>
      </div>
    </section>
  );
}
