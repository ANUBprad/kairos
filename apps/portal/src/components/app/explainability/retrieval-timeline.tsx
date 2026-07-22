"use client";

import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  Loader2,
  Play,
  Pause,
  RotateCcw,
  Search,
  Scissors,
  Cpu,
  Database,
  FileSearch,
  MessageSquare,
} from "lucide-react";
import type { ExplainerPipelineStep } from "./types";
import type { LucideIcon } from "lucide-react";

interface RetrievalTimelineProps {
  steps: ExplainerPipelineStep[];
  totalLatencyMs?: number;
  className?: string;
}

const STEP_ICONS: Record<string, LucideIcon> = {
  query: Search,
  embedding: Cpu,
  "vector search": Database,
  search: Database,
  filtering: FileSearch,
  ranking: FileSearch,
  reranking: FileSearch,
  chunking: Scissors,
  prompt: MessageSquare,
  generation: MessageSquare,
  llm: MessageSquare,
};

function getStepIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(STEP_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return CheckCircle2;
}

export function RetrievalTimeline({ steps, totalLatencyMs, className }: RetrievalTimelineProps) {
  const [replaying, setReplaying] = useState(false);
  const [visibleSteps, setVisibleSteps] = useState(steps.length);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDuration = totalLatencyMs || steps.reduce((sum, s) => sum + s.durationMs, 0);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const startReplay = () => {
    setReplaying(true);
    setVisibleSteps(0);
    let idx = 0;
    intervalRef.current = setInterval(() => {
      idx++;
      setVisibleSteps(idx);
      if (idx >= steps.length) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        setReplaying(false);
      }
    }, 600);
  };

  const stopReplay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setReplaying(false);
    setVisibleSteps(steps.length);
  };

  const resetReplay = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setReplaying(false);
    setVisibleSteps(steps.length);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
          Pipeline Timeline ({steps.length} steps)
        </span>
        <div className="flex items-center gap-1.5">
          {replaying ? (
            <button
              onClick={stopReplay}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-hover transition-colors"
            >
              <Pause size={12} /> Pause
            </button>
          ) : (
            <button
              onClick={startReplay}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-brand hover:bg-brand/10 transition-colors"
            >
              <Play size={12} /> Replay
            </button>
          )}
          <button
            onClick={resetReplay}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-hover transition-colors"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>
      </div>

      {/* Horizontal Bar */}
      <div className="flex items-center gap-0.5 h-4 rounded-full overflow-hidden bg-surface-hover">
        {steps.slice(0, visibleSteps).map((step, i) => {
          const pct = totalDuration > 0 ? (step.durationMs / totalDuration) * 100 : 100 / steps.length;
          return (
            <div
              key={i}
              className={cn(
                "h-full transition-all duration-300 relative group",
                i % 2 === 0 ? "bg-brand/40" : "bg-brand/60"
              )}
              style={{ width: `${Math.max(pct, 2)}%` }}
              title={`${step.name}: ${step.durationMs.toFixed(0)}ms`}
            >
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-surface border border-border rounded text-[10px] text-text-primary whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {step.name}: {step.durationMs.toFixed(0)}ms
              </div>
            </div>
          );
        })}
      </div>

      {/* Step List */}
      <div className="space-y-0">
        {steps.slice(0, visibleSteps).map((step, i) => {
          const Icon = getStepIcon(step.name);
          const isLast = i === visibleSteps - 1 && visibleSteps < steps.length;

          return (
            <div key={i} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full",
                  i < visibleSteps ? "bg-brand/10 text-brand" : "bg-surface-hover text-text-tertiary"
                )}>
                  {replaying && isLast ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Icon size={12} />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn(
                    "w-0.5 h-5 my-1",
                    i < visibleSteps - 1 ? "bg-brand/30" : "bg-border"
                  )} />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-text-primary">{step.name}</span>
                  <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
                    {step.durationMs < 1000 ? `${step.durationMs.toFixed(0)}ms` : `${(step.durationMs / 1000).toFixed(2)}s`}
                  </span>
                </div>
                <p className="text-[11px] text-text-tertiary mt-0.5">{step.description}</p>
                {step.output && Object.keys(step.output).length > 0 && (
                  <div className="mt-1.5 rounded-md bg-bg border border-border p-2">
                    <pre className="text-[10px] font-mono text-text-tertiary whitespace-pre-wrap line-clamp-3">
                      {JSON.stringify(step.output, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
