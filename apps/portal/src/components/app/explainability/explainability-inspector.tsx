"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Search,
  BarChart3,
  FileText,
  Layers,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { QueryAnalyzer } from "./query-analyzer";
import { RetrievalInspector } from "./retrieval-inspector";
import { ChunkRankingViewer } from "./chunk-ranking-viewer";
import { PromptInspector } from "./prompt-inspector";
import { ContextWindowVisualization } from "./context-window-visualization";
import { TokenUsagePanel } from "./token-usage-panel";
import { RetrievalReplayTimeline } from "./retrieval-replay-timeline";
import { CitationInspector } from "./citation-inspector";
import { AnswerConfidencePanel } from "./answer-confidence-panel";
import { SuggestedFollowUpQuestions } from "./suggested-follow-ups";
import type {
  ExplainerChunk,
  ExplainerPipelineStep,
  ExplainerPrompt,
  ExplainerConfig,
  ExplainerCitation,
} from "./types";

interface PipelineData {
  strategy: string;
  steps: { name: string; description: string; durationMs: number; output?: Record<string, unknown> }[];
  retrieval: {
    query: string;
    chunks: {
      id: string;
      content: string;
      index: number;
      tokenCount: number | null;
      documentId: string;
      documentName: string;
      similarity: number;
      pageNumber: number | null;
      chunkSize: number;
    }[];
    totalChunks: number;
    latencyMs: number;
  };
  prompt: {
    systemPrompt: string;
    messages: { role: string; content: string }[];
    estimatedTokens: number;
  };
  config: {
    chunkStrategy: string;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    similarityThreshold: number;
    embeddingModel: string;
    retrievalMode: string;
    retrievalStrategy?: string;
    queryExpansion?: boolean;
    multiQuery?: boolean;
    reranking?: boolean;
    compression?: boolean;
  };
}

interface Citation {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  pageNumber: number | null;
  excerpt: string;
  similarity: number;
}

interface ExplainabilityInspectorProps {
  pipeline: PipelineData;
  citations?: Citation[];
  answerText?: string;
  onFollowUpSelect?: (question: string) => void;
  className?: string;
}

type PanelId =
  | "query"
  | "retrieval"
  | "ranking"
  | "prompt"
  | "context"
  | "tokens"
  | "timeline"
  | "citations"
  | "confidence"
  | "followups";

const PANELS: { id: PanelId; label: string; icon: typeof Search }[] = [
  { id: "query", label: "Query Analysis", icon: Search },
  { id: "retrieval", label: "Retrieval", icon: Layers },
  { id: "ranking", label: "Ranking", icon: BarChart3 },
  { id: "prompt", label: "Prompt", icon: FileText },
  { id: "context", label: "Context Window", icon: Layers },
  { id: "tokens", label: "Token Usage", icon: BarChart3 },
  { id: "timeline", label: "Pipeline Replay", icon: Clock },
  { id: "citations", label: "Citations", icon: FileText },
  { id: "confidence", label: "Confidence", icon: Sparkles },
  { id: "followups", label: "Follow-ups", icon: Sparkles },
];

function mapChunks(chunks: PipelineData["retrieval"]["chunks"]): ExplainerChunk[] {
  return chunks.map((c, i) => ({
    chunkId: c.id,
    content: c.content,
    documentName: c.documentName,
    documentId: c.documentId,
    similarity: c.similarity,
    rank: i + 1,
    tokenCount: c.tokenCount ?? undefined,
    pageNumber: c.pageNumber,
  }));
}

function mapSteps(steps: PipelineData["steps"]): ExplainerPipelineStep[] {
  return steps.map((s) => ({
    name: s.name,
    description: s.description,
    durationMs: s.durationMs,
    output: s.output,
    status: "completed" as const,
  }));
}

function mapPrompt(prompt: PipelineData["prompt"]): ExplainerPrompt {
  return {
    systemPrompt: prompt.systemPrompt,
    messages: prompt.messages,
    estimatedTokens: prompt.estimatedTokens,
  };
}

function mapConfig(config: PipelineData["config"]): ExplainerConfig {
  return {
    chunkStrategy: config.chunkStrategy,
    chunkSize: config.chunkSize,
    chunkOverlap: config.chunkOverlap,
    topK: config.topK,
    similarityThreshold: config.similarityThreshold,
    embeddingModel: config.embeddingModel,
    retrievalMode: config.retrievalMode,
    retrievalStrategy: config.retrievalStrategy,
    queryExpansion: config.queryExpansion,
    multiQuery: config.multiQuery,
    reranking: config.reranking,
    compression: config.compression,
  };
}

function mapCitations(citations: Citation[]): ExplainerCitation[] {
  return citations.map((c) => ({
    chunkId: c.chunkId,
    documentId: c.documentId,
    documentName: c.documentName,
    chunkIndex: c.chunkIndex,
    pageNumber: c.pageNumber,
    excerpt: c.excerpt,
    similarity: c.similarity,
  }));
}

export function ExplainabilityInspector({
  pipeline,
  citations = [],
  answerText,
  onFollowUpSelect,
  className,
}: ExplainabilityInspectorProps) {
  const [expandedPanels, setExpandedPanels] = useState<Set<PanelId>>(
    new Set(["query", "retrieval", "confidence"])
  );

  const togglePanel = useCallback((id: PanelId) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    setExpandedPanels(new Set(PANELS.map((p) => p.id)));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedPanels(new Set());
  }, []);

  const chunks = mapChunks(pipeline.retrieval.chunks);
  const steps = mapSteps(pipeline.steps);
  const prompt = mapPrompt(pipeline.prompt);
  const config = mapConfig(pipeline.config);
  const explainerCitations = mapCitations(citations);

  const embeddingLatency = steps.find((s) => s.name.toLowerCase().includes("embed"))?.durationMs ?? 0;
  const searchLatency = steps.find((s) => s.name.toLowerCase().includes("search") || s.name.toLowerCase().includes("vector"))?.durationMs ?? 0;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-center justify-between px-1 mb-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          Explainability Inspector
        </h4>
        <div className="flex gap-1">
          <button onClick={expandAll} className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-bg">
            Expand all
          </button>
          <span className="text-text-tertiary">|</span>
          <button onClick={collapseAll} className="text-[10px] text-text-tertiary hover:text-text-primary transition-colors px-1.5 py-0.5 rounded hover:bg-bg">
            Collapse all
          </button>
        </div>
      </div>

      {PANELS.map(({ id, label, icon: Icon }) => {
        const isExpanded = expandedPanels.has(id);

        return (
          <div key={id} className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => togglePanel(id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-xs text-text-secondary hover:bg-surface-hover transition-colors"
              aria-expanded={isExpanded}
            >
              <Icon size={12} className="text-text-tertiary shrink-0" />
              <span className="font-medium text-text-primary">{label}</span>
              <span className="ml-auto text-text-tertiary">
                {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </span>
            </button>

            {isExpanded && (
              <div className="px-3 pb-3 border-t border-border/30">
                {id === "query" && (
                  <div className="pt-3">
                    <QueryAnalyzer
                      query={pipeline.retrieval.query}
                      embeddingDimensions={1536}
                      embeddingLatencyMs={embeddingLatency}
                      strategy={pipeline.strategy}
                    />
                  </div>
                )}
                {id === "retrieval" && (
                  <div className="pt-3">
                    <RetrievalInspector
                      chunks={chunks}
                      config={config}
                    />
                  </div>
                )}
                {id === "ranking" && (
                  <div className="pt-3">
                    <ChunkRankingViewer
                      originalChunks={chunks}
                      rerankedChunks={pipeline.config.reranking ? chunks : []}
                    />
                  </div>
                )}
                {id === "prompt" && (
                  <div className="pt-3">
                    <PromptInspector prompt={prompt} />
                  </div>
                )}
                {id === "context" && (
                  <div className="pt-3">
                    <ContextWindowVisualization
                      chunks={chunks}
                      prompt={prompt}
                    />
                  </div>
                )}
                {id === "tokens" && (
                  <div className="pt-3">
                    <TokenUsagePanel
                      embeddingLatencyMs={embeddingLatency}
                      searchLatencyMs={searchLatency}
                      totalLatencyMs={pipeline.retrieval.latencyMs}
                      promptTokens={pipeline.prompt.estimatedTokens}
                    />
                  </div>
                )}
                {id === "timeline" && (
                  <div className="pt-3">
                    <RetrievalReplayTimeline
                      steps={steps}
                      totalLatencyMs={pipeline.retrieval.latencyMs}
                    />
                  </div>
                )}
                {id === "citations" && (
                  <div className="pt-3">
                    <CitationInspector citations={explainerCitations} />
                  </div>
                )}
                {id === "confidence" && (
                  <div className="pt-3">
                    <AnswerConfidencePanel
                      chunks={chunks}
                      citations={explainerCitations}
                      answerText={answerText}
                    />
                  </div>
                )}
                {id === "followups" && (
                  <div className="pt-3">
                    <SuggestedFollowUpQuestions
                      query={pipeline.retrieval.query}
                      chunks={chunks.map((c) => ({
                        content: c.content,
                        documentName: c.documentName,
                      }))}
                      answerText={answerText}
                      onSelect={onFollowUpSelect}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
