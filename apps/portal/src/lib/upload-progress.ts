import type { DocumentStatus } from "@prisma/client";

export const POLL_INTERVAL_MS = 3_000;
export const POLL_MAX_TICKS = 40;

export const TERMINAL_TRACKING_STATUSES: ReadonlySet<DocumentStatus> = new Set([
  "INDEXED",
  "READY",
  "ERROR",
]);

export function isTerminalTrackingStatus(status: string | undefined): status is DocumentStatus {
  return status !== undefined && TERMINAL_TRACKING_STATUSES.has(status as DocumentStatus);
}

export function anyLiveTracking(statuses: ReadonlyArray<string | undefined>): boolean {
  return statuses.some((s) => s !== undefined);
}

export function allTerminal(statuses: ReadonlyArray<string | undefined>): boolean {
  const defined = statuses.filter((s): s is string => s !== undefined);
  return defined.length > 0 && defined.every((s) => isTerminalTrackingStatus(s));
}

export function tickBudget(ticksElapsed: number, maxTicks = POLL_MAX_TICKS): "running" | "expired" {
  return ticksElapsed >= maxTicks ? "expired" : "running";
}

export interface ProcessingPresentation {
  label: string;
  tone: "active" | "success" | "error";
}

const PROCESSING_LABELS: Record<DocumentStatus, ProcessingPresentation> = {
  QUEUED: { label: "Queued for processing", tone: "active" },
  UPLOADING: { label: "Uploading", tone: "active" },
  STORED: { label: "Uploaded — preparing", tone: "active" },
  EXTRACTING: { label: "Extracting text", tone: "active" },
  CHUNKING: { label: "Chunking content", tone: "active" },
  EMBEDDING_PENDING: { label: "Preparing embeddings", tone: "active" },
  EMBEDDING: { label: "Embedding", tone: "active" },
  INDEXED: { label: "Ready", tone: "success" },
  READY: { label: "Ready", tone: "success" },
  ERROR: { label: "Processing failed", tone: "error" },
};

export function processingPresentation(status: string | undefined): ProcessingPresentation {
  if (status === undefined) return { label: "Submitting", tone: "active" };
  return PROCESSING_LABELS[status as DocumentStatus] ?? { label: "Processing", tone: "active" };
}