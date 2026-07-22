"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  CheckCircle2,
  Loader2,
  XCircle,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ExperimentTimelineEvent } from "./types";
import { formatMetricValue } from "./types";

interface ExperimentTimelineProps {
  events: ExperimentTimelineEvent[];
  totalDurationMs?: number;
  onEventClick?: (eventId: string) => void;
  className?: string;
}

export function ExperimentTimeline({ events, totalDurationMs: totalProp, onEventClick, className }: ExperimentTimelineProps) {
  const [currentIdx, setCurrentIdx] = useState(events.length - 1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<"slow" | "normal" | "fast">("normal");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalDuration = totalProp ?? events.reduce((sum, e) => sum + (e.durationMs ?? 0), 0);
  const speedMultiplier = speed === "slow" ? 2 : speed === "fast" ? 0.5 : 1;

  const stopReplay = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const startReplay = useCallback(() => {
    stopReplay();
    setIsPlaying(true);
    setCurrentIdx(0);
    intervalRef.current = setInterval(() => {
      setCurrentIdx((prev) => {
        if (prev >= events.length - 1) {
          stopReplay();
          return events.length - 1;
        }
        return prev + 1;
      });
    }, 1000 * speedMultiplier);
  }, [events.length, speedMultiplier, stopReplay]);

  useEffect(() => {
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const getIcon = (event: ExperimentTimelineEvent, isCurrent: boolean, isPast: boolean) => {
    if (event.type === "completed") return <CheckCircle2 size={14} className="text-success" />;
    if (event.type === "failed") return <XCircle size={14} className="text-error" />;
    if (isCurrent && isPlaying) return <Loader2 size={14} className="text-brand animate-spin" />;
    return <Clock size={14} className={isPast ? "text-brand" : "text-text-tertiary"} />;
  };

  const elapsed = events.slice(0, currentIdx + 1).reduce((sum, e) => sum + (e.durationMs ?? 0), 0);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-text-primary">Experiment Timeline</h4>
        <div className="flex items-center gap-1">
          <select
            value={speed}
            onChange={(e) => setSpeed(e.target.value as typeof speed)}
            className="text-[10px] rounded border border-border bg-bg px-1.5 py-0.5 text-text-secondary"
            aria-label="Playback speed"
          >
            <option value="slow">0.5x</option>
            <option value="normal">1x</option>
            <option value="fast">2x</option>
          </select>
          {isPlaying ? (
            <Button variant="ghost" size="sm" onClick={stopReplay} aria-label="Pause"><Pause size={12} /></Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={startReplay} aria-label="Play"><Play size={12} /></Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => { stopReplay(); setCurrentIdx(events.length - 1); }} aria-label="Skip to end"><SkipForward size={12} /></Button>
          <Button variant="ghost" size="sm" onClick={() => { stopReplay(); setCurrentIdx(0); }} aria-label="Reset"><RotateCcw size={12} /></Button>
        </div>
      </div>

      <div className="relative">
        <div className="h-2 rounded-full bg-bg overflow-hidden">
          <div
            className="h-full bg-brand rounded-full transition-all duration-300"
            style={{ width: `${totalDuration > 0 ? (elapsed / totalDuration) * 100 : 100}%` }}
          />
        </div>
        <div className="absolute top-0 left-0 right-0 h-2 flex items-center">
          {events.map((event, i) => {
            const pos = totalDuration > 0
              ? events.slice(0, i).reduce((sum, e) => sum + (e.durationMs ?? 0), 0) / totalDuration * 100
              : (i / events.length) * 100;
            return (
              <div
                key={event.id}
                className="absolute w-1.5 h-1.5 rounded-full bg-border -translate-x-1/2"
                style={{ left: `${pos}%` }}
                title={event.label}
              />
            );
          })}
        </div>
      </div>

      <div className="space-y-0">
        {events.map((event, i) => {
          const isPast = i <= currentIdx;
          const isCurrent = i === currentIdx;
          const isLast = i === events.length - 1;
          return (
            <button
              key={event.id}
              onClick={() => { stopReplay(); setCurrentIdx(i); onEventClick?.(event.id); }}
              className={cn(
                "flex gap-3 w-full text-left transition-colors",
                isCurrent ? "opacity-100" : isPast ? "opacity-100" : "opacity-40"
              )}
            >
              <div className="flex flex-col items-center">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center", isCurrent ? "bg-brand/20 ring-2 ring-brand/30" : "bg-bg")}>
                  {getIcon(event, isCurrent, isPast)}
                </div>
                {!isLast && <div className="w-px h-4 bg-border" />}
              </div>
              <div className="pb-3">
                <p className={cn("text-xs font-medium", isCurrent ? "text-brand" : "text-text-primary")}>{event.label}</p>
                <p className="text-[11px] text-text-secondary">{event.description}</p>
                {event.durationMs !== undefined && (
                  <p className="text-[10px] text-text-tertiary mt-0.5">{formatMetricValue(event.durationMs, "duration")}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
