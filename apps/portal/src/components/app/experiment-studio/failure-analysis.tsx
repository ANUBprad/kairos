"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  Search,
  Brain,
  FileSearch,
  Cpu,
  MessageSquare,
  Layers,
  BookOpen,
  Lightbulb,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FailureExample, QuestionResult } from "./types";

interface FailureAnalysisProps {
  results: QuestionResult[];
  className?: string;
}

interface CategorizedFailures {
  wrongRetrieval: FailureExample[];
  lowRecall: FailureExample[];
  hallucination: FailureExample[];
  promptFailure: FailureExample[];
  contextOverflow: FailureExample[];
  embeddingFailure: FailureExample[];
  rerankerFailure: FailureExample[];
  missingCitation: FailureExample[];
}

const FAILURE_CATEGORIES: { key: keyof CategorizedFailures; name: string; description: string; icon: typeof AlertTriangle; recommendations: string[] }[] = [
  {
    key: "wrongRetrieval",
    name: "Wrong Retrieval",
    description: "The system retrieved documents that are not relevant to the question",
    icon: FileSearch,
    recommendations: ["Try a different embedding model", "Adjust similarity threshold", "Enable query expansion"],
  },
  {
    key: "lowRecall",
    name: "Low Recall",
    description: "The system missed relevant documents that should have been retrieved",
    icon: Search,
    recommendations: ["Increase top-K", "Enable multi-query retrieval", "Try hybrid retrieval"],
  },
  {
    key: "hallucination",
    name: "Hallucination",
    description: "The system generated claims not supported by retrieved context",
    icon: Brain,
    recommendations: ["Strengthen the system prompt", "Add grounding instructions", "Reduce temperature"],
  },
  {
    key: "promptFailure",
    name: "Prompt Failure",
    description: "The prompt template did not effectively guide the LLM",
    icon: MessageSquare,
    recommendations: ["Rewrite the prompt template", "Add few-shot examples", "Use a more capable model"],
  },
  {
    key: "contextOverflow",
    name: "Context Overflow",
    description: "The retrieved context exceeded the context window",
    icon: Layers,
    recommendations: ["Reduce chunk size", "Enable context compression", "Reduce top-K"],
  },
  {
    key: "embeddingFailure",
    name: "Embedding Failure",
    description: "The embedding model failed to capture semantic similarity",
    icon: Cpu,
    recommendations: ["Try a different embedding model", "Fine-tune embeddings", "Enable hybrid retrieval"],
  },
  {
    key: "rerankerFailure",
    name: "Reranker Failure",
    description: "The reranker degraded rather than improved ranking quality",
    icon: BookOpen,
    recommendations: ["Disable reranking", "Try a different reranker", "Adjust reranker threshold"],
  },
  {
    key: "missingCitation",
    name: "Missing Citation",
    description: "The answer references information without proper citation",
    icon: AlertTriangle,
    recommendations: ["Add citation requirements to prompt", "Enable citation validation", "Check chunk metadata"],
  },
];

function categorizeFailures(results: QuestionResult[]): CategorizedFailures {
  const failures: CategorizedFailures = {
    wrongRetrieval: [],
    lowRecall: [],
    hallucination: [],
    promptFailure: [],
    contextOverflow: [],
    embeddingFailure: [],
    rerankerFailure: [],
    missingCitation: [],
  };

  results.forEach((r) => {
    const hasRetrieved = r.retrievedChunks.length > 0;
    const hasRelevant = r.relevantChunks.length > 0;
    const relevantInRetrieved = r.retrievedChunks.filter((c) => r.relevantChunks.includes(c));

    if (!hasRelevant && hasRetrieved) {
      failures.wrongRetrieval.push({
        questionId: r.questionId,
        question: r.question,
        expectedAnswer: r.expectedAnswer,
        actualAnswer: r.generatedAnswer,
        severity: "high",
        metrics: r.metrics,
      });
    }

    if (hasRelevant && relevantInRetrieved.length / r.relevantChunks.length < 0.5) {
      failures.lowRecall.push({
        questionId: r.questionId,
        question: r.question,
        expectedAnswer: r.expectedAnswer,
        actualAnswer: r.generatedAnswer,
        severity: "medium",
        metrics: r.metrics,
      });
    }

    if (r.metrics.faithfulness < 0.5) {
      failures.hallucination.push({
        questionId: r.questionId,
        question: r.question,
        expectedAnswer: r.expectedAnswer,
        actualAnswer: r.generatedAnswer,
        severity: "high",
        metrics: r.metrics,
      });
    }

    if (r.metrics.answerRelevancy < 0.4) {
      failures.promptFailure.push({
        questionId: r.questionId,
        question: r.question,
        expectedAnswer: r.expectedAnswer,
        actualAnswer: r.generatedAnswer,
        severity: "medium",
        metrics: r.metrics,
      });
    }

    if (r.tokenUsage.totalTokens > 3000) {
      failures.contextOverflow.push({
        questionId: r.questionId,
        question: r.question,
        expectedAnswer: r.expectedAnswer,
        actualAnswer: r.generatedAnswer,
        severity: "low",
        metrics: r.metrics,
      });
    }
  });

  return failures;
}

export function FailureAnalysis({ results, className }: FailureAnalysisProps) {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [selectedSeverity, setSelectedSeverity] = useState<"all" | "high" | "medium" | "low">("all");

  const categorized = useMemo(() => categorizeFailures(results), [results]);

  const totalFailures = useMemo(() =>
    Object.values(categorized).reduce((sum, arr) => sum + arr.length, 0)
  , [categorized]);

  const toggleCategory = useCallback((key: string) => {
    setExpandedCategory((prev) => prev === key ? null : key);
  }, []);

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-text-primary">Failure Analysis</h3>
          <p className="text-xs text-text-secondary">{totalFailures} failures across {results.length} questions</p>
        </div>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Filter by severity">
          {(["all", "high", "medium", "low"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSelectedSeverity(s)}
              className={cn("px-2 py-1 rounded text-[10px] font-medium transition-colors", selectedSeverity === s ? "bg-brand/10 text-brand" : "text-text-tertiary hover:text-text-secondary")}
              role="radio"
              aria-checked={selectedSeverity === s}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {FAILURE_CATEGORIES.map((cat) => {
          const failures = categorized[cat.key];
          const Icon = cat.icon;
          const filteredFailures = selectedSeverity === "all" ? failures : failures.filter((f) => f.severity === selectedSeverity);
          return (
            <button
              key={cat.key}
              onClick={() => toggleCategory(cat.key)}
              className={cn(
                "p-3 rounded-lg border text-left transition-all",
                expandedCategory === cat.key ? "border-brand bg-brand/5" : "border-border hover:border-brand/30"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon size={14} className={filteredFailures.length > 0 ? "text-error" : "text-text-tertiary"} />
                <span className="text-xs font-medium text-text-primary">{cat.name}</span>
              </div>
              <p className={cn("text-lg font-bold mt-1", filteredFailures.length > 0 ? "text-error" : "text-success")}>
                {filteredFailures.length}
              </p>
            </button>
          );
        })}
      </div>

      {expandedCategory && (() => {
        const cat = FAILURE_CATEGORIES.find((c) => c.key === expandedCategory)!;
        const failures = categorized[cat.key];
        const filteredFailures = selectedSeverity === "all" ? failures : failures.filter((f) => f.severity === selectedSeverity);
        const Icon = cat.icon;

        return (
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Icon size={16} className="text-error" />
              <h4 className="text-sm font-semibold text-text-primary">{cat.name}</h4>
              <Badge variant="warning" className="text-[10px]">{filteredFailures.length} failures</Badge>
            </div>
            <p className="text-xs text-text-secondary">{cat.description}</p>

            <div className="bg-brand/5 rounded-lg p-3 border border-brand/10">
              <div className="flex items-center gap-1.5 mb-2">
                <Lightbulb size={12} className="text-brand" />
                <span className="text-[11px] font-semibold text-brand">Recommendations</span>
              </div>
              <ul className="space-y-1">
                {cat.recommendations.map((rec, i) => (
                  <li key={i} className="text-xs text-text-secondary flex items-start gap-1.5">
                    <span className="text-brand mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>

            {filteredFailures.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Examples</h5>
                {filteredFailures.slice(0, 5).map((f) => (
                  <div key={f.questionId} className="rounded-lg border border-border p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-text-primary">{f.question}</p>
                      <Badge variant={f.severity === "high" ? "warning" : f.severity === "medium" ? "default" : "success"} className="text-[10px]">
                        {f.severity}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-text-secondary line-clamp-2">{f.actualAnswer}</p>
                    <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
                      <span>Faithfulness: {(f.metrics.faithfulness * 100).toFixed(0)}%</span>
                      <span>·</span>
                      <span>Relevancy: {(f.metrics.answerRelevancy * 100).toFixed(0)}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })()}
    </div>
  );
}
