"use client";

import { useState, useRef, useEffect, memo } from "react";
import {
  MessageSquare,
  Send,
  Sparkles,
  BarChart3,
  GitBranch,
  Lightbulb,
  BookOpen,
  Target,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Zap,
  RefreshCw,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumCard, CardHeader, CardTitle, CardDescription } from "@/components/ui/premium-card";
import { PageHeader } from "@/components/app/page-header";

interface CopilotRun {
  id: string;
  name: string;
  configSnapshot: Record<string, unknown>;
  aggregatedMetrics: Record<string, number> | null;
  createdAt: string;
  dataset: { name: string; questionCount: number };
  resultsCount: number;
}

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  intent?: string;
  confidence?: number;
  evidence?: Array<{
    source: string;
    type: string;
    relevance: number;
    summary: string;
  }>;
  suggestions?: string[];
  grounding?: {
    grounded: boolean;
    citations: number;
    unsupported: string[];
  };
  timestamp: Date;
}

interface CopilotPageProps {
  runs: CopilotRun[];
}

const CopilotPageInner = function CopilotPage({ runs }: CopilotPageProps) {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<string | null>(null);
  const [showEvidence, setShowEvidence] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: CopilotMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMessage.content,
          benchmarkRuns: runs,
        }),
      });

      if (!response.ok) throw new Error("Failed to get response");

      const data = await response.json();

      const assistantMessage: CopilotMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer || "I couldn't generate a response.",
        intent: data.intent,
        confidence: data.confidence?.overall,
        evidence: data.evidence?.slice(0, 5),
        suggestions: data.suggestedFollowUp,
        grounding: data.grounding,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      const errorMessage: CopilotMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "I encountered an error processing your request. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion);
  };

  const handleCopyMessage = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getIntentIcon = (intent?: string) => {
    switch (intent) {
      case "explain": return <BookOpen className="h-4 w-4" />;
      case "debug": return <AlertTriangle className="h-4 w-4" />;
      case "compare": return <BarChart3 className="h-4 w-4" />;
      case "recommend": return <Lightbulb className="h-4 w-4" />;
      case "plan": return <Target className="h-4 w-4" />;
      case "optimize": return <Zap className="h-4 w-4" />;
      case "interpret": return <GitBranch className="h-4 w-4" />;
      default: return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getConfidenceColor = (confidence?: number) => {
    if (!confidence) return "text-text-tertiary";
    if (confidence >= 0.8) return "text-green-500";
    if (confidence >= 0.5) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-fade-in">
      <PageHeader
        title="AI Research Copilot"
        description="Evidence-backed research assistance"
        purpose="Get AI-powered recommendations for your RAG experiments."
        relatedPages={[
          { label: "Research Dashboard", href: "/app/research" },
          { label: "Experiment Planner", href: "/app/planner" },
        ]}
      />
      <div className="flex flex-1 gap-4 min-h-0">
      <div className="flex flex-1 flex-col rounded-xl border border-border bg-surface overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-gradient-to-r from-brand/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-[var(--radius-lg)] bg-brand/10">
              <Sparkles className="h-5 w-5 text-brand" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-text-primary">AI Research Copilot</h1>
              <p className="text-[11px] text-text-tertiary">Evidence-backed research assistance</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEvidence(!showEvidence)}
              className={cn(
                "rounded-md px-2 py-1 text-xs font-medium transition-colors",
                showEvidence
                  ? "bg-brand/10 text-brand"
                  : "text-text-tertiary hover:text-text-secondary"
              )}
            >
              Evidence Panel
            </button>
            <button
              onClick={() => setMessages([])}
              className="rounded-md px-2 py-1 text-xs text-text-tertiary hover:text-text-secondary"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="p-4 rounded-full bg-brand/10 mb-4">
                <Sparkles className="h-12 w-12 text-brand" />
              </div>
              <h2 className="text-lg font-semibold text-text-primary mb-2">
                Research Copilot
              </h2>
              <p className="text-sm text-text-secondary max-w-md mb-6">
                Ask questions about your RAG experiments. I have access to your benchmarks,
                statistical analyses, research findings, and can help with explainability.
              </p>
              <div className="grid grid-cols-2 gap-2 max-w-lg">
                {[
                  "Explain my benchmark results",
                  "Compare my configurations",
                  "What should I experiment with next?",
                  "Debug low recall scores",
                  "Summarize my research progress",
                  "How reproducible are my results?",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="rounded-lg border border-border bg-surface-secondary p-3 text-left text-xs text-text-secondary hover:border-blue-500/50 hover:text-text-primary transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              onClick={() => message.role === "assistant" && setSelectedMessage(message.id)}
              className={cn(
                "group flex gap-3 cursor-pointer",
                message.role === "user" ? "justify-end" : "justify-start",
                selectedMessage === message.id && "ring-2 ring-blue-500/50 rounded-lg"
              )}
            >
              {message.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-500">
                  {getIntentIcon(message.intent)}
                </div>
              )}
              <div
                className={cn(
                  "max-w-[70%] rounded-lg px-4 py-3",
                  message.role === "user"
                    ? "bg-blue-500 text-white"
                    : "bg-surface-secondary border border-border"
                )}
              >
                <div className="text-sm whitespace-pre-wrap">{message.content}</div>

                {message.role === "assistant" && (
                  <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
                    {message.intent && (
                      <span className="flex items-center gap-1 capitalize">
                        {getIntentIcon(message.intent)}
                        {message.intent}
                      </span>
                    )}
                    {message.confidence !== undefined && (
                      <span className={getConfidenceColor(message.confidence)}>
                        {Math.round(message.confidence * 100)}% confidence
                      </span>
                    )}
                    {message.grounding && (
                      <span className={message.grounding.grounded ? "text-green-500" : "text-yellow-500"}>
                        {message.grounding.grounded ? (
                          <><CheckCircle2 className="inline h-3 w-3" /> Grounded</>
                        ) : (
                          <><AlertTriangle className="inline h-3 w-3" /> Partially grounded</>
                        )}
                      </span>
                    )}
                    <button
                      onClick={() => handleCopyMessage(message.content, message.id)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      {copiedId === message.id ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                )}

                {message.role === "assistant" && message.suggestions && message.suggestions.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {message.suggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
                <RefreshCw className="h-4 w-4 animate-spin" />
              </div>
              <div className="rounded-lg bg-bg-secondary border border-border px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-text-secondary">
                  <span className="animate-pulse">Analyzing your research data</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-border p-4 bg-gradient-to-r from-surface to-surface-secondary">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your RAG experiments..."
              className="flex-1 rounded-lg border border-border bg-bg-primary px-4 py-2 text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand/50"
              disabled={isLoading}
              aria-label="Type a message"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {showEvidence && (
        <PremiumCard variant="elevated" className="w-80 shrink-0 overflow-hidden">
          <CardHeader icon={<BarChart3 size={16} />}>
            <CardTitle>Context & Evidence</CardTitle>
            <CardDescription>Research data sources</CardDescription>
          </CardHeader>
          <div className="overflow-y-auto h-[calc(100%-3rem)] p-4 space-y-4">
            <div>
              <h3 className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1">
                <BarChart3 className="h-3 w-3" />
                Experiment Summary
              </h3>
              <div className="rounded-lg bg-surface-secondary border border-border p-3 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-text-tertiary">Total Runs</span>
                  <span className="text-text-primary font-medium">{runs.length}</span>
                </div>
                {runs.length > 0 && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-tertiary">Latest</span>
                      <span className="text-text-primary font-medium truncate ml-2">
                        {runs[0].name}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-text-tertiary">Dataset</span>
                      <span className="text-text-primary font-medium">
                        {runs[0].dataset.name}
                      </span>
                    </div>
                    {runs[0].aggregatedMetrics && (
                      <div className="flex justify-between text-xs">
                        <span className="text-text-tertiary">Avg Recall</span>
                        <span className="text-text-primary font-medium">
                          {((runs[0].aggregatedMetrics.avgRecallAtK ?? 0) * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Recent Activity
              </h3>
              <div className="space-y-2">
                {runs.slice(0, 5).map((run) => (
                  <div
                    key={run.id}
                    className="rounded-lg bg-surface-secondary border border-border p-2"
                  >
                    <div className="text-xs font-medium text-text-primary truncate">
                      {run.name}
                    </div>
                    <div className="text-xs text-text-tertiary mt-0.5">
                      {new Date(run.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {selectedMessage && messages.find((m) => m.id === selectedMessage)?.evidence && (
              <div>
                <h3 className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Evidence Used
                </h3>
                <div className="space-y-2">
                  {messages
                    .find((m) => m.id === selectedMessage)
                    ?.evidence?.map((e, i) => (
                      <div
                        key={i}
                        className="rounded-lg bg-surface-secondary border border-border p-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text-primary capitalize">
                            {e.type}
                          </span>
                          <span className="text-xs text-text-tertiary">
                            {Math.round(e.relevance * 100)}% relevant
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary mt-1">{e.summary}</div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {messages.length === 0 && (
              <div>
                <h3 className="text-xs font-medium text-text-secondary mb-2 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3" />
                  Quick Actions
                </h3>
                <div className="space-y-1">
                  {[
                    "Run statistical comparison on last 2 benchmarks",
                    "Show Pareto frontier for accuracy vs latency",
                    "Generate reproducibility report",
                    "What experiments should I run next?",
                  ].map((action) => (
                    <button
                      key={action}
                      onClick={() => handleSuggestionClick(action)}
                      className="w-full rounded-lg bg-bg-secondary border border-border p-2 text-left text-xs text-text-secondary hover:text-text-primary hover:border-brand/50 transition-colors"
                    >
                      {action}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </PremiumCard>
      )}
      </div>
    </div>
  );
};

export const CopilotPage = memo(CopilotPageInner);
