"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Eye, Search, MessageSquare, GitBranch, AlertTriangle,
  ChevronDown, ChevronRight, Copy, Check, Play,
  SkipForward, ChevronLeft, Download, X,
} from "lucide-react";
import type { RetrievalTrace, RetrievalStep, RetrievalChunk } from "@/lib/retrieval/debugger";
import {
  getPromptTokenBreakdown,
  findCitationsInAnswer,
  getCitationCoverage,
  analyzeWhyNotRetrieved,
  getWhyNotRetrievedInsights,
  truncateContent,
  highlightSimilarity,
} from "@/lib/retrieval/debugger";

interface RetrievalDebuggerProps {
  trace: RetrievalTrace;
  allChunks?: Array<{
    chunkId: string;
    content: string;
    documentName: string;
    embedding: number[];
  }>;
  answerText?: string;
}

interface PipelineStage {
  id: string;
  label: string;
  icon: typeof Eye;
  latencyMs: number;
  config: Record<string, unknown>;
  metrics: Record<string, string | number>;
  intermediateOutput: unknown;
  steps: RetrievalStep[];
}

type Tab = "chunks" | "prompt" | "citations" | "why-not";

function mapTraceToPipeline(trace: RetrievalTrace, chunks: RetrievalChunk[], tokenBreakdown: ReturnType<typeof getPromptTokenBreakdown>): PipelineStage[] {
  const embeddingStep = trace.steps.find((s) => s.step.toLowerCase().includes("embed"));
  const vectorSearchStep = trace.steps.find((s) => s.step.toLowerCase().includes("vector") || s.step.toLowerCase().includes("search"));
  const filteringStep = trace.steps.find((s) => s.step.toLowerCase().includes("filter"));
  const rankingStep = trace.steps.find((s) => s.step.toLowerCase().includes("rank") || s.step.toLowerCase().includes("rerank"));
  const promptStep = trace.steps.find((s) => s.step.toLowerCase().includes("prompt"));
  const llmStep = trace.steps.find((s) => s.step.toLowerCase().includes("llm") || s.step.toLowerCase().includes("generat"));
  const citationStep = trace.steps.find((s) => s.step.toLowerCase().includes("citation"));

  return [
    {
      id: "question",
      label: "Question",
      icon: Search,
      latencyMs: 0,
      config: { strategy: trace.strategy },
      metrics: { queryLength: trace.query.length },
      intermediateOutput: { query: trace.query },
      steps: [],
    },
    {
      id: "embedding",
      label: "Embedding",
      icon: GitBranch,
      latencyMs: trace.embeddingLatencyMs,
      config: { model: (trace.config as Record<string, unknown>).embeddingModel ?? "default" },
      metrics: { dimensions: trace.embedding.length },
      intermediateOutput: embeddingStep?.output ?? { vector: `[${trace.embedding.slice(0, 5).join(", ")}, ... (${trace.embedding.length}d)]` },
      steps: embeddingStep ? [embeddingStep] : [],
    },
    {
      id: "vector-search",
      label: "Vector Search",
      icon: Search,
      latencyMs: vectorSearchStep?.latencyMs ?? 0,
      config: { topK: (trace.config as Record<string, unknown>).topK ?? "default" },
      metrics: { candidatesFound: trace.retrievedChunks.length },
      intermediateOutput: vectorSearchStep?.output ?? trace.retrievedChunks.map((c) => ({ chunkId: c.chunkId, similarity: c.similarity, document: c.documentName })),
      steps: vectorSearchStep ? [vectorSearchStep] : [],
    },
    {
      id: "filtering",
      label: "Filtering",
      icon: Eye,
      latencyMs: filteringStep?.latencyMs ?? 0,
      config: { threshold: (trace.config as Record<string, unknown>).threshold ?? 0.7 },
      metrics: { afterFiltering: trace.retrievedChunks.length },
      intermediateOutput: filteringStep?.output ?? trace.retrievedChunks.map((c) => ({ chunkId: c.chunkId, similarity: c.similarity })),
      steps: filteringStep ? [filteringStep] : [],
    },
    {
      id: "ranking",
      label: "Ranking",
      icon: GitBranch,
      latencyMs: rankingStep?.latencyMs ?? 0,
      config: { reranker: (trace.config as Record<string, unknown>).reranker ?? "none" },
      metrics: { finalRankings: chunks.length },
      intermediateOutput: rankingStep?.output ?? chunks.map((c) => ({ rank: c.rank, chunkId: c.chunkId, similarity: c.similarity })),
      steps: rankingStep ? [rankingStep] : [],
    },
    {
      id: "prompt-construction",
      label: "Prompt Construction",
      icon: MessageSquare,
      latencyMs: promptStep?.latencyMs ?? 0,
      config: { totalTokens: trace.prompt.totalTokens },
      metrics: { systemTokens: tokenBreakdown.systemTokens, userTokens: tokenBreakdown.userTokens, contextTokens: tokenBreakdown.contextTokens },
      intermediateOutput: promptStep?.output ?? { systemPrompt: trace.prompt.systemPrompt, userMessage: trace.prompt.userMessage, contextChunks: trace.prompt.contextChunks.length },
      steps: promptStep ? [promptStep] : [],
    },
    {
      id: "llm-generation",
      label: "LLM Generation",
      icon: Eye,
      latencyMs: llmStep?.latencyMs ?? 0,
      config: { model: (trace.config as Record<string, unknown>).llmModel ?? "default" },
      metrics: { promptTokens: trace.prompt.totalTokens },
      intermediateOutput: llmStep?.output ?? { promptLength: trace.prompt.systemPrompt.length + trace.prompt.userMessage.length },
      steps: llmStep ? [llmStep] : [],
    },
    {
      id: "citation-mapping",
      label: "Citation Mapping",
      icon: Eye,
      latencyMs: citationStep?.latencyMs ?? 0,
      config: {},
      metrics: { chunksUsed: chunks.length },
      intermediateOutput: citationStep?.output ?? chunks.map((c) => ({ chunkId: c.chunkId, document: c.documentName })),
      steps: citationStep ? [citationStep] : [],
    },
    {
      id: "final-answer",
      label: "Final Answer",
      icon: Eye,
      latencyMs: trace.totalLatencyMs,
      config: {},
      metrics: { totalLatency: trace.totalLatencyMs },
      intermediateOutput: { totalLatencyMs: trace.totalLatencyMs, timestamp: trace.timestamp },
      steps: [],
    },
  ];
}

function AnimatedConnection({ active, delay }: { active: boolean; delay: number }) {
  return (
    <div className="flex justify-center py-0.5">
      <div className="relative w-px h-6">
        <div
          className={`absolute inset-0 rounded-full transition-all duration-500 ${
            active ? "bg-brand" : "bg-border"
          }`}
          style={{ transitionDelay: `${delay}ms` }}
        />
        {active && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div
              className="w-1.5 h-1.5 rounded-full bg-brand"
              style={{
                animation: `flow-dot 1.2s ease-in-out infinite`,
                animationDelay: `${delay}ms`,
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function PipelineStageCard({
  stage,
  index,
  isActive,
  isCompleted,
  isAnimating,
  isExpanded,
  onToggleExpand,
  onClick,
}: {
  stage: PipelineStage;
  index: number;
  isActive: boolean;
  isCompleted: boolean;
  isAnimating: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
}) {
  const Icon = stage.icon;
  const shouldShowDetails = isExpanded || isActive;

  return (
    <div
      className={`rounded-lg border transition-all duration-300 ${
        isActive
          ? "border-brand shadow-glow"
          : isCompleted
          ? "border-brand/30"
          : "border-border"
      } ${isAnimating ? "animate-stage-enter" : ""}`}
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <button
        onClick={onClick}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-hover/50 transition-colors rounded-lg"
      >
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
            isActive
              ? "bg-brand text-white shadow-glow"
              : isCompleted
              ? "bg-brand/20 text-brand"
              : "bg-surface text-text-tertiary"
          }`}
        >
          <Icon size={14} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`text-sm font-medium ${
                isActive ? "text-text-primary" : isCompleted ? "text-text-secondary" : "text-text-tertiary"
              }`}
            >
              {stage.label}
            </span>
            <span className="text-[10px] text-text-tertiary font-mono">
              {stage.latencyMs.toFixed(1)}ms
            </span>
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="p-1 text-text-tertiary hover:text-text-secondary transition-colors"
        >
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </button>

      {shouldShowDetails && (
        <div className="px-3 pb-3 border-t border-border/50 animate-accordion-down">
          <div className="grid grid-cols-2 gap-2 mt-2 mb-2">
            {Object.entries(stage.metrics).map(([key, value]) => (
              <div key={key} className="rounded-md bg-bg/50 px-2 py-1.5">
                <div className="text-[10px] text-text-tertiary">{key}</div>
                <div className="text-xs font-mono text-text-primary">{String(value)}</div>
              </div>
            ))}
          </div>

          {Object.keys(stage.config).length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Config</div>
              <div className="rounded-md bg-bg/50 px-2 py-1.5">
                <pre className="text-[10px] text-text-secondary whitespace-pre-wrap break-all">
                  {JSON.stringify(stage.config, null, 2)}
                </pre>
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] text-text-tertiary uppercase tracking-wider mb-1">Output</div>
            <div className="rounded-md bg-bg/50 px-2 py-1.5 max-h-[120px] overflow-y-auto">
              <pre className="text-[10px] text-text-secondary whitespace-pre-wrap break-all">
                {typeof stage.intermediateOutput === "string"
                  ? stage.intermediateOutput
                  : JSON.stringify(stage.intermediateOutput, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HorizontalTimeline({
  stages,
  activeIndex,
  completedIndices,
}: {
  stages: PipelineStage[];
  activeIndex: number;
  completedIndices: Set<number>;
}) {
  return (
    <div className="flex items-center gap-0 px-2 py-2 overflow-x-auto">
      {stages.map((stage, i) => {
        const isActive = i === activeIndex;
        const isCompleted = completedIndices.has(i);
        return (
          <div key={stage.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  isActive
                    ? "bg-brand scale-150 shadow-glow"
                    : isCompleted
                    ? "bg-brand"
                    : "bg-border"
                }`}
              />
              <span
                className={`text-[8px] mt-1 whitespace-nowrap ${
                  isActive ? "text-brand font-medium" : isCompleted ? "text-text-secondary" : "text-text-tertiary"
                }`}
              >
                {stage.label.split(" ")[0]}
              </span>
            </div>
            {i < stages.length - 1 && (
              <div
                className={`w-6 h-px mx-1 transition-colors duration-300 ${
                  isCompleted ? "bg-brand" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ChunksPanel({
  chunks,
  expandedChunks,
  toggleChunk,
}: {
  chunks: RetrievalChunk[];
  expandedChunks: Set<string>;
  toggleChunk: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {chunks.map((chunk) => {
        const isExpanded = expandedChunks.has(chunk.chunkId);
        const simHighlight = highlightSimilarity(chunk.similarity);
        return (
          <div key={chunk.chunkId} className="rounded-lg border border-border bg-bg/50 overflow-hidden">
            <button
              onClick={() => toggleChunk(chunk.chunkId)}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-surface-hover transition-colors"
            >
              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span className="text-xs font-medium text-text-primary">#{chunk.rank}</span>
              <span className={`text-xs font-mono ${simHighlight.color}`}>
                {chunk.similarity.toFixed(3)}
              </span>
              <span className="text-xs text-text-tertiary truncate flex-1">{chunk.documentName}</span>
            </button>
            {isExpanded && (
              <div className="px-3 pb-3 text-xs text-text-secondary whitespace-pre-wrap border-t border-border pt-2">
                {chunk.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PromptPanel({
  tokenBreakdown,
  prompt,
}: {
  tokenBreakdown: ReturnType<typeof getPromptTokenBreakdown>;
  prompt: RetrievalTrace["prompt"];
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-lg font-semibold text-text-primary">{tokenBreakdown.systemTokens}</div>
          <div className="text-[10px] text-text-tertiary">System Tokens</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-lg font-semibold text-text-primary">{tokenBreakdown.userTokens}</div>
          <div className="text-[10px] text-text-tertiary">User Tokens</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-lg font-semibold text-text-primary">{tokenBreakdown.contextTokens}</div>
          <div className="text-[10px] text-text-tertiary">Context Tokens</div>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
          System Prompt
        </div>
        <pre className="text-xs text-text-secondary bg-bg/50 rounded-lg p-3 whitespace-pre-wrap max-h-[150px] overflow-y-auto">
          {prompt.systemPrompt}
        </pre>
      </div>
      <div>
        <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
          User Message
        </div>
        <pre className="text-xs text-text-secondary bg-bg/50 rounded-lg p-3 whitespace-pre-wrap">
          {prompt.userMessage}
        </pre>
      </div>
    </div>
  );
}

function CitationsPanel({
  citations,
  citationCoverage,
}: {
  citations: ReturnType<typeof findCitationsInAnswer>;
  citationCoverage: ReturnType<typeof getCitationCoverage>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-lg font-semibold text-text-primary">{citationCoverage.citedChunks}</div>
          <div className="text-[10px] text-text-tertiary">Cited Chunks</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-lg font-semibold text-text-primary">{citationCoverage.uncitedChunks}</div>
          <div className="text-[10px] text-text-tertiary">Uncited Chunks</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-lg font-semibold text-text-primary">
            {(citationCoverage.coverageRatio * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-text-tertiary">Coverage</div>
        </div>
      </div>
      {citations.length > 0 ? (
        citations.map((c, i) => (
          <div key={i} className="rounded-lg border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-text-primary">{c.chunk.documentName}</span>
              <span className="text-xs text-text-tertiary">sim: {c.chunk.similarity.toFixed(3)}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                c.matchType === "exact" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
              }`}>
                {c.matchType}
              </span>
            </div>
            <p className="text-xs text-text-secondary">{truncateContent(c.citation.claimText, 200)}</p>
          </div>
        ))
      ) : (
        <p className="text-xs text-text-tertiary text-center py-4">No citation matches found in answer text.</p>
      )}
    </div>
  );
}

function WhyNotPanel({
  whyNotAnalysis,
  whyNotInsights,
}: {
  whyNotAnalysis: NonNullable<ReturnType<typeof analyzeWhyNotRetrieved>>;
  whyNotInsights: string[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-lg font-semibold text-text-primary">{whyNotAnalysis.summary.totalNotRetrieved}</div>
          <div className="text-[10px] text-text-tertiary">Not Retrieved</div>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <div className="text-lg font-semibold text-text-primary">{whyNotAnalysis.summary.maxSimilarity.toFixed(3)}</div>
          <div className="text-[10px] text-text-tertiary">Max Similarity</div>
        </div>
      </div>
      {whyNotInsights.length > 0 && (
        <div className="space-y-1 mb-4">
          {whyNotInsights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-text-secondary">
              <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
              {insight}
            </div>
          ))}
        </div>
      )}
      {whyNotAnalysis.notRetrieved.slice(0, 10).map((chunk) => (
        <div key={chunk.chunkId} className="rounded-lg border border-border bg-bg/50 p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-text-primary">{chunk.documentName}</span>
            <span className="text-xs text-text-tertiary font-mono">{chunk.actualSimilarity.toFixed(3)}</span>
          </div>
          <p className="text-xs text-text-tertiary">{chunk.reason}</p>
          <p className="text-xs text-text-secondary mt-1">{truncateContent(chunk.content, 150)}</p>
        </div>
      ))}
    </div>
  );
}

export function RetrievalDebugger({ trace, allChunks, answerText }: RetrievalDebuggerProps) {
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const chunks = trace.rerankedChunks.length > 0 ? trace.rerankedChunks : trace.retrievedChunks;
  const tokenBreakdown = getPromptTokenBreakdown(trace.prompt);
  const citations = answerText ? findCitationsInAnswer(answerText, chunks) : [];
  const citationCoverage = getCitationCoverage(citations, chunks.length);

  const retrievedIds = new Set(chunks.map((c) => c.chunkId));
  const whyNotAnalysis = allChunks && allChunks.length > 0
    ? analyzeWhyNotRetrieved(
        trace.embedding,
        allChunks,
        retrievedIds,
        (trace.config.threshold as number) ?? 0.7,
      )
    : null;
  const whyNotInsights = whyNotAnalysis ? getWhyNotRetrievedInsights(whyNotAnalysis) : [];

  const pipelineStages = mapTraceToPipeline(trace, chunks, tokenBreakdown);

  const [activeStageIndex, setActiveStageIndex] = useState(0);
  const [expandedStages, setExpandedStages] = useState<Set<number>>(new Set([0]));
  const [completedStages, setCompletedStages] = useState<Set<number>>(new Set());
  const [isAnimating, setIsAnimating] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(false);
  const [sidePanelContent, setSidePanelContent] = useState<"chunks" | "prompt" | "citations" | "why-not" | null>(null);
  const animationTimerRef = useRef<NodeJS.Timeout | null>(null);

  const toggleStageExpand = useCallback((index: number) => {
    setExpandedStages((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const openSidePanel = useCallback((content: "chunks" | "prompt" | "citations" | "why-not") => {
    setSidePanelContent(content);
    setShowSidePanel(true);
  }, []);

  const closeSidePanel = useCallback(() => {
    setShowSidePanel(false);
    setSidePanelContent(null);
  }, []);

  const goToStage = useCallback((index: number) => {
    if (index < 0 || index >= pipelineStages.length) return;
    setActiveStageIndex(index);
    setCompletedStages((prev) => {
      const next = new Set(prev);
      if (index > 0) {
        for (let i = 0; i < index; i++) next.add(i);
      }
      return next;
    });
    setExpandedStages((prev) => {
      const next = new Set(prev);
      next.add(index);
      return next;
    });
  }, [pipelineStages.length]);

  const replayAnimation = useCallback(() => {
    if (animationTimerRef.current) {
      clearInterval(animationTimerRef.current);
    }
    setIsAnimating(true);
    setCompletedStages(new Set());
    setExpandedStages(new Set());
    setActiveStageIndex(0);

    let currentIndex = 0;
    animationTimerRef.current = setInterval(() => {
      if (currentIndex >= pipelineStages.length - 1) {
        if (animationTimerRef.current) clearInterval(animationTimerRef.current);
        setCompletedStages(new Set(pipelineStages.map((_, i) => i)));
        setIsAnimating(false);
        return;
      }
      setCompletedStages((prev) => new Set([...prev, currentIndex]));
      currentIndex++;
      setActiveStageIndex(currentIndex);
      setExpandedStages(new Set([currentIndex]));
    }, 600);
  }, [pipelineStages.length]);

  useEffect(() => {
    return () => {
      if (animationTimerRef.current) clearInterval(animationTimerRef.current);
    };
  }, []);

  const copyTrace = () => {
    navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportTrace = () => {
    const dataStr = JSON.stringify(trace, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `retrieval-trace-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTabForStage = (stageId: string): Tab | null => {
    if (stageId === "ranking") return "chunks";
    if (stageId === "prompt-construction") return "prompt";
    if (stageId === "citation-mapping") return "citations";
    return null;
  };

  const handleStageClick = (index: number) => {
    goToStage(index);
    const tab = getTabForStage(pipelineStages[index].id);
    if (tab) {
      openSidePanel(tab);
    }
  };

  const sidePanelTitle = sidePanelContent === "chunks"
    ? "Chunks"
    : sidePanelContent === "prompt"
    ? "Prompt"
    : sidePanelContent === "citations"
    ? "Citations"
    : sidePanelContent === "why-not"
    ? "Why Not Retrieved"
    : "";

  return (
    <>
    <style>{`
      @keyframes flow-dot {
        0%, 100% { transform: translate(-50%, -50%) translateY(-8px); opacity: 0; }
        20% { opacity: 1; }
        80% { opacity: 1; }
        50% { transform: translate(-50%, -50%) translateY(8px); }
      }
      @keyframes stage-enter {
        from { opacity: 0; transform: translateY(8px) scale(0.98); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      .animate-stage-enter {
        animation: stage-enter 400ms ease-out forwards;
      }
      @keyframes shimmer-line {
        0% { background-position: -200% 0; }
        100% { background-position: 200% 0; }
      }
    `}</style>
    <div className="flex rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Eye size={16} className="text-brand" />
            <span className="text-sm font-semibold text-text-primary">Retrieval Debugger</span>
            <span className="text-xs text-text-tertiary">
              {trace.strategy} · {trace.totalLatencyMs.toFixed(0)}ms
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={replayAnimation}
              disabled={isAnimating}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-brand rounded transition-colors disabled:opacity-40"
              title="Replay pipeline animation"
            >
              <Play size={12} />
              Replay
            </button>
            <button
              onClick={exportTrace}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-text-primary rounded transition-colors"
              title="Export trace as JSON"
            >
              <Download size={12} />
              Export
            </button>
            <button
              onClick={copyTrace}
              className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-text-primary rounded transition-colors"
            >
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>

        <div className="border-b border-border px-2">
          <HorizontalTimeline
            stages={pipelineStages}
            activeIndex={activeStageIndex}
            completedIndices={completedStages}
          />
        </div>

        <div className="p-3 max-h-[500px] overflow-y-auto">
          <div className="space-y-0">
            {pipelineStages.map((stage, i) => (
              <div key={stage.id}>
                <PipelineStageCard
                  stage={stage}
                  index={i}
                  isActive={i === activeStageIndex}
                  isCompleted={completedStages.has(i)}
                  isAnimating={isAnimating}
                  isExpanded={expandedStages.has(i)}
                  onToggleExpand={() => toggleStageExpand(i)}
                  onClick={() => handleStageClick(i)}
                />
                {i < pipelineStages.length - 1 && (
                  <AnimatedConnection
                    active={completedStages.has(i)}
                    delay={i * 80}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-tertiary">Total Latency</span>
              <span className="font-mono font-medium text-text-primary">{trace.totalLatencyMs.toFixed(0)}ms</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-text-tertiary">Embedding Latency</span>
              <span className="font-mono font-medium text-text-primary">{trace.embeddingLatencyMs.toFixed(0)}ms</span>
            </div>
          </div>
        </div>

        <div className="border-t border-border flex items-center gap-0 overflow-x-auto">
          {[
            { id: "chunks" as Tab, label: `Chunks (${chunks.length})`, icon: Search },
            { id: "prompt" as Tab, label: "Prompt", icon: MessageSquare },
            { id: "citations" as Tab, label: `Citations (${citationCoverage.citedChunks})`, icon: Eye },
            ...(whyNotAnalysis ? [{ id: "why-not" as Tab, label: `Why Not (${whyNotAnalysis.summary.totalNotRetrieved})`, icon: AlertTriangle }] : []),
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => openSidePanel(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  showSidePanel && sidePanelContent === tab.id
                    ? "text-brand border-b-2 border-brand bg-brand/5"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                <Icon size={13} />
                {tab.label}
              </button>
            );
          })}

          <div className="ml-auto flex items-center gap-1 px-3">
            <button
              onClick={() => goToStage(activeStageIndex - 1)}
              disabled={activeStageIndex === 0}
              className="p-1.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors"
              title="Previous stage"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] text-text-tertiary font-mono min-w-[36px] text-center">
              {activeStageIndex + 1}/{pipelineStages.length}
            </span>
            <button
              onClick={() => goToStage(activeStageIndex + 1)}
              disabled={activeStageIndex === pipelineStages.length - 1}
              className="p-1.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 transition-colors"
              title="Next stage"
            >
              <SkipForward size={14} />
            </button>
          </div>
        </div>
      </div>

      {showSidePanel && (
        <div className="w-[360px] border-l border-border flex flex-col bg-surface animate-slide-in-right">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-text-primary">{sidePanelTitle}</span>
            <button
              onClick={closeSidePanel}
              className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {sidePanelContent === "chunks" && (
              <ChunksPanel chunks={chunks} expandedChunks={expandedChunks} toggleChunk={(id) => {
                setExpandedChunks((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                });
              }} />
            )}
            {sidePanelContent === "prompt" && (
              <PromptPanel tokenBreakdown={tokenBreakdown} prompt={trace.prompt} />
            )}
            {sidePanelContent === "citations" && (
              <CitationsPanel citations={citations} citationCoverage={citationCoverage} />
            )}
            {sidePanelContent === "why-not" && whyNotAnalysis && (
              <WhyNotPanel whyNotAnalysis={whyNotAnalysis} whyNotInsights={whyNotInsights} />
            )}
          </div>
        </div>
      )}
    </div>
    </>
  );
}
