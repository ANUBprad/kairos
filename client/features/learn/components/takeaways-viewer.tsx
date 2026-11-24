"use client";

import React, { useState } from "react";
import { CheckSquare, Square, ListChecks } from "lucide-react";
import { cn } from "@/lib/utils";

interface TakeawaysViewerProps {
  content: string | string[] | Record<string, unknown>;
}

function renderFormattedTakeaway(text: string) {
  if (!text.includes("**")) {
    return <span>{text}</span>;
  }

  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const inner = part.slice(2, -2);
          return (
            <strong key={i} className="font-semibold text-foreground">
              {inner}
            </strong>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export function TakeawaysViewer({ content }: TakeawaysViewerProps) {
  const items: string[] = Array.isArray(content)
    ? content
    : typeof content === "string"
    ? content.split("\n").map((s) => s.replace(/^[-*•\d.]+\s*/, "").trim()).filter(Boolean)
    : [];

  const [checkedIndices, setCheckedIndices] = useState<number[]>([]);

  const toggleCheck = (idx: number) => {
    setCheckedIndices((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    );
  };

  if (items.length === 0) {
    return (
      <section className="kairos-inset space-y-2 px-5 py-8 text-center">
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-brand-soft text-primary">
          <ListChecks className="size-5" />
        </div>
        <p className="text-sm font-semibold text-foreground">No takeaways yet</p>
        <p className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground">
          Key points extracted from your sources will show up here.
        </p>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-panel)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-brand-quiet/60 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="kairos-inset flex size-8 items-center justify-center rounded-xl text-primary">
            <ListChecks className="size-4" />
          </div>
          <div>
            <p className="kairos-eyebrow">Review checklist</p>
            <h3 className="kairos-section-title mt-0.5 text-sm">
              Actionable takeaways
            </h3>
          </div>
        </div>
        <span className="kairos-tag font-mono">
          {checkedIndices.length}/{items.length} complete
        </span>
      </div>

      <div className="space-y-2 p-4 sm:p-5" role="list">
        {items.map((item, idx) => {
          const isChecked = checkedIndices.includes(idx);
          return (
            <div
              key={idx}
              role="listitem"
              onClick={() => toggleCheck(idx)}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors select-none motion-reduce:transition-none",
                isChecked
                  ? "border-brand/30 bg-brand-soft/50 text-muted-foreground"
                  : "border-border bg-surface hover:border-brand/30 hover:bg-brand-quiet/60"
              )}
            >
              <button
                type="button"
                aria-pressed={isChecked}
                aria-label={
                  isChecked ? "Mark takeaway incomplete" : "Mark takeaway complete"
                }
                className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
              >
                {isChecked ? (
                  <CheckSquare className="size-4 text-primary" />
                ) : (
                  <Square className="size-4" />
                )}
              </button>
              <p
                className={cn(
                  "flex-1 text-xs leading-relaxed",
                  isChecked && "line-through"
                )}
              >
                {renderFormattedTakeaway(item)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

