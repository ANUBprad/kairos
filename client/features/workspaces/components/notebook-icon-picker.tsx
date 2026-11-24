"use client";

import React from "react";
import { cn } from "@/lib/utils";

export const NOTEBOOK_ICONS = [
  "📚",
  "🔬",
  "💻",
  "🧠",
  "📊",
  "⚡",
  "🎨",
  "📝",
  "🌐",
  "🎯",
  "🚀",
  "💡",
  "📌",
  "✨",
  "🔥",
  "🤖",
  "📖",
  "🎓",
  "🧪",
  "🛠️",
] as const;

export interface NotebookIconPickerProps {
  value: string;
  onChange: (icon: string) => void;
  label?: string;
  className?: string;
}

export function NotebookIconPicker({
  value,
  onChange,
  label = "Workspace Icon",
  className,
}: NotebookIconPickerProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="flex items-center justify-between text-xs font-medium text-foreground">
        <span>{label}</span>
        <span className="text-[11px] text-muted-foreground">Selected: {value}</span>
      </p>
      <div
        role="group"
        aria-label={label}
        className="kairos-inset flex max-h-28 flex-wrap gap-1.5 overflow-y-auto p-2"
      >
        {NOTEBOOK_ICONS.map((icon) => {
          const isSelected = value === icon;
          return (
            <button
              key={icon}
              type="button"
              onClick={() => onChange(icon)}
              aria-label={`Use ${icon} icon`}
              aria-pressed={isSelected}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-lg border text-lg transition-colors",
                isSelected
                  ? "border-brand bg-brand text-primary-foreground shadow-[var(--shadow-panel)]"
                  : "border-transparent hover:bg-brand-soft"
              )}
            >
              {icon}
            </button>
          );
        })}
      </div>
    </div>
  );
}
