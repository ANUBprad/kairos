"use client";

import { cn } from "@/lib/utils";
import {
  Upload,
  FileSearch,
  Scissors,
  Database,
  Search,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface PipelineStage {
  id: string;
  label: string;
  icon: LucideIcon;
  status: "completed" | "active" | "pending" | "error";
  progress?: number;
}

interface PipelineStatusProps {
  stages?: PipelineStage[];
  activeStageIndex?: number;
  className?: string;
}

const DEFAULT_STAGES: PipelineStage[] = [
  { id: "upload", label: "Upload", icon: Upload, status: "completed" },
  { id: "extract", label: "Extract", icon: FileSearch, status: "completed" },
  { id: "chunk", label: "Chunk", icon: Scissors, status: "completed" },
  { id: "embed", label: "Embed", icon: Database, status: "active" },
  { id: "index", label: "Index", icon: Search, status: "pending" },
  { id: "ready", label: "Ready", icon: CheckCircle2, status: "pending" },
];

const STAGE_STATUS_CONFIG = {
  completed: {
    dot: "bg-success border-success",
    icon: "text-success",
    label: "text-text-primary",
    line: "bg-success/40",
  },
  active: {
    dot: "bg-brand border-brand ring-4 ring-brand/20",
    icon: "text-brand",
    label: "text-text-primary font-semibold",
    line: "bg-border",
  },
  pending: {
    dot: "bg-surface-hover border-border",
    icon: "text-text-tertiary",
    label: "text-text-tertiary",
    line: "bg-border",
  },
  error: {
    dot: "bg-error border-error",
    icon: "text-error",
    label: "text-error",
    line: "bg-border",
  },
};

function PipelineStatus({
  stages = DEFAULT_STAGES,
  className,
}: PipelineStatusProps) {
  return (
    <div className={cn("flex items-center justify-between w-full", className)}>
      {stages.map((stage, i) => {
        const config = STAGE_STATUS_CONFIG[stage.status];
        const Icon = stage.icon;
        const isLast = i === stages.length - 1;

        return (
          <div key={stage.id} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative">
                <div className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all",
                  config.dot,
                  stage.status === "active" && "animate-pulse"
                )}>
                  {stage.status === "active" ? (
                    <Loader2 size={16} className={cn(config.icon, "animate-spin")} />
                  ) : stage.status === "completed" ? (
                    <CheckCircle2 size={16} className={config.icon} />
                  ) : (
                    <Icon size={16} className={config.icon} />
                  )}
                </div>
                {stage.progress !== undefined && stage.status === "active" && (
                  <svg className="absolute inset-0 -rotate-90" width="40" height="40">
                    <circle
                      cx="20" cy="20" r="17"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="text-brand/20"
                    />
                    <circle
                      cx="20" cy="20" r="17"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={106.8}
                      strokeDashoffset={106.8 - (106.8 * (stage.progress || 0)) / 100}
                      className="text-brand transition-all duration-500"
                    />
                  </svg>
                )}
              </div>
              <span className={cn("text-[11px] font-medium whitespace-nowrap", config.label)}>
                {stage.label}
              </span>
            </div>
            {!isLast && (
              <div className={cn(
                "flex-1 h-0.5 mx-2 mb-5 transition-colors",
                stage.status === "completed" ? config.line : "bg-border"
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function IdlePipeline({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center justify-center py-4", className)}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-success/10 border-2 border-success">
          <CheckCircle2 size={18} className="text-success" />
        </div>
        <div>
          <p className="text-sm font-medium text-text-primary">All systems operational</p>
          <p className="text-xs text-text-tertiary">No active pipeline jobs</p>
        </div>
      </div>
    </div>
  );
}

export { PipelineStatus, IdlePipeline };
export type { PipelineStage, PipelineStatusProps };
