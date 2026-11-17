"use client";

import { cn } from "@/lib/utils";
import {
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Upload,
  FileSearch,
  Scissors,
  Cpu,
  Database,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { ProcessingStage } from "./types";

interface ProcessingPipelineProps {
  stages: ProcessingStage[];
  status: string;
  onRetry?: () => void;
  className?: string;
}

const STAGE_ICONS: Record<string, typeof CheckCircle2> = {
  queued: Clock,
  uploading: Upload,
  stored: Database,
  extracting: FileSearch,
  chunking: Scissors,
  embedding_pending: Cpu,
  embedding: Cpu,
  indexed: CheckCircle2,
  ready: CheckCircle2,
  error: AlertCircle,
};

function getStageIcon(stageId: string) {
  return STAGE_ICONS[stageId.toLowerCase()] || Clock;
}

function StageRow({ stage, isLast }: { stage: ProcessingStage; isLast: boolean }) {
  const Icon = getStageIcon(stage.id);
  const isActive = stage.status === "active";
  const isCompleted = stage.status === "completed";
  const isError = stage.status === "error";

  return (
    <div className="flex items-start gap-3">
      <div className="flex flex-col items-center">
        <div className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-colors",
          isCompleted && "bg-success/10 border-success text-success",
          isActive && "bg-brand/10 border-brand text-brand",
          isError && "bg-error/10 border-error text-error",
          stage.status === "pending" && "bg-surface-hover border-border text-text-tertiary",
          stage.status === "skipped" && "bg-surface-hover border-border text-text-tertiary",
        )}>
          {isActive ? (
            <Loader2 size={14} className="animate-spin" />
          ) : isError ? (
            <XCircle size={14} />
          ) : (
            <Icon size={14} />
          )}
        </div>
        {!isLast && (
          <div className={cn(
            "w-0.5 h-8 my-1",
            isCompleted ? "bg-success/30" : "bg-border"
          )} />
        )}
      </div>
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2">
          <span className={cn(
            "text-sm font-medium",
            isActive ? "text-text-primary" : isCompleted ? "text-text-secondary" : "text-text-tertiary"
          )}>
            {stage.label}
          </span>
          {stage.durationMs !== undefined && (
            <span className="text-[11px] font-mono text-text-tertiary tabular-nums">
              {formatDuration(stage.durationMs)}
            </span>
          )}
        </div>
        {stage.error && (
          <p className="text-xs text-error mt-1">{stage.error}</p>
        )}
        {stage.logs && stage.logs.length > 0 && (
          <div className="mt-2 rounded-md bg-bg border border-border p-2">
            {stage.logs.slice(-3).map((log) => (
              <p key={log} className="text-[11px] font-mono text-text-tertiary leading-relaxed">
                {log}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function ProcessingPipeline({ stages, status, onRetry, className }: ProcessingPipelineProps) {
  const hasError = status === "ERROR";
  const isProcessing = ["QUEUED", "UPLOADING", "STORED", "EXTRACTING", "CHUNKING", "EMBEDDING_PENDING", "EMBEDDING"].includes(status);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isProcessing ? (
            <Loader2 size={14} className="animate-spin text-brand" />
          ) : hasError ? (
            <AlertCircle size={14} className="text-error" />
          ) : (
            <CheckCircle2 size={14} className="text-success" />
          )}
          <span className="text-sm font-medium text-text-primary">
            {hasError ? "Pipeline Failed" : isProcessing ? "Processing..." : "Pipeline Complete"}
          </span>
        </div>
        {hasError && onRetry && (
          <button
            onClick={onRetry}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-hover transition-colors"
          >
            <RefreshCw size={12} />
            Retry
          </button>
        )}
      </div>
      <div className="space-y-0">
        {stages.map((stage, i) => (
          <StageRow key={stage.id} stage={stage} isLast={i === stages.length - 1} />
        ))}
      </div>
    </div>
  );
}

// Stage ids must match the ids used above. The status→stage table previously
// looked up `stage.id.toUpperCase()` ("UPLOAD", "EXTRACT", …) which never
// matched, so the pipeline panel rendered every stage as pending while a
// document was actively processing.
const STAGE_IDS = ["upload", "extract", "chunk", "embed", "index"] as const;

const STAGE_INDEX_FOR_STATUS: Record<string, number> = {
  QUEUED: 0,
  UPLOADING: 0,
  STORED: 0,
  EXTRACTING: 1,
  CHUNKING: 2,
  EMBEDDING_PENDING: 3,
  EMBEDDING: 3,
  INDEXED: 4,
  READY: 4,
};

// Pipeline metadata records the internal stage name; map it to the stage the
// user sees so a failure is shown on the row that actually failed.
const STAGE_FOR_PIPELINE_NAME: Record<string, (typeof STAGE_IDS)[number]> = {
  init: "upload",
  fetch: "upload",
  upload: "upload",
  extract: "extract",
  chunk: "chunk",
  store: "index",
  db: "index",
  index: "index",
  embed: "embed",
};

export function buildPipelineStages(
  status: string,
  metadata?: Record<string, unknown> | null
): ProcessingStage[] {
  const stages: ProcessingStage[] = [
    { id: "upload", label: "Upload", status: "pending" },
    { id: "extract", label: "Text Extraction", status: "pending" },
    { id: "chunk", label: "Chunking", status: "pending" },
    { id: "embed", label: "Embedding", status: "pending" },
    { id: "index", label: "Indexing", status: "pending" },
  ];

  if (status === "ERROR") {
    const failedId = STAGE_FOR_PIPELINE_NAME[String(metadata?.stage ?? "")] ?? "upload";
    const failedIdx = STAGE_IDS.indexOf(failedId);
    for (const stage of stages) {
      const idx = STAGE_IDS.indexOf(stage.id as (typeof STAGE_IDS)[number]);
      if (idx < failedIdx) stage.status = "completed";
      else if (idx === failedIdx) {
        stage.status = "error";
        stage.error = (metadata?.error as string) || "Failed";
      }
    }
    return stages;
  }

  const currentIdx = STAGE_INDEX_FOR_STATUS[status];
  if (currentIdx === undefined) return stages;

  for (const stage of stages) {
    const idx = STAGE_IDS.indexOf(stage.id as (typeof STAGE_IDS)[number]);
    if (idx < currentIdx) stage.status = "completed";
    else if (idx === currentIdx) stage.status = "active";
  }

  if (status === "READY" || status === "INDEXED") {
    stages.forEach((s) => { s.status = "completed"; });
  }

  return stages;
}
