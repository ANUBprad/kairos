"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Hash,
  Type,
  Braces,
} from "lucide-react";
import type { DocumentChunkData } from "./types";

interface ChunkExplorerProps {
  chunks: DocumentChunkData[];
  className?: string;
}

export function ChunkExplorer({ chunks, className }: ChunkExplorerProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"content" | "metadata" | "split">("content");

  const filtered = search
    ? chunks.filter((c) =>
        c.content.toLowerCase().includes(search.toLowerCase()) ||
        c.index.toString().includes(search)
      )
    : chunks;

  const currentChunk = filtered[selectedIndex] || filtered[0];

  const handleCopy = async () => {
    if (!currentChunk) return;
    await navigator.clipboard.writeText(currentChunk.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrev = () => setSelectedIndex((i) => Math.max(0, i - 1));
  const handleNext = () => setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));

  if (chunks.length === 0) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <Hash size={24} className="mx-auto text-text-tertiary mb-2" />
        <p className="text-sm text-text-tertiary">No chunks yet</p>
        <p className="text-xs text-text-tertiary mt-1">Chunks are created during document processing</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {filtered.length} chunk{filtered.length !== 1 ? "s" : ""}
          </span>
          {search && (
            <span className="text-xs text-text-tertiary">
              (filtered from {chunks.length})
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setViewMode("content")}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              viewMode === "content" ? "bg-brand/10 text-brand" : "text-text-tertiary hover:bg-surface-hover"
            )}
          >
            <Type size={12} className="inline mr-1" />
            Content
          </button>
          <button
            onClick={() => setViewMode("metadata")}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              viewMode === "metadata" ? "bg-brand/10 text-brand" : "text-text-tertiary hover:bg-surface-hover"
            )}
          >
            <Braces size={12} className="inline mr-1" />
            Metadata
          </button>
          <button
            onClick={() => setViewMode("split")}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              viewMode === "split" ? "bg-brand/10 text-brand" : "text-text-tertiary hover:bg-surface-hover"
            )}
          >
            Split
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search chunks..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setSelectedIndex(0); }}
          className="w-full rounded-lg border border-border bg-bg py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-brand focus:outline-none"
          aria-label="Search chunks"
        />
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-tertiary">
          Chunk {selectedIndex + 1} of {filtered.length}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handlePrev}
            disabled={selectedIndex === 0}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-hover disabled:opacity-30"
            aria-label="Previous chunk"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            onClick={handleNext}
            disabled={selectedIndex >= filtered.length - 1}
            className="flex h-7 w-7 items-center justify-center rounded-md text-text-tertiary hover:bg-surface-hover disabled:opacity-30"
            aria-label="Next chunk"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {/* Chunk List + Detail */}
      <div className={cn(
        "grid gap-3",
        viewMode === "split" ? "lg:grid-cols-2" : "grid-cols-1"
      )}>
        {/* Chunk List */}
        {(viewMode === "content" || viewMode === "split") && (
          <div className="space-y-1.5 max-h-[400px] overflow-y-auto rounded-lg border border-border p-2">
            {filtered.map((chunk, i) => (
              <button
                key={chunk.id}
                onClick={() => setSelectedIndex(i)}
                className={cn(
                  "w-full text-left rounded-md p-2.5 text-xs transition-colors",
                  i === selectedIndex
                    ? "bg-brand/10 border border-brand/20"
                    : "hover:bg-surface-hover border border-transparent"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-[10px] text-text-tertiary">#{chunk.index}</span>
                  {chunk.tokenCount && (
                    <span className="text-[10px] text-text-tertiary">{chunk.tokenCount} tokens</span>
                  )}
                </div>
                <p className="text-text-secondary line-clamp-3 leading-relaxed">
                  {chunk.content}
                </p>
              </button>
            ))}
          </div>
        )}

        {/* Detail View */}
        {currentChunk && (viewMode === "metadata" || viewMode === "split") && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-text-primary">
                Chunk #{currentChunk.index}
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-hover transition-colors"
              >
                {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <div className="rounded-lg border border-border bg-bg p-4">
              <pre className="text-xs text-text-secondary whitespace-pre-wrap font-mono leading-relaxed">
                {currentChunk.content}
              </pre>
            </div>
            {currentChunk.metadata && Object.keys(currentChunk.metadata).length > 0 && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  Chunk Metadata
                </p>
                <div className="space-y-1.5">
                  {Object.entries(currentChunk.metadata).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <span className="text-xs text-text-tertiary">{key}</span>
                      <span className="text-xs font-mono text-text-primary">
                        {typeof value === "object" ? JSON.stringify(value) : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {currentChunk.embedding && (
              <div className="rounded-lg border border-border p-3">
                <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                  Embedding
                </p>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-text-tertiary">Model</span>
                    <span className="text-xs font-mono text-text-primary">{currentChunk.embedding.model}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-text-tertiary">Dimensions</span>
                    <span className="text-xs font-mono text-text-primary">{currentChunk.embedding.dimensions}</span>
                  </div>
                  <div className="flex items-center justify-between py-1">
                    <span className="text-xs text-text-tertiary">Status</span>
                    <span className={cn(
                      "text-xs font-mono",
                      currentChunk.embedding.status === "completed" ? "text-success" : "text-text-primary"
                    )}>
                      {currentChunk.embedding.status}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
