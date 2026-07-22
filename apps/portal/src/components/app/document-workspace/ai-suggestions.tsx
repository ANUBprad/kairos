"use client";

import { cn } from "@/lib/utils";
import {
  Sparkles,
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Suggestion {
  id: string;
  type: "suggestion" | "warning" | "success" | "info";
  title: string;
  description: string;
  action?: { label: string; href: string };
}

interface AiSuggestionsProps {
  suggestions?: Suggestion[];
  className?: string;
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; bgColor: string; borderColor: string }> = {
  suggestion: { icon: Lightbulb, color: "text-brand", bgColor: "bg-brand/10", borderColor: "border-brand/20" },
  warning: { icon: AlertTriangle, color: "text-warning", bgColor: "bg-warning/10", borderColor: "border-warning/20" },
  success: { icon: TrendingUp, color: "text-success", bgColor: "bg-success/10", borderColor: "border-success/20" },
  info: { icon: Sparkles, color: "text-info", bgColor: "bg-info/10", borderColor: "border-info/20" },
};

const DEMO_SUGGESTIONS: Suggestion[] = [
  {
    id: "1",
    type: "suggestion",
    title: "Consider a larger chunk size",
    description: "Your current chunk size averages 256 tokens. For research documents, 512-1024 tokens often improves retrieval quality.",
  },
  {
    id: "2",
    type: "warning",
    title: "Some chunks are very small",
    description: "3 chunks have fewer than 50 tokens. These may not carry enough context for effective retrieval.",
  },
  {
    id: "3",
    type: "success",
    title: "Embedding coverage is excellent",
    description: "100% of chunks have been embedded successfully. Your knowledge base is ready for retrieval.",
  },
];

export function AiSuggestions({ suggestions = DEMO_SUGGESTIONS, className }: AiSuggestionsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={cn("space-y-2.5", className)}>
      {suggestions.map((suggestion) => {
        const config = TYPE_CONFIG[suggestion.type];
        const Icon = config.icon;

        return (
          <div
            key={suggestion.id}
            className={cn(
              "flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-surface-hover/30",
              config.borderColor
            )}
          >
            <div className={cn("flex h-7 w-7 items-center justify-center rounded-md shrink-0", config.bgColor)}>
              <Icon size={14} className={config.color} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{suggestion.title}</p>
              <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{suggestion.description}</p>
              {suggestion.action && (
                <a
                  href={suggestion.action.href}
                  className={cn(
                    "inline-flex items-center gap-1 mt-2 text-xs font-medium transition-colors",
                    config.color,
                    "hover:opacity-80"
                  )}
                >
                  {suggestion.action.label}
                  <ArrowRight size={10} />
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
