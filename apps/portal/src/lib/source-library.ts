import type { DocumentSourceType } from "@prisma/client";
import { SOURCE_TYPE_VALUES, SOURCE_STATUS_VALUES } from "@/lib/source-contract";
import { MAX_BULK_OPERATIONS } from "@/lib/source-contract";

const TERMINAL_STATUSES = ["INDEXED", "READY", "ERROR"] as const;

export const PROCESSING_STATUSES: ReadonlyArray<string> = SOURCE_STATUS_VALUES.filter(
  (status) => !TERMINAL_STATUSES.includes(status as (typeof TERMINAL_STATUSES)[number]),
);

export const SOURCE_TYPE_META: Record<
  DocumentSourceType,
  { label: string; description: string; className: string }
> = {
  FILE: {
    label: "File",
    description: "Uploaded document",
    className: "border-text-tertiary/30 bg-surface-hover text-text-secondary",
  },
  TEXT: {
    label: "Text",
    description: "Raw text note",
    className: "border-info/30 bg-info/10 text-info",
  },
  URL: {
    label: "URL",
    description: "Web article or page",
    className: "border-brand/30 bg-brand/10 text-brand",
  },
  YOUTUBE: {
    label: "YouTube",
    description: "YouTube video transcript",
    className: "border-error/30 bg-error/10 text-error",
  },
};

export const SOURCE_TYPE_OPTIONS: ReadonlyArray<{ value: DocumentSourceType | ""; label: string }> = [
  { value: "", label: "All sources" },
  ...SOURCE_TYPE_VALUES.map((value) => ({ value, label: SOURCE_TYPE_META[value].label })),
];

export const STATUS_FILTER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: "", label: "All" },
  { value: "READY", label: "Ready" },
  { value: "PROCESSING", label: "Processing" },
  { value: "ERROR", label: "Error" },
  { value: "QUEUED", label: "Queued" },
];

export interface SourceRow {
  id: string;
  name: string;
  fileType: string;
  sourceType: DocumentSourceType;
  sourceUrl: string | null;
  status: string;
  uploadedBy?: { name: string | null } | null;
}

export interface SourceFilters {
  search?: string;
  sourceType?: DocumentSourceType | "";
  status?: string;
}

export function filterSources(items: SourceRow[], filters: SourceFilters): SourceRow[] {
  const query = (filters.search || "").trim().toLowerCase();
  let list = items;
  if (query) {
    list = list.filter(
      (source) =>
        source.name.toLowerCase().includes(query) ||
        source.fileType.toLowerCase().includes(query) ||
        (source.sourceUrl || "").toLowerCase().includes(query) ||
        source.uploadedBy?.name?.toLowerCase().includes(query),
    );
  }
  if (filters.sourceType) {
    list = list.filter((source) => source.sourceType === filters.sourceType);
  }
  if (filters.status) {
    list =
      filters.status === "PROCESSING"
        ? list.filter((source) => PROCESSING_STATUSES.includes(source.status))
        : list.filter((source) => source.status === filters.status);
  }
  return list;
}

export function canAddToBulkSelection(selectedCount: number): boolean {
  return selectedCount < MAX_BULK_OPERATIONS;
}