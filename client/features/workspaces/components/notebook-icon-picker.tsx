"use client";

import React from "react";
import {
  BookOpen,
  BookOpenText,
  Bot,
  BrainCircuit,
  ChartNoAxesColumn,
  Check,
  CodeXml,
  Flame,
  FlaskConical,
  Globe,
  GraduationCap,
  Lightbulb,
  Palette,
  PenLine,
  Pin,
  Rocket,
  Sparkles,
  Target,
  TestTube,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Stored identifiers remain the original emoji values. Rendering is now a
 * single monochrome Lucide icon per value, so existing workspaces need no
 * migration and unknown legacy emoji still display verbatim.
 */
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

export const DEFAULT_NOTEBOOK_ICON = NOTEBOOK_ICONS[0];

const ICON_LABELS: Record<string, string> = {
  "📚": "Books",
  "🔬": "Research",
  "💻": "Code",
  "🧠": "Mind",
  "📊": "Data",
  "⚡": "Energy",
  "🎨": "Design",
  "📝": "Writing",
  "🌐": "Web",
  "🎯": "Focus",
  "🚀": "Launch",
  "💡": "Ideas",
  "📌": "Pinned",
  "✨": "Highlights",
  "🔥": "Trending",
  "🤖": "Automation",
  "📖": "Reading",
  "🎓": "Learning",
  "🧪": "Experiments",
  "🛠️": "Tools",
};

const ICON_COMPONENTS: Record<string, LucideIcon> = {
  "📚": BookOpen,
  "🔬": FlaskConical,
  "💻": CodeXml,
  "🧠": BrainCircuit,
  "📊": ChartNoAxesColumn,
  "⚡": Zap,
  "🎨": Palette,
  "📝": PenLine,
  "🌐": Globe,
  "🎯": Target,
  "🚀": Rocket,
  "💡": Lightbulb,
  "📌": Pin,
  "✨": Sparkles,
  "🔥": Flame,
  "🤖": Bot,
  "📖": BookOpenText,
  "🎓": GraduationCap,
  "🧪": TestTube,
  "🛠️": Wrench,
};

const FALLBACK_ICON = BookOpen;

export function notebookIconLabel(value: string | null | undefined): string {
  if (!value) return "Notebook";
  return ICON_LABELS[value] ?? "Custom icon";
}

export interface WorkspaceIconProps {
  value: string | null | undefined;
  size?: number;
  className?: string;
}

/** Renders a saved workspace identifier as a consistent monochrome icon. */
export function WorkspaceIcon({
  value,
  size = 18,
  className,
}: WorkspaceIconProps) {
  const Icon = value ? ICON_COMPONENTS[value] ?? FALLBACK_ICON : FALLBACK_ICON;
  const isLegacyEmoji = Boolean(value) && !ICON_COMPONENTS[value as string];

  if (isLegacyEmoji) {
    return (
      <span
        aria-hidden="true"
        className={cn("flex items-center justify-center leading-none", className)}
        style={{ fontSize: size }}
      >
        {value}
      </span>
    );
  }

  return (
    <Icon
      aria-hidden="true"
      size={size}
      strokeWidth={1.75}
      className={className}
    />
  );
}

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
  const options: string[] = [...NOTEBOOK_ICONS];
  if (value && !options.includes(value)) options.unshift(value);

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="flex items-center justify-between gap-3 text-xs font-medium text-foreground">
        <span>{label}</span>
        <span className="text-[11px] font-normal text-muted-foreground">
          Selected: {notebookIconLabel(value)}
        </span>
      </p>
      <div
        role="group"
        aria-label={label}
        className="kairos-inset flex max-h-32 flex-wrap gap-1.5 overflow-y-auto p-2"
      >
        {options.map((icon) => {
          const isSelected = value === icon;
          return (
            <button
              key={icon}
              type="button"
              onClick={() => onChange(icon)}
              aria-label={`Use ${notebookIconLabel(icon)} icon`}
              aria-pressed={isSelected}
              title={notebookIconLabel(icon)}
              className={cn(
                "relative flex size-9 items-center justify-center rounded-lg border transition-colors motion-reduce:transition-none",
                isSelected
                  ? "border-brand/40 bg-brand-soft text-brand"
                  : "border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <WorkspaceIcon value={icon} size={18} />
              {isSelected && (
                <Check
                  aria-hidden="true"
                  size={11}
                  strokeWidth={2.25}
                  className="absolute -right-1 -top-1 rounded-full bg-brand p-px text-primary-foreground"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
