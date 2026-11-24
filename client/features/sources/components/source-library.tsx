"use client";

import React, { useMemo, useState, useRef, useEffect } from "react";
import {
  BookOpen,
  LayoutGrid,
  List,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  ChevronDown,
  Check,
} from "lucide-react";
import {
  useBulkDeleteSources,
  useDeleteSource,
  useReprocessSources,
  useSources,
} from "../hooks/use-sources";
import {
  SOURCE_STATUS_LABELS,
  SOURCE_STATUSES,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPES,
} from "../lib/constants";
import type { Source, SourceFilters, SourceStatus, SourceType } from "../lib/types";
import { AddSourceDialog } from "./add-source-dialog";
import { SourceCard } from "./source-card";
import { SourcePreviewDialog } from "./source-preview-dialog";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface SourceLibraryProps {
  workspaceId: string;
}

export function SourceLibrary({ workspaceId }: SourceLibraryProps) {
  const isMobile = useIsMobile();
  const [view, setView] = useState<"grid" | "list">("list");
  const [addOpen, setAddOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<Source | null>(null);
  const [filters, setFilters] = useState<SourceFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const [isTypeOpen, setIsTypeOpen] = useState(false);
  const [isStatusOpen, setIsStatusOpen] = useState(false);
  const typeRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile) {
      setView("grid");
    } else {
      setView("list");
    }
  }, [isMobile]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (typeRef.current && !typeRef.current.contains(e.target as Node)) {
        setIsTypeOpen(false);
      }
      if (statusRef.current && !statusRef.current.contains(e.target as Node)) {
        setIsStatusOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const { data: sources, isLoading, error } = useSources(workspaceId, filters);
  const deleteSourceMutation = useDeleteSource(workspaceId);
  const bulkDeleteMutation = useBulkDeleteSources(workspaceId);
  const reprocessFailedMutation = useReprocessSources(workspaceId);

  const failedCount =
    sources?.filter((source) => source.status === "FAILED").length ?? 0;

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.q?.trim()) count += 1;
    if (filters.type) count += 1;
    if (filters.status) count += 1;
    return count;
  }, [filters]);

  const hasActiveFilters = activeFilterCount > 0;

  function clearFilters() {
    setFilters({});
  }

  function exitSelectionMode() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  const toggleSelectId = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  return (
    <div className="flex flex-1 flex-col gap-4 sm:gap-6 p-3 sm:p-6 md:p-8 max-w-6xl mx-auto w-full min-w-0 overflow-x-hidden pb-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="kairos-eyebrow">Knowledge base</p>
          <h2 className="kairos-section-title text-xl text-primary sm:text-2xl">
            Source library
          </h2>
          <p className="text-[11px] text-muted-foreground sm:text-xs">
            {sources
              ? `${sources.length} source${sources.length === 1 ? "" : "s"} in this workspace`
              : "All knowledge sources in this workspace"}
          </p>
        </div>

        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="inline-flex w-full shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 motion-reduce:transition-none sm:w-auto sm:py-2"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add source
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          {/* Search Input */}
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search sources</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="text"
              className="kairos-inset w-full py-2 pl-9 pr-4 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
              placeholder="Search sources..."
              value={filters.q || ""}
              onChange={(e) =>
                setFilters((curr) => ({ ...curr, q: e.target.value }))
              }
            />
          </label>

          <div className="grid grid-cols-2 gap-2 w-full sm:flex sm:flex-wrap sm:items-center sm:w-auto">
            {/* Custom Type Dropdown */}
            <div className="relative min-w-0" ref={typeRef}>
              <button
                type="button"
                onClick={() => {
                  setIsTypeOpen(!isTypeOpen);
                  setIsStatusOpen(false);
                }}
                className="kairos-panel flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 px-3 py-2 text-xs text-foreground transition-colors hover:bg-brand-quiet motion-reduce:transition-none sm:w-auto"
              >
                <span className="truncate">
                  {filters.type ? SOURCE_TYPE_LABELS[filters.type] : "All Types"}
                </span>
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                    isTypeOpen && "rotate-180"
                  )}
                />
              </button>

              {isTypeOpen && (
                <div className="kairos-panel absolute left-0 right-0 top-full z-30 mt-1.5 max-h-56 animate-fadeIn space-y-0.5 overflow-y-auto p-1 text-xs shadow-[var(--shadow-lift)] motion-reduce:animate-none sm:right-auto sm:w-44">
                  <button
                    type="button"
                    onClick={() => {
                      setFilters((curr) => ({ ...curr, type: undefined }));
                      setIsTypeOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors motion-reduce:transition-none",
                      !filters.type
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "hover:bg-brand-quiet text-foreground"
                    )}
                  >
                    <span>All Types</span>
                    {!filters.type && <Check className="size-3.5 shrink-0" />}
                  </button>

                  {SOURCE_TYPES.map((t) => {
                    const isSelected = filters.type === t;
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          setFilters((curr) => ({ ...curr, type: t }));
                          setIsTypeOpen(false);
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors motion-reduce:transition-none",
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "hover:bg-brand-quiet text-foreground"
                        )}
                      >
                        <span>{SOURCE_TYPE_LABELS[t]}</span>
                        {isSelected && <Check className="size-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Custom Status Dropdown */}
            <div className="relative min-w-0" ref={statusRef}>
              <button
                type="button"
                onClick={() => {
                  setIsStatusOpen(!isStatusOpen);
                  setIsTypeOpen(false);
                }}
                className="kairos-panel flex w-full min-w-0 cursor-pointer items-center justify-between gap-1.5 px-3 py-2 text-xs text-foreground transition-colors hover:bg-brand-quiet motion-reduce:transition-none sm:w-auto"
              >
                <span className="truncate">
                  {filters.status ? SOURCE_STATUS_LABELS[filters.status] : "All Statuses"}
                </span>
                <ChevronDown
                  className={cn(
                    "size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
                    isStatusOpen && "rotate-180"
                  )}
                />
              </button>

              {isStatusOpen && (
                <div className="kairos-panel absolute left-0 right-0 top-full z-30 mt-1.5 max-h-56 animate-fadeIn space-y-0.5 overflow-y-auto p-1 text-xs shadow-[var(--shadow-lift)] motion-reduce:animate-none sm:right-auto sm:w-44">
                  <button
                    type="button"
                    onClick={() => {
                      setFilters((curr) => ({ ...curr, status: undefined }));
                      setIsStatusOpen(false);
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors motion-reduce:transition-none",
                      !filters.status
                        ? "bg-primary text-primary-foreground font-semibold"
                        : "hover:bg-brand-quiet text-foreground"
                    )}
                  >
                    <span>All Statuses</span>
                    {!filters.status && <Check className="size-3.5 shrink-0" />}
                  </button>

                  {SOURCE_STATUSES.map((s) => {
                    const isSelected = filters.status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setFilters((curr) => ({ ...curr, status: s }));
                          setIsStatusOpen(false);
                        }}
                        className={cn(
                          "flex w-full cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors motion-reduce:transition-none",
                          isSelected
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "hover:bg-brand-quiet text-foreground"
                        )}
                      >
                        <span>{SOURCE_STATUS_LABELS[s]}</span>
                        {isSelected && <Check className="size-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="kairos-inset hidden items-center p-0.5 sm:flex">
              <button
                type="button"
                onClick={() => setView("grid")}
                aria-label="Grid view"
                aria-pressed={view === "grid"}
                className={cn(
                  "rounded-lg p-1.5 text-xs transition-colors motion-reduce:transition-none",
                  view === "grid"
                    ? "bg-surface text-brand shadow-[var(--shadow-panel)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Grid view"
              >
                <LayoutGrid className="size-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setView("list")}
                aria-label="List view"
                aria-pressed={view === "list"}
                className={cn(
                  "rounded-lg p-1.5 text-xs transition-colors motion-reduce:transition-none",
                  view === "list"
                    ? "bg-surface text-brand shadow-[var(--shadow-panel)]"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="List view"
              >
                <List className="size-3.5" aria-hidden="true" />
              </button>
            </div>

            {/* Selection Mode Toggle */}
            <button
              type="button"
              onClick={() => {
                if (selectionMode) exitSelectionMode();
                else setSelectionMode(true);
              }}
              className={cn(
                "col-span-2 rounded-xl border border-border bg-card px-3 py-2 text-xs text-foreground transition-colors hover:bg-brand-quiet motion-reduce:transition-none sm:col-span-1",
                selectionMode && "border-brand/30 bg-brand-soft text-brand"
              )}
            >
              {selectionMode ? "Done" : "Select"}
            </button>

            {failedCount > 0 && (
              <button
                type="button"
                disabled={reprocessFailedMutation.isPending}
                onClick={() => void reprocessFailedMutation.mutateAsync(undefined)}
                className="col-span-2 inline-flex items-center justify-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-brand-quiet disabled:opacity-50 motion-reduce:transition-none sm:col-span-1"
              >
                <RefreshCw
                  className={cn(
                    "size-3.5 shrink-0",
                    reprocessFailedMutation.isPending &&
                      "animate-spin motion-reduce:animate-none"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">
                  <span className="sm:hidden">Retry failed ({failedCount})</span>
                  <span className="hidden sm:inline">
                    Reprocess failed ({failedCount})
                  </span>
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Active Filter Chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-quiet px-2.5 py-1.5 text-xs text-muted-foreground">
            <span>
              {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""} applied
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs text-brand underline underline-offset-4 transition-colors hover:text-primary motion-reduce:transition-none"
            >
              <X className="size-3" aria-hidden="true" />
              Clear
            </button>
          </div>
        )}

        {/* Selection Toolbar */}
        {selectionMode && (
          <div className="flex flex-col gap-2 rounded-xl border border-brand/20 bg-brand-quiet p-3 text-xs sm:flex-row sm:items-center sm:justify-between">
            <span className="font-medium text-brand">
              {selectedIds.length} source{selectedIds.length === 1 ? "" : "s"} selected
            </span>
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  disabled={bulkDeleteMutation.isPending}
                  onClick={() => {
                    if (confirm(`Delete ${selectedIds.length} selected sources?`)) {
                      void bulkDeleteMutation.mutateAsync(selectedIds).then(exitSelectionMode);
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-destructive px-2.5 py-1 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 motion-reduce:transition-none"
                >
                  <Trash2 className="size-3" aria-hidden="true" />
                  Delete selected
                </button>
              )}
              <button
                type="button"
                onClick={exitSelectionMode}
                className="rounded-lg border border-border bg-surface px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sources Grid / List Content */}
      {isLoading ? (
        <div
          className={cn(
            "grid gap-2 sm:gap-3",
            view === "grid" ? "sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
          )}
          role="status"
          aria-label="Loading sources"
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "kairos-panel animate-pulse motion-reduce:animate-none",
                view === "list" ? "h-14" : "h-32",
              )}
            />
          ))}
        </div>
      ) : error ? (
        <div
          className="rounded-2xl border border-dashed border-destructive/30 bg-destructive/5 p-8 text-center text-xs text-destructive"
          role="alert"
        >
          Could not load sources. Please try again.
        </div>
      ) : sources && sources.length > 0 ? (
        <div
          className={cn(
            "grid gap-2 sm:gap-3",
            view === "grid" ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1",
          )}
        >
          {sources.map((source) => (
            <SourceCard
              key={source.id}
              source={source}
              layout={view}
              selected={selectedIds.includes(source.id)}
              onToggleSelect={selectionMode ? toggleSelectId : undefined}
              onSelect={(s) => setPreviewSource(s)}
              onDelete={(s) => {
                if (confirm(`Delete "${s.title}"?`)) {
                  deleteSourceMutation.mutate(s.id);
                }
              }}
              onReprocess={
                source.status === "FAILED"
                  ? (s) => reprocessFailedMutation.mutate([s.id])
                  : undefined
              }
            />
          ))}
        </div>
      ) : (
        <div className="space-y-3 rounded-2xl border border-dashed border-border bg-card p-12 text-center shadow-[var(--shadow-panel)]">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <BookOpen className="size-6" aria-hidden="true" />
          </div>
          <div className="space-y-0.5">
            <p className="kairos-section-title text-sm text-primary">No sources found</p>
            <p className="text-xs text-muted-foreground">
              {hasActiveFilters
                ? "Try adjusting your search or filters."
                : "Add your first source to ground this workspace."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-1.5 text-xs font-medium text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 motion-reduce:transition-none"
          >
            <Plus className="size-3.5" aria-hidden="true" />
            Add source
          </button>
        </div>
      )}

      {/* Add Source Dialog */}
      <AddSourceDialog
        workspaceId={workspaceId}
        open={addOpen}
        onOpenChange={setAddOpen}
      />

      {/* Preview Dialog */}
      <SourcePreviewDialog
        source={previewSource}
        onClose={() => setPreviewSource(null)}
      />
    </div>
  );
}
