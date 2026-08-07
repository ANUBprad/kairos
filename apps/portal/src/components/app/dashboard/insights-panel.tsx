"use client";

import { cn } from "@/lib/utils";
import { Lightbulb, ArrowRight, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface Insight {
  id: string;
  type: "suggestion" | "warning" | "info" | "success";
  title: string;
  description: string;
  action?: { label: string; href: string };
  icon?: LucideIcon;
}

const TYPE_CONFIG: Record<string, { icon: LucideIcon; color: string; bgColor: string; borderColor: string }> = {
  suggestion: { icon: Lightbulb, color: "text-brand", bgColor: "bg-brand/10", borderColor: "border-brand/20" },
  warning: { icon: AlertTriangle, color: "text-warning", bgColor: "bg-warning/10", borderColor: "border-warning/20" },
  info: { icon: Sparkles, color: "text-info", bgColor: "bg-info/10", borderColor: "border-info/20" },
  success: { icon: TrendingUp, color: "text-success", bgColor: "bg-success/10", borderColor: "border-success/20" },
};

const DEMO_INSIGHTS: Insight[] = [
  {
    id: "1",
    type: "suggestion",
    title: "Try hybrid retrieval",
    description: "Combining vector + BM25 search can improve Recall by 15-25% on your dataset.",
    action: { label: "Open Retrieval Lab", href: "/app/retrieval-lab" },
  },
  {
    id: "2",
    type: "warning",
    title: "Chunk size may be too small",
    description: "Your current chunk size (256 tokens) may fragment context. Consider 512-1024 for research papers.",
    action: { label: "Open Chunking Studio", href: "/app/chunking-studio" },
  },
  {
    id: "3",
    type: "success",
    title: "MRR improved by 12%",
    description: "Your latest experiment run showed significant improvement over the baseline.",
    action: { label: "View Experiments", href: "/app/experiments" },
  },
  {
    id: "4",
    type: "info",
    title: "No evaluations yet",
    description: "Run a benchmark to measure retrieval quality with precision, recall, and MRR metrics.",
    action: { label: "Run Evaluation", href: "/app/evaluation" },
  },
];

function InsightCard({ insight }: { insight: Insight }) {
  const config = TYPE_CONFIG[insight.type];
  const Icon = insight.icon || config.icon;

  return (
    <div className={cn(
      "flex items-start gap-3 rounded-[var(--radius-md)] border p-3 transition-colors hover:bg-surface-hover/30",
      config.borderColor
    )}>
      <div className={cn("flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] shrink-0", config.bgColor)}>
        <Icon size={14} className={config.color} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{insight.title}</p>
        <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{insight.description}</p>
        {insight.action && (
          <Link
            href={insight.action.href}
            className={cn(
              "inline-flex items-center gap-1 mt-2 text-xs font-medium transition-colors",
              config.color,
              "hover:opacity-80"
            )}
          >
            {insight.action.label}
            <ArrowRight size={10} />
          </Link>
        )}
      </div>
    </div>
  );
}

interface InsightsPanelProps {
  insights?: Insight[];
  className?: string;
}

function InsightsPanel({ insights = DEMO_INSIGHTS, className }: InsightsPanelProps) {
  return (
    <div className={cn("space-y-2.5", className)}>
      {insights.map((insight) => (
        <InsightCard key={insight.id} insight={insight} />
      ))}
    </div>
  );
}

export { InsightsPanel };
export type { Insight, InsightsPanelProps };
