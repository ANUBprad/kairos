"use client";

import { useState, useCallback } from "react";
import {
  FlaskConical,
  Play,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Bug,
  Columns2,
  Copy,
  Zap,
  Clock,
  Cpu,
  Layers,
  GripVertical,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { ChunkStrategy } from "@/lib/chunking/types";
import type { ProviderType } from "@/lib/ai/types";
import type { RetrievalConfig, RetrievalResultDisplay, RetrievedChunkDisplay, PerformanceMetrics } from "@/lib/retrieval/types";
import { CHUNK_STRATEGIES } from "@/lib/chunking/types";
import { EMBEDDING_MODELS, EMBEDDING_PROVIDERS, getModelInfo } from "@/lib/retrieval/embedding-models";
import {
  getKbRetrievalConfig,
  updateKbRetrievalConfig,
  executeRetrieval,
  executeComparison,
  persistRun,
} from "@/lib/actions/retrieval-lab";
import { RETRIEVAL_STRATEGIES } from "@/lib/retrieval/types";

interface RetrievalLabProps {
  kbs: { id: string; name: string; description: string | null }[];
}

type ViewMode = "single" | "compare";

const DEFAULT_CONFIG: RetrievalConfig = {
  chunkStrategy: "recursive",
  chunkSize: 1000,
  chunkOverlap: 200,
  topK: 10,
  similarityThreshold: 0.7,
  embeddingModel: "text-embedding-3-small",
  retrievalMode: "vector",
  embeddingProvider: "openai",
  retrievalStrategy: "hybrid",
  enableQueryExpansion: false,
  enableMultiQuery: false,
  enableReranking: false,
  enableCompression: false,
  vectorWeight: 1.0,
  keywordWeight: 1.0,
  rrfK: 60,
  maxContextTokens: 4000,
};

export function RetrievalLab({ kbs }: RetrievalLabProps) {
  const [selectedKbId, setSelectedKbId] = useState(kbs[0]?.id || "");
  const [config, setConfig] = useState<RetrievalConfig>(DEFAULT_CONFIG);
  const [configB, setConfigB] = useState<RetrievalConfig>(DEFAULT_CONFIG);
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<RetrievalResultDisplay | null>(null);
  const [resultB, setResultB] = useState<RetrievalResultDisplay | null>(null);
  const [loading, setLoading] = useState(false);
  const [debugMode, setDebugMode] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("single");
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [showConfig, setShowConfig] = useState(true);
  const loadConfig = useCallback(async (kbId: string) => {
    if (!kbId) return;
    try {
      const cfg = await getKbRetrievalConfig(kbId);
      setConfig(cfg);
      setConfigB({ ...cfg, chunkSize: Math.min(cfg.chunkSize + 500, 3000) });
    } catch {
      setConfig(DEFAULT_CONFIG);
    }
  }, []);

  const handleKbChange = (kbId: string) => {
    setSelectedKbId(kbId);
    setResult(null);
    setResultB(null);
    loadConfig(kbId);
  };

  const handleSaveConfig = async () => {
    if (!selectedKbId) return;
    try {
      await updateKbRetrievalConfig(selectedKbId, config);
      toast.success("Configuration saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const handleRun = async () => {
    if (!selectedKbId || !query.trim()) {
      toast.error("Select a knowledge base and enter a query");
      return;
    }
    setLoading(true);
    try {
      if (viewMode === "compare") {
        const res = await executeComparison(selectedKbId, query.trim(), config, configB, debugMode);
        setResult(res.a);
        setResultB(res.b);
      } else {
        const res = await executeRetrieval(selectedKbId, query.trim(), config, debugMode);
        setResult(res);
        setResultB(null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Retrieval failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRun = async () => {
    if (!selectedKbId || !result) return;
    try {
      await persistRun(selectedKbId, query.trim(), config, result);
      toast.success("Run saved to history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    }
  };

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    setConfigB(DEFAULT_CONFIG);
    toast.success("Configuration reset");
  };

  const toggleChunk = (id: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const ScoreBar = ({ score }: { score: number }) => {
    const pct = Math.round(score * 100);
    const color = score >= 0.9 ? "bg-success" : score >= 0.8 ? "bg-brand" : score >= 0.7 ? "bg-warning" : "bg-info/60";
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full bg-bg overflow-hidden">
          <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs font-mono text-text-secondary w-10 text-right">{pct}%</span>
      </div>
    );
  };

  const MetricsCard = ({ metrics }: { metrics: PerformanceMetrics; label?: string }) => (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      <div className="rounded-xl border border-border bg-bg/50 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-tertiary mb-1">
          <Clock size={12} />
          Total
        </div>
        <p className="text-lg font-semibold text-text-primary font-mono">{metrics.totalMs.toFixed(1)}ms</p>
      </div>
      <div className="rounded-xl border border-border bg-bg/50 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-tertiary mb-1">
          <Zap size={12} />
          Embedding
        </div>
        <p className="text-lg font-semibold text-text-primary font-mono">{metrics.embeddingMs.toFixed(1)}ms</p>
      </div>
      <div className="rounded-xl border border-border bg-bg/50 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-tertiary mb-1">
          <Cpu size={12} />
          Vector Search
        </div>
        <p className="text-lg font-semibold text-text-primary font-mono">{metrics.vectorSearchMs.toFixed(1)}ms</p>
      </div>
      <div className="rounded-xl border border-border bg-bg/50 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-tertiary mb-1">
          <Layers size={12} />
          Chunks
        </div>
        <p className="text-lg font-semibold text-text-primary font-mono">{result?.totalChunks || 0}</p>
      </div>
      <div className="rounded-xl border border-border bg-bg/50 p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-text-tertiary mb-1">
          <GripVertical size={12} />
          Model Dims
        </div>
        <p className="text-lg font-semibold text-text-primary font-mono">{getModelInfo(config.embeddingModel)?.dimensions || "-"}</p>
      </div>
    </div>
  );

  function ConfigPanel({
    cfg,
    onChange,
    label,
  }: {
    cfg: RetrievalConfig;
    onChange: (c: RetrievalConfig) => void;
    label?: string;
  }) {
    const update = (partial: Partial<RetrievalConfig>) => onChange({ ...cfg, ...partial });

    return (
      <div className="space-y-4">
        {label && <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">{label}</p>}
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Chunk Strategy</label>
          <select
            value={cfg.chunkStrategy}
            onChange={(e) => update({ chunkStrategy: e.target.value as ChunkStrategy })}
            className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          >
            {CHUNK_STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Chunk Size</label>
            <input
              type="number"
              value={cfg.chunkSize}
              onChange={(e) => update({ chunkSize: Math.max(100, Math.min(8000, Number(e.target.value))) })}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
              min={100}
              max={8000}
              step={100}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Overlap</label>
            <input
              type="number"
              value={cfg.chunkOverlap}
              onChange={(e) => update({ chunkOverlap: Math.max(0, Math.min(cfg.chunkSize, Number(e.target.value))) })}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
              min={0}
              max={cfg.chunkSize}
              step={50}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Top-K</label>
            <input
              type="number"
              value={cfg.topK}
              onChange={(e) => update({ topK: Math.max(1, Math.min(100, Number(e.target.value))) })}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
              min={1}
              max={100}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">Similarity Threshold</label>
            <input
              type="number"
              value={cfg.similarityThreshold}
              onChange={(e) => update({ similarityThreshold: Math.max(0, Math.min(1, Number(e.target.value))) })}
              className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
              min={0}
              max={1}
              step={0.05}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Embedding Provider</label>
          <select
            value={cfg.embeddingProvider}
            onChange={(e) => {
              const provider = e.target.value as ProviderType;
              const defaultModel = provider === "gemini" ? "text-embedding-004" : "text-embedding-3-small";
              update({ embeddingProvider: provider, embeddingModel: defaultModel });
            }}
            className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          >
            {EMBEDDING_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Embedding Model</label>
          <select
            value={cfg.embeddingModel}
            onChange={(e) => update({ embeddingModel: e.target.value })}
            className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          >
            {EMBEDDING_MODELS.filter((m) => m.provider === cfg.embeddingProvider).map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} ({m.dimensions}d)
              </option>
            ))}
          </select>
          {getModelInfo(cfg.embeddingModel) && (
            <p className="mt-1 text-[11px] text-text-tertiary">
              {getModelInfo(cfg.embeddingModel)!.dimensions} dimensions · ${getModelInfo(cfg.embeddingModel)!.costPer1kTokens.toFixed(5)}/1K tokens
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary mb-1.5 block">Retrieval Strategy</label>
          <select
            value={cfg.retrievalStrategy || cfg.retrievalMode}
            onChange={(e) => update({ retrievalStrategy: e.target.value as RetrievalConfig["retrievalStrategy"], retrievalMode: e.target.value as RetrievalConfig["retrievalMode"] })}
            className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary focus:border-brand focus:outline-none"
          >
            {RETRIEVAL_STRATEGIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {(cfg.retrievalStrategy === "hybrid" || cfg.retrievalMode === "hybrid") && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Vector Weight</label>
              <input
                type="number"
                value={cfg.vectorWeight ?? 1.0}
                onChange={(e) => update({ vectorWeight: Math.max(0, Math.min(2, Number(e.target.value))) })}
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
                min={0}
                max={2}
                step={0.1}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-text-secondary mb-1.5 block">Keyword Weight</label>
              <input
                type="number"
                value={cfg.keywordWeight ?? 1.0}
                onChange={(e) => update({ keywordWeight: Math.max(0, Math.min(2, Number(e.target.value))) })}
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-text-primary font-mono focus:border-brand focus:outline-none"
                min={0}
                max={2}
                step={0.1}
              />
            </div>
          </div>
        )}

        <div className="space-y-2 border-t border-border pt-3 mt-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Advanced Options</p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.enableQueryExpansion ?? false}
              onChange={(e) => update({ enableQueryExpansion: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-xs text-text-secondary">Query Expansion (LLM)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.enableMultiQuery ?? false}
              onChange={(e) => update({ enableMultiQuery: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-xs text-text-secondary">Multi-Query (semantic variations)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.enableReranking ?? false}
              onChange={(e) => update({ enableReranking: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-xs text-text-secondary">Reranking (LLM)</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={cfg.enableCompression ?? false}
              onChange={(e) => update({ enableCompression: e.target.checked })}
              className="rounded border-border"
            />
            <span className="text-xs text-text-secondary">Context Compression</span>
          </label>
        </div>
      </div>
    );
  }

  function ChunkCard({ chunk }: { chunk: RetrievedChunkDisplay }) {
    const expanded = expandedChunks.has(chunk.id);
    return (
      <div className="rounded-xl border border-border bg-bg/30 overflow-hidden transition-all hover:border-border-hover">
        <div className="flex items-start justify-between gap-3 p-3 cursor-pointer" onClick={() => toggleChunk(chunk.id)}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <Badge variant="brand">#{chunk.rank}</Badge>
              <Badge variant="info">{Math.round(chunk.similarity * 100)}%</Badge>
              <Badge variant="default">d={chunk.cosineDistance.toFixed(4)}</Badge>
              <span className="text-xs text-text-tertiary truncate">{chunk.documentName}</span>
              {chunk.pageNumber && <span className="text-xs text-text-tertiary">p.{chunk.pageNumber}</span>}
            </div>
            <p className="text-sm text-text-secondary line-clamp-2">{chunk.content}</p>
          </div>
          <button className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors">
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {expanded && (
          <div className="border-t border-border px-3 py-3 space-y-2">
            <p className="text-sm text-text-primary whitespace-pre-wrap">{chunk.content}</p>
            <div className="flex items-center gap-3 text-xs text-text-tertiary">
              <span>Chunk ID: {chunk.id.slice(0, 12)}...</span>
              <span>Index: {chunk.index}</span>
              <span>Tokens: {chunk.tokenCount || "?"}</span>
            </div>
            <div className="pt-1">
              <ScoreBar score={chunk.similarity} />
            </div>
            <button
              onClick={() => copyToClipboard(chunk.content)}
              className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              <Copy size={12} />
              Copy chunk text
            </button>
          </div>
        )}
      </div>
    );
  }

  function ResultsPanel({ res, config: cfg }: { res: RetrievalResultDisplay; config: RetrievalConfig }) {
    return (
      <div className="space-y-4">
        <MetricsCard metrics={res.metrics} />

        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text-primary">
            Retrieved Chunks ({res.totalChunks})
          </h3>
          <div className="flex items-center gap-2">
            <Badge variant="default">{cfg.chunkStrategy}</Badge>
            <Badge variant="default">{cfg.embeddingModel}</Badge>
          </div>
        </div>

        <div className="space-y-2">
          {res.chunks.map((chunk) => (
            <ChunkCard key={chunk.id} chunk={chunk} />
          ))}
          {res.chunks.length === 0 && (
            <div className="text-center py-12 text-text-tertiary">
              <Search size={24} className="mx-auto mb-2 opacity-50" />
              <p className="text-sm">No chunks retrieved. Try adjusting the similarity threshold or query.</p>
            </div>
          )}
        </div>

        {debugMode && res.debug && (
          <Card className="space-y-3 !p-4">
            <div className="flex items-center gap-2 text-text-primary">
              <Bug size={16} />
              <h3 className="text-sm font-semibold">Debug Information</h3>
            </div>
            <div className="space-y-2 text-xs font-mono">
              <div>
                <span className="text-text-tertiary">Generated Query: </span>
                <span className="text-text-secondary">{res.debug.generatedQuery}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Expanded Query: </span>
                <span className="text-text-secondary">{res.debug.expandedQuery}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Applied Filters: </span>
                <span className="text-text-secondary">{JSON.stringify(res.debug.appliedFilters)}</span>
              </div>
              <div>
                <span className="text-text-tertiary">Total Tokens: </span>
                <span className="text-text-secondary">{res.debug.totalTokens}</span>
              </div>
              <div className="pt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-text-tertiary">Final Prompt:</span>
                  <button
                    onClick={() => copyToClipboard(res.debug!.finalPrompt)}
                    className="flex items-center gap-1 text-text-tertiary hover:text-text-primary"
                  >
                    <Copy size={12} />
                    Copy
                  </button>
                </div>
                <pre className="rounded-lg bg-bg p-3 text-text-secondary text-[11px] max-h-40 overflow-y-auto whitespace-pre-wrap">
                  {res.debug.finalPrompt}
                </pre>
              </div>
            </div>
          </Card>
        )}
      </div>
    );
  }

  if (kbs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10">
          <FlaskConical className="h-6 w-6 text-brand" />
        </div>
        <h1 className="text-xl font-semibold text-text-primary">Retrieval Lab</h1>
        <p className="mt-2 text-sm text-text-secondary max-w-md">
          Create a knowledge base and upload documents first to start experimenting with retrieval.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Retrieval Lab</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Configure, test, and compare retrieval strategies
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={debugMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setDebugMode(!debugMode)}
          >
            <Bug size={14} />
            Debug
          </Button>
          <Button
            variant={viewMode === "compare" ? "primary" : "secondary"}
            size="sm"
            onClick={() => setViewMode(viewMode === "single" ? "compare" : "single")}
          >
            <Columns2 size={14} />
            {viewMode === "single" ? "Compare" : "Single"}
          </Button>
        </div>
      </div>

      <div className="mb-6">
        <select
          value={selectedKbId}
          onChange={(e) => handleKbChange(e.target.value)}
          className="w-full max-w-md rounded-[10px] border border-border bg-surface px-4 py-2.5 text-sm text-text-primary focus:border-brand focus:outline-none"
        >
          {kbs.map((kb) => (
            <option key={kb.id} value={kb.id}>{kb.name}</option>
          ))}
        </select>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-4">
          <Card className="!p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-text-primary">
                <SlidersHorizontal size={16} />
                <h2 className="text-sm font-semibold">Configuration</h2>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={handleSaveConfig}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
                  title="Save config"
                >
                  <Save size={14} />
                </button>
                <button
                  onClick={resetConfig}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
                  title="Reset"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  onClick={() => setShowConfig(!showConfig)}
                  className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-surface-hover transition-colors"
                >
                  {showConfig ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            </div>
            {showConfig && <ConfigPanel cfg={config} onChange={setConfig} />}
          </Card>

          {viewMode === "compare" && (
            <Card className="!p-4 border-brand/30">
              <div className="flex items-center gap-2 mb-4 text-brand">
                <Columns2 size={16} />
                <h2 className="text-sm font-semibold">Configuration B</h2>
              </div>
              <ConfigPanel cfg={configB} onChange={setConfigB} label="Comparison Config" />
            </Card>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter a test query to retrieve chunks..."
                rows={2}
                className="w-full rounded-[10px] border border-border bg-surface px-4 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary resize-none focus:outline-none focus:border-brand"
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleRun(); } }}
              />
            </div>
            <Button
              variant="primary"
              onClick={handleRun}
              disabled={loading || !query.trim()}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Play size={16} />
                  Run
                </span>
              )}
            </Button>
            {result && (
              <Button variant="secondary" onClick={handleSaveRun}>
                <Save size={16} />
                Save
              </Button>
            )}
          </div>

          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <div className="h-8 w-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-text-secondary">Running retrieval...</p>
              </div>
            </div>
          )}

          {!loading && result && viewMode === "single" && (
            <ResultsPanel res={result} config={config} />
          )}

          {!loading && result && viewMode === "compare" && resultB && (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-text-primary">
                  <Badge variant="brand">A</Badge>
                  <span className="text-sm font-semibold">Configuration A</span>
                </div>
                <ResultsPanel res={result} config={config} />
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-text-primary">
                  <Badge variant="info">B</Badge>
                  <span className="text-sm font-semibold">Configuration B</span>
                </div>
                <ResultsPanel res={resultB} config={configB} />
              </div>
            </div>
          )}

          {!loading && !result && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FlaskConical size={40} className="text-text-tertiary mb-4" />
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                Ready to Experiment
              </h2>
              <p className="text-sm text-text-secondary max-w-md">
                Configure your retrieval settings on the left, enter a query above, and click Run to see how different strategies affect retrieval quality.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
