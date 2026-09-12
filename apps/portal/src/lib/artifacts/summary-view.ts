import type { ArtifactStatus } from "@prisma/client";
import { summaryArtifactSchema } from "./summary";

// Typed window into a stored SUMMARY payload. The O4-T2 schema is the single
// source of truth for the shape; this only guards rendering against malformed
// or legacy content so the viewer never crashes on stored data.
export interface SummaryViewContent {
  title: string;
  overview: string;
  keyPoints: string[];
}

export function parseSummaryContent(content: unknown): SummaryViewContent | null {
  const parsed = summaryArtifactSchema.safeParse(content);
  return parsed.success ? parsed.data : null;
}

export interface ProvenanceRef {
  id: string;
  name: string;
}

// Maps persisted source ids back to source names for provenance display.
// Unknown or unmapped ids fall back to the id itself — honest rendering, never
// invented metadata.
export function resolveSourceProvenance(
  sourceIds: readonly string[],
  sources: readonly { id: string; name: string | null }[],
): ProvenanceRef[] {
  const names = new Map(sources.map((s) => [s.id, s.name ?? s.id]));
  return sourceIds.map((id) => ({ id, name: names.get(id) ?? id }));
}

export interface ArtifactStatusMeta {
  label: string;
  kind: "pending" | "processing" | "completed" | "failed";
}

export const ARTIFACT_STATUS_META: Readonly<Record<ArtifactStatus, ArtifactStatusMeta>> = {
  PENDING: { label: "Pending", kind: "pending" },
  PROCESSING: { label: "Processing", kind: "processing" },
  COMPLETED: { label: "Completed", kind: "completed" },
  FAILED: { label: "Failed", kind: "failed" },
};