"use client";

import { useState, useMemo } from "react";
import { Scissors, Copy, FileText, Layers, Hash, Type } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chunkText, estimateChunkStats, CHUNK_STRATEGIES } from "@/lib/chunking";
import type { ChunkStrategy, Chunk } from "@/lib/chunking/types";
import { toast } from "sonner";

const SAMPLE_TEXT = `# Introduction to Retrieval-Augmented Generation

Retrieval-Augmented Generation (RAG) is a framework that enhances large language models by providing them with relevant external knowledge during inference.

## How RAG Works

The RAG pipeline consists of several stages. First, documents are ingested and split into chunks. Each chunk is converted into a vector embedding using a language model. When a user submits a query, it is also embedded and compared against the document embeddings using cosine similarity.

## Chunking Strategies

The choice of chunking strategy significantly impacts retrieval quality. Recursive chunking splits text on natural boundaries like paragraphs and sentences. Fixed-size chunking creates uniform segments. Markdown-aware chunking preserves document structure.

## Why Chunking Matters

Chunk size affects both retrieval precision and context window usage. Smaller chunks may miss context while larger chunks may include irrelevant information. The optimal chunk size depends on your document type and query patterns.`;

export function ChunkingStudio() {
  const [text, setText] = useState(SAMPLE_TEXT);
  const [strategy, setStrategy] = useState<ChunkStrategy>("recursive");
  const [chunkSize, setChunkSize] = useState(500);
  const [overlap, setOverlap] = useState(50);
  const [expandedChunks, setExpandedChunks] = useState<Set<number>>(new Set());

  const stats = useMemo(() => estimateChunkStats(text, { strategy, chunkSize, overlap }), [text, strategy, chunkSize, overlap]);
  const chunks = useMemo(() => chunkText(text, { strategy, chunkSize, overlap }), [text, strategy, chunkSize, overlap]);

  const toggleChunk = (i: number) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const copyAll = () => {
    const content = chunks.map((c, i) => `[Chunk ${i + 1}]\n${c.content}`).join("\n\n---\n\n");
    navigator.clipboard.writeText(content);
    toast.success("Copied all chunks");
  };

  const selectedStrategy = CHUNK_STRATEGIES.find((s) => s.value === strategy);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-text-primary">Chunking Studio</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Explore how different chunking strategies partition text.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card className="!p-4 space-y-4">
            <div className="flex items-center gap-2 text-text-primary">
              <Scissors size={16} />
              <h2 className="text-sm font-semibold">Configuration</h2>
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Strategy</label>
              <select
                value={strategy}
                onChange={(e) => setStrategy(e.target.value as ChunkStrategy)}
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
              >
                {CHUNK_STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {selectedStrategy && (
                <p className="mt-1 text-[11px] text-text-tertiary">{selectedStrategy.description}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Chunk Size</label>
              <input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(Math.max(50, Math.min(4000, Number(e.target.value))))}
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Overlap</label>
              <input
                type="number"
                value={overlap}
                onChange={(e) => setOverlap(Math.max(0, Math.min(chunkSize, Number(e.target.value))))}
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
              />
            </div>
          </Card>

          <Card className="!p-4 space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Statistics</h2>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <Layers size={13} />
                  Estimated Chunks
                </span>
                <span className="text-text-primary font-mono font-medium">{stats.estimatedChunkCount}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <Type size={13} />
                  Avg Chunk Size
                </span>
                <span className="text-text-primary font-mono font-medium">{stats.averageChunkSize} chars</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <Hash size={13} />
                  Avg Token Count
                </span>
                <span className="text-text-primary font-mono font-medium">{stats.averageTokenCount} tokens</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <FileText size={13} />
                  Total Characters
                </span>
                <span className="text-text-primary font-mono font-medium">{stats.totalCharacters}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary flex items-center gap-1.5">
                  <Scissors size={13} />
                  Actual Chunks
                </span>
                <span className="text-text-primary font-mono font-medium">{chunks.length}</span>
              </div>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <Card className="!p-4">
            <label className="text-xs font-medium text-text-secondary mb-2 block">Sample Text</label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={8}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none resize-y"
            />
          </Card>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-text-primary">
                Chunks ({chunks.length})
              </h2>
              <Badge variant="brand">{strategy}</Badge>
              <Badge variant="default">size={chunkSize}</Badge>
              <Badge variant="default">overlap={overlap}</Badge>
            </div>
            <Button variant="secondary" size="sm" onClick={copyAll}>
              <Copy size={13} />
              Copy all
            </Button>
          </div>

          <div className="space-y-2">
            {chunks.map((chunk, i) => (
              <ChunkPreview
                key={i}
                chunk={chunk}
                index={i}
                total={chunks.length}
                expanded={expandedChunks.has(i)}
                onToggle={() => toggleChunk(i)}
              />
            ))}
            {chunks.length === 0 && (
              <div className="text-center py-12 text-text-tertiary">
                <p className="text-sm">No chunks produced with the current configuration.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChunkPreview({
  chunk,
  index,
  total,
  expanded,
  onToggle,
}: {
  chunk: Chunk;
  index: number;
  total: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const pct = total > 1 ? Math.round(((index + 1) / total) * 100) : 100;
  const colors = [
    "bg-brand/80", "bg-blue-500/80", "bg-purple-500/80", "bg-emerald-500/80",
    "bg-amber-500/80", "bg-rose-500/80", "bg-cyan-500/80", "bg-indigo-500/80",
  ];

  return (
    <div className="rounded-xl border border-border bg-bg/30 overflow-hidden transition-all hover:border-border-hover">
      <div className="flex items-center gap-3 px-3 py-2 cursor-pointer" onClick={onToggle}>
        <div className={`w-1 h-8 rounded-full shrink-0 ${colors[index % colors.length]}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <span className="font-medium text-text-primary">Chunk {index + 1}</span>
            <span>{chunk.content.length} chars</span>
            {chunk.tokenCount && <span>~{chunk.tokenCount} tokens</span>}
          </div>
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-1">{chunk.content.slice(0, 120)}...</p>
        </div>
        <div className="text-xs text-text-tertiary tabular-nums">{pct}%</div>
      </div>
      {expanded && (
        <div className="border-t border-border px-3 py-3">
          <p className="text-sm text-text-primary whitespace-pre-wrap font-mono text-[13px] leading-relaxed">
            {chunk.content}
          </p>
          <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
            <span>Index: {chunk.index}</span>
            <span>Chars: {chunk.content.length}</span>
            {chunk.tokenCount && <span>Tokens: {chunk.tokenCount}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
