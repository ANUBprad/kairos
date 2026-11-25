"use client";

import React, { useState } from "react";
import { Source } from "../lib/types";
import { SourceItem } from "./source-item";
import { AddSourceDialog } from "./add-source-dialog";
import { SourcePreviewDialog } from "./source-preview-dialog";
import {
  Plus,
  Search,
  CheckSquare,
  Square,
  FileBox,
  Layers,
} from "lucide-react";
import { useReprocessSource } from "../hooks/use-sources";

interface SourcesPanelProps {
  workspaceId?: string;
  sources: Source[];
  selectedSourceIds: string[];
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onUploadPdf: (file: File, title?: string) => Promise<unknown>;
  onImportWebsite: (url: string, title?: string) => Promise<unknown>;
  onImportYoutube: (url: string, title?: string) => Promise<unknown>;
  onCreateTextSource: (title: string, content: string) => Promise<unknown>;
  onDeleteSource: (id: string) => Promise<unknown>;
  isLoading?: boolean;
}

export function SourcesPanel({
  workspaceId,
  sources,
  selectedSourceIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onUploadPdf,
  onImportWebsite,
  onImportYoutube,
  onCreateTextSource,
  onDeleteSource,
  isLoading,
}: SourcesPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [previewSource, setPreviewSource] = useState<Source | null>(null);
  const reprocessMutation = useReprocessSource(workspaceId ?? "");

  const filteredSources = sources.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const allSelected =
    sources.length > 0 && selectedSourceIds.length === sources.length;

  return (
    <div className="flex h-full select-none flex-col border-r border-border bg-panel text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Layers className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
          <span className="kairos-eyebrow truncate">Sources</span>
          <span className="kairos-tag font-mono text-[10px]">
            {sources.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          aria-label="Add source"
          className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[11px] font-medium text-primary-foreground transition-colors hover:opacity-90 motion-reduce:transition-none"
        >
          <Plus className="size-3" aria-hidden="true" />
          <span>Add</span>
        </button>
      </div>

      {/* Search & selection controls */}
      <div className="space-y-1.5 border-b border-border bg-surface/50 px-3 py-2">
        <label className="relative block">
          <span className="sr-only">Search sources</span>
          <Search
            className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sources..."
            className="w-full rounded-lg border border-border bg-muted py-1 pl-7 pr-2 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring/30"
          />
        </label>

        {sources.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={allSelected ? onDeselectAll : onSelectAll}
              aria-pressed={allSelected}
              className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-brand focus-visible:text-brand motion-reduce:transition-none"
            >
              {allSelected ? (
                <CheckSquare className="size-3.5 shrink-0 text-brand" aria-hidden="true" />
              ) : (
                <Square className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              <span className="truncate">
                {allSelected ? "Deselect all" : "Select all"}
              </span>
            </button>

            <span className="kairos-tag shrink-0 font-mono text-[10px]">
              {selectedSourceIds.length}/{sources.length} active
            </span>
          </div>
        )}
      </div>

      {/* Sources list */}
      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {isLoading ? (
          <div
            className="space-y-1.5"
            role="status"
            aria-label="Loading sources"
            aria-busy="true"
          >
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-10 rounded-lg border border-border bg-muted/60"
              />
            ))}
          </div>
        ) : sources.length === 0 ? (
          <div
            role="status"
            className="flex h-full flex-col items-center justify-center gap-2 px-3 py-6 text-center"
          >
            <div className="flex items-center gap-1.5 text-foreground">
              <FileBox className="size-4 text-brand" aria-hidden="true" />
              <span className="text-xs font-medium">No sources yet</span>
            </div>
            <p className="max-w-56 text-[11px] leading-relaxed text-muted-foreground">
              Add PDFs, websites, or YouTube links to ground this workspace.
            </p>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:bg-brand-quiet motion-reduce:transition-none"
            >
              <Plus className="size-3" aria-hidden="true" />
              <span>Add first source</span>
            </button>
          </div>
        ) : filteredSources.length === 0 ? (
          <div
            role="status"
            className="flex h-full flex-col items-center justify-center gap-1 px-3 py-6 text-center"
          >
            <span className="text-xs font-medium text-foreground">
              No matching sources
            </span>
            <span className="text-[11px] text-muted-foreground">
              Try a different title.
            </span>
          </div>
        ) : (
          filteredSources.map((source) => (
            <SourceItem
              key={source.id}
              source={source}
              isSelected={selectedSourceIds.includes(source.id)}
              onToggleSelect={onToggleSelect}
              onDelete={onDeleteSource}
              onPreview={(s) => setPreviewSource(s)}
              onRetry={
                workspaceId
                  ? (id) => reprocessMutation.mutate(id)
                  : undefined
              }
              isRetrying={
                reprocessMutation.isPending &&
                reprocessMutation.variables === source.id
              }
            />
          ))
        )}
      </div>

      <AddSourceDialog
        workspaceId={workspaceId}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onUploadPdf={onUploadPdf}
        onImportWebsite={onImportWebsite}
        onImportYoutube={onImportYoutube}
        onCreateTextSource={onCreateTextSource}
      />

      <SourcePreviewDialog
        source={previewSource}
        onClose={() => setPreviewSource(null)}
      />
    </div>
  );
}
