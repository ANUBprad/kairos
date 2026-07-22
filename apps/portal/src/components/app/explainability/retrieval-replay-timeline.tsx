"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Search,
  Cpu,
  Database,
  FileSearch,
  MessageSquare,
  CheckCircle2,
} from "lucide-react";
import type { ExplainerPipelineStep } from "./types";
import type { LucideIcon } from "lucide-react";

interface RetrievalReplayTimelineProps {
  steps: ExplainerPipelineStep[];
  totalLatencyMs?: number;
  onStepClick?: (stepIdx: number) => void;
  className?: string;
}

const STAGE_ICONS: Record<string, LucideIcon> = {
  query: Search,
  embedding: Cpu,
  "vector search": Database,
  search: Database,
  filtering: FileSearch,
  ranking: FileSearch,
  reranking: FileSearch,
  prompt: MessageSquare,
  generation: MessageSquare,
  llm: MessageSquare,
};

function getIcon(name: string): LucideIcon {
  const lower = name.toLowerCase();
  for (const [key, icon] of Object.entries(STAGE_ICONS)) {
    if (lower.includes(key)) return icon;
  }
  return CheckCircle2;
}

export function RetrievalReplayTimeline({
  steps,
  totalLatencyMs,
  onStepClick,
  className,
}: RetrievalReplayTimelineProps) {
  const [currentStep, setCurrentStep] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(600);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDuration = totalLatencyMs || steps.reduce((sum, s) => sum + s.durationMs, 0);

  const stopReplay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsPlaying(false);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const play = useCallback(() => {
    setIsPlaying(true);
    if (currentStep >= steps.length - 1) {
      setCurrentStep(0);
    }
    intervalRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= steps.length - 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speed);
  }, [currentStep, steps.length, speed]);

  const pause = () => {
    stopReplay();
  };

  const reset = () => {
    stopReplay();
    setCurrentStep(-1);
  };

  const skipToEnd = () => {
    stopReplay();
    setCurrentStep(steps.length - 1);
  };

  // Calculate cumulative time for each step
  let cumulativeTime = 0;
  const stepTimings = steps.map((step) => {
    const start = cumulativeTime;
    cumulativeTime += step.durationMs;
    return { start, end: cumulativeTime, ...step };
  });

  // Current replay position in time
  const currentTime = currentStep >= 0 ? stepTimings[currentStep]?.end || 0 : 0;
  const progressPct = totalDuration > 0 ? (currentTime / totalDuration) * 100 : 0;

  return (
    <div className={cn("space-y-3", className)}>
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={isPlaying ? pause : play}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full transition-colors",
              isPlaying ? "bg-brand text-white" : "bg-brand/10 text-brand hover:bg-brand/20"
            )}
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
          </button>
          <button
            onClick={reset}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover text-text-tertiary hover:bg-surface-hover/80 transition-colors"
          >
            <RotateCcw size={12} />
          </button>
          <button
            onClick={skipToEnd}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-hover text-text-tertiary hover:bg-surface-hover/80 transition-colors"
          >
            <SkipForward size={12} />
          </button>
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="rounded-md border border-border bg-bg px-2 py-1 text-[10px] text-text-secondary focus:border-brand focus:outline-none"
            aria-label="Replay speed"
          >
            <option value={1200}>Slow</option>
            <option value={600}>Normal</option>
            <option value={300}>Fast</option>
          </select>
        </div>
        <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
          Step {Math.max(0, currentStep + 1)} / {steps.length}
        </span>
      </div>

      {/* Progress Bar */}
      <div className="relative h-2 rounded-full bg-surface-hover overflow-hidden">
        <div
          className="h-full bg-brand transition-all duration-200"
          style={{ width: `${progressPct}%` }}
        />
        {/* Step markers */}
        {stepTimings.map((timing, i) => (
          <div
            key={i}
            className="absolute top-0 h-full w-px bg-border"
            style={{ left: `${totalDuration > 0 ? (timing.start / totalDuration) * 100 : 0}%` }}
          />
        ))}
      </div>

      {/* Timeline */}
      <div className="space-y-0">
        {steps.map((step, i) => {
          const Icon = getIcon(step.name);
          const isActive = i === currentStep;
          const isCompleted = i < currentStep;
          const isPending = i > currentStep;

          return (
            <button
              key={i}
              onClick={() => {
                stopReplay();
                setCurrentStep(i);
                onStepClick?.(i);
              }}
              className={cn(
                "flex items-start gap-3 w-full text-left transition-all rounded-lg p-2 -mx-2",
                isActive && "bg-brand/5",
                "hover:bg-surface-hover/50"
              )}
            >
              <div className="flex flex-col items-center shrink-0">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all",
                  isCompleted && "bg-success/10 border-success text-success",
                  isActive && "bg-brand/10 border-brand text-brand ring-4 ring-brand/20",
                  isPending && "bg-surface-hover border-border text-text-tertiary"
                )}>
                  {isActive ? (
                    <div className="h-3 w-3 rounded-full bg-brand animate-pulse" />
                  ) : isCompleted ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Icon size={14} />
                  )}
                </div>
                {i < steps.length - 1 && (
                  <div className={cn(
                    "w-0.5 h-5 my-1",
                    isCompleted ? "bg-success/30" : "bg-border"
                  )} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-xs font-medium",
                    isActive ? "text-brand" : isCompleted ? "text-text-primary" : "text-text-tertiary"
                  )}>
                    {step.name}
                  </span>
                  <span className="text-[10px] font-mono text-text-tertiary tabular-nums">
                    {step.durationMs < 1000 ? `${step.durationMs.toFixed(0)}ms` : `${(step.durationMs / 1000).toFixed(2)}s`}
                  </span>
                </div>
                {isActive && step.description && (
                  <p className="text-[11px] text-text-tertiary mt-0.5 animate-fade-in">
                    {step.description}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
