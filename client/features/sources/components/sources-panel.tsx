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
  Sparkles,
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
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const allSelected =
    sources.length > 0 && selectedSourceIds.length === sources.length;

  return (
    <div className="flex h-full select-none flex-col border-r border-border bg-panel text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <Layers className="size-4 text-brand" />
          <span className="kairos-eyebrow">Sources</span>
          <span className="kairos-tag font-mono">{sources.length}</span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddOpen(true)}
          aria-label="Add source"
          className="flex items-center gap-1 rounded-lg bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground shadow-[var(--shadow-panel)] transition-colors hover:opacity-90 motion-reduce:transition-none"
        >
          <Plus className="size-3.5" aria-hidden="true" />
          <span>Add</span>
        </button>
      </div>

      {/* Sub-header: Search & Select All toggle */}
      <div className="space-y-2 border-b border-border bg-surface/60 p-3">
        <label className="relative block">
          <span className="sr-only">Search sources</span>
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sources..."
            className="kairos-inset w-full py-1.5 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
          />
        </label>

        {sources.length > 0 && (
          <div className="flex items-center justify-between rounded-lg bg-brand-quiet px-2 py-1.5 text-[11px] text-muted-foreground">
            <button
              type="button"
              onClick={allSelected ? onDeselectAll : onSelectAll}
              className="flex items-center gap-1.5 transition-colors hover:text-brand motion-reduce:transition-none"
            >
              {allSelected ? (
                <CheckSquare className="size-3.5 text-brand" aria-hidden="true" />
              ) : (
                <Square className="size-3.5" aria-hidden="true" />
              )}
              <span>{allSelected ? "Deselect all" : "Select all"}</span>
            </button>

            <span className="kairos-tag px-1.5 py-0 font-mono text-[10px]">
              {selectedSourceIds.length}/{sources.length} active
            </span>
          </div>
        )}
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {isLoading ? (
          <div className="space-y-2" role="status" aria-label="Loading sources">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="kairos-panel h-14 animate-pulse motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : filteredSources.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-3 p-6 text-center text-muted-foreground">
            <div className="flex size-11 items-center justify-center rounded-full bg-brand-soft text-brand">
              <FileBox className="size-5" aria-hidden="true" />
            </div>
            <div className="space-y-1">
              <p className="kairos-section-title text-sm text-primary">
                No sources yet
              </p>
              <p className="mx-auto max-w-52 text-[11px] text-muted-foreground">
                Add PDFs, websites, or YouTube links to ground this workspace.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-brand/30 bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand transition-colors hover:bg-brand-soft/70 motion-reduce:transition-none"
            >
              <Plus className="size-3.5" aria-hidden="true" />
              <span>Add first source</span>
            </button>
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

      {/* Add Source Dialog Modal */}
      <AddSourceDialog
        workspaceId={workspaceId}
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onUploadPdf={onUploadPdf}
        onImportWebsite={onImportWebsite}
        onImportYoutube={onImportYoutube}
        onCreateTextSource={onCreateTextSource}
      />


      {/* Source Preview Dialog Modal */}
      <SourcePreviewDialog
        source={previewSource}
        onClose={() => setPreviewSource(null)}
      />
    </div>
  );
}
