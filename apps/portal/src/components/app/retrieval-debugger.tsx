"use client";

import { useState } from "react";
import {
  Eye, Search, MessageSquare, GitBranch, AlertTriangle,
  ChevronDown, ChevronRight, Copy, Check,
} from "lucide-react";
import type { RetrievalTrace } from "@/lib/retrieval/debugger";
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

type Tab = "timeline" | "chunks" | "prompt" | "citations" | "why-not";

export function RetrievalDebugger({ trace, allChunks, answerText }: RetrievalDebuggerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
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

  const toggleChunk = (id: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyTrace = () => {
    navigator.clipboard.writeText(JSON.stringify(trace, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const tabs: Array<{ id: Tab; label: string; icon: typeof Eye }> = [
    { id: "timeline", label: "Timeline", icon: GitBranch },
    { id: "chunks", label: `Chunks (${chunks.length})`, icon: Search },
    { id: "prompt", label: "Prompt", icon: MessageSquare },
    { id: "citations", label: `Citations (${citationCoverage.citedChunks})`, icon: Eye },
    ...(whyNotAnalysis ? [{ id: "why-not" as Tab, label: `Why Not (${whyNotAnalysis.summary.totalNotRetrieved})`, icon: AlertTriangle }] : []),
  ];

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Eye size={16} className="text-brand" />
          <span className="text-sm font-semibold text-text-primary">Retrieval Debugger</span>
          <span className="text-xs text-text-tertiary">
            {trace.strategy} · {trace.totalLatencyMs.toFixed(0)}ms
          </span>
        </div>
        <button
          onClick={copyTrace}
          className="flex items-center gap-1 px-2 py-1 text-xs text-text-tertiary hover:text-text-primary rounded transition-colors"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy trace"}
        </button>
      </div>

      <div className="flex border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "text-brand border-b-2 border-brand bg-brand/5"
                  : "text-text-tertiary hover:text-text-secondary"
              }`}
            >
              <Icon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="p-4 max-h-[500px] overflow-y-auto">
        {activeTab === "timeline" && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">
              Pipeline Steps
            </div>
            {trace.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <div className="flex flex-col items-center">
                  <div className="w-2 h-2 rounded-full bg-brand shrink-0 mt-1.5" />
                  {i < trace.steps.length - 1 && (
                    <div className="w-px h-full bg-border min-h-[20px]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">{step.step}</span>
                    <span className="text-xs text-text-tertiary">{step.latencyMs.toFixed(1)}ms</span>
                  </div>
                  <p className="text-xs text-text-tertiary mt-0.5">{step.description}</p>
                </div>
              </div>
            ))}
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
        )}

        {activeTab === "chunks" && (
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
        )}

        {activeTab === "prompt" && (
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
                {trace.prompt.systemPrompt}
              </pre>
            </div>
            <div>
              <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">
                User Message
              </div>
              <pre className="text-xs text-text-secondary bg-bg/50 rounded-lg p-3 whitespace-pre-wrap">
                {trace.prompt.userMessage}
              </pre>
            </div>
          </div>
        )}

        {activeTab === "citations" && (
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
        )}

        {activeTab === "why-not" && whyNotAnalysis && (
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
        )}
      </div>
    </div>
  );
}
