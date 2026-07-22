"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Lightbulb,
  AlertTriangle,
  Info,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Experiment, Insight } from "./types";
import { formatMetricValue } from "./types";

interface InsightsEngineProps {
  experiments: Experiment[];
  className?: string;
}

function generateInsights(experiments: Experiment[]): Insight[] {
  const insights: Insight[] = [];
  const completed = experiments.filter((e) => e.status === "completed" && e.metrics);

  if (completed.length < 2) {
    insights.push({
      id: "insufficient-data",
      type: "info",
      title: "Need more experiments",
      description: `Only ${completed.length} completed experiment${completed.length === 1 ? "" : "s"}. Run at least 2 experiments for meaningful insights.`,
      confidence: 1,
      priority: "medium",
      actionable: false,
    });
    return insights;
  }

  const avgChunkSize = completed.reduce((s, e) => s + e.chunkSize, 0) / completed.length;
  if (avgChunkSize < 300) {
    insights.push({
      id: "chunk-size-small",
      type: "warning",
      title: "Chunk size is too small",
      description: `Average chunk size is ${avgChunkSize.toFixed(0)} tokens. Smaller chunks may miss important context, reducing retrieval quality.`,
      metric: "chunkSize",
      improvement: "Try increasing chunk size to 512-1024 tokens for better context coverage",
      confidence: 0.8,
      priority: "high",
      actionable: true,
    });
  }

  const hybridRuns = completed.filter((e) => e.retriever.toLowerCase().includes("hybrid"));
  const vectorRuns = completed.filter((e) => e.retriever.toLowerCase() === "vector" || e.retrievalMode === "vector");
  if (hybridRuns.length > 0 && vectorRuns.length > 0) {
    const hybridAvgRecall = hybridRuns.reduce((s, e) => s + (e.metrics?.recallAtK ?? 0), 0) / hybridRuns.length;
    const vectorAvgRecall = vectorRuns.reduce((s, e) => s + (e.metrics?.recallAtK ?? 0), 0) / vectorRuns.length;
    if (hybridAvgRecall > vectorAvgRecall) {
      const improvement = ((hybridAvgRecall - vectorAvgRecall) / vectorAvgRecall * 100).toFixed(0);
      insights.push({
        id: "hybrid-improves-recall",
        type: "success",
        title: `Hybrid retrieval improves Recall by ${improvement}%`,
        description: `Hybrid retrieval averages ${(hybridAvgRecall * 100).toFixed(1)}% recall vs ${(vectorAvgRecall * 100).toFixed(1)}% for vector-only.`,
        metric: "recallAtK",
        improvement: "Consider using hybrid retrieval as your default strategy",
        confidence: 0.85,
        priority: "high",
        actionable: true,
      });
    }
  }

  const rerankedRuns = completed.filter((e) => e.reranker && e.reranker !== "None" && e.reranker !== "none");
  const nonRerankedRuns = completed.filter((e) => !e.reranker || e.reranker === "None" || e.reranker === "none");
  if (rerankedRuns.length > 0 && nonRerankedRuns.length > 0) {
    const rerankedLatency = rerankedRuns.reduce((s, e) => s + (e.metrics?.latencyMs ?? 0), 0) / rerankedRuns.length;
    const nonRerankedLatency = nonRerankedRuns.reduce((s, e) => s + (e.metrics?.latencyMs ?? 0), 0) / nonRerankedRuns.length;
    if (rerankedLatency > nonRerankedLatency * 1.2) {
      const increase = ((rerankedLatency - nonRerankedLatency) / nonRerankedLatency * 100).toFixed(0);
      insights.push({
        id: "reranker-increases-latency",
        type: "warning",
        title: `Reranker increased latency by ${increase}%`,
        description: `Reranked runs average ${formatMetricValue(rerankedLatency, "duration")} vs ${formatMetricValue(nonRerankedLatency, "duration")} without reranking.`,
        metric: "latencyMs",
        improvement: "Evaluate whether the quality improvement justifies the latency cost",
        confidence: 0.75,
        priority: "medium",
        actionable: true,
      });
    }
  }

  const sortedByCost = [...completed].sort((a, b) => (b.metrics?.totalCost ?? 0) - (a.metrics?.totalCost ?? 0));
  const mostExpensive = sortedByCost[0];
  if (mostExpensive && mostExpensive.metrics && mostExpensive.metrics.embeddingCost > mostExpensive.metrics.generationCost * 2) {
    insights.push({
      id: "embedding-dominates-cost",
      type: "info",
      title: "Embedding model dominates overall cost",
      description: `Embedding cost (${formatMetricValue(mostExpensive.metrics.embeddingCost, "currency")}) is ${(mostExpensive.metrics.embeddingCost / mostExpensive.metrics.generationCost).toFixed(1)}x the generation cost.`,
      metric: "totalCost",
      improvement: "Consider a more cost-effective embedding model or reducing chunk count",
      confidence: 0.9,
      priority: "medium",
      actionable: true,
    });
  }

  const hallucinationRuns = completed.filter((e) => (e.metrics?.hallucinationRate ?? 0) > 0.3);
  if (hallucinationRuns.length > 0) {
    insights.push({
      id: "high-hallucination",
      type: "warning",
      title: `${hallucinationRuns.length} experiment${hallucinationRuns.length === 1 ? "" : "s"} with high hallucination rate`,
      description: "These experiments show more than 30% unsupported claims. This may indicate weak context grounding.",
      metric: "hallucinationRate",
      improvement: "Strengthen system prompts with explicit grounding instructions",
      confidence: 0.85,
      priority: "high",
      actionable: true,
    });
  }

  const bestFaithfulness = completed.reduce((best, e) => (e.metrics?.faithfulness ?? 0) > (best.metrics?.faithfulness ?? 0) ? e : best, completed[0]);
  const worstFaithfulness = completed.reduce((worst, e) => (e.metrics?.faithfulness ?? 0) < (worst.metrics?.faithfulness ?? 0) ? e : worst, completed[0]);
  if (bestFaithfulness !== worstFaithfulness && bestFaithfulness.metrics && worstFaithfulness.metrics) {
    const diff = bestFaithfulness.metrics.faithfulness - worstFaithfulness.metrics.faithfulness;
    if (diff > 0.2) {
      insights.push({
        id: "faithfulness-gap",
        type: "suggestion",
        title: "Large faithfulness gap between experiments",
        description: `Best: ${(bestFaithfulness.metrics.faithfulness * 100).toFixed(1)}% (${bestFaithfulness.name}) vs Worst: ${(worstFaithfulness.metrics.faithfulness * 100).toFixed(1)}% (${worstFaithfulness.name}).`,
        metric: "faithfulness",
        improvement: `Analyze what makes "${bestFaithfulness.name}" more faithful and replicate those patterns`,
        confidence: 0.7,
        priority: "medium",
        actionable: true,
      });
    }
  }

  if (insights.length === 0) {
    insights.push({
      id: "all-good",
      type: "success",
      title: "Experiments look healthy",
      description: "No significant issues detected across your experiments. Keep iterating!",
      confidence: 0.6,
      priority: "low",
      actionable: false,
    });
  }

  return insights.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

export function InsightsEngine({ experiments, className }: InsightsEngineProps) {
  const insights = useMemo(() => generateInsights(experiments), [experiments]);

  const icons = {
    suggestion: Lightbulb,
    warning: AlertTriangle,
    info: Info,
    success: CheckCircle2,
  };

  const colors = {
    suggestion: "text-brand bg-brand/10",
    warning: "text-warning bg-warning/10",
    info: "text-info bg-info/10",
    success: "text-success bg-success/10",
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-brand" />
        <h3 className="text-sm font-semibold text-text-primary">Insights</h3>
        <Badge variant="default" className="text-[10px]">{insights.length}</Badge>
      </div>
      {insights.map((insight) => {
        const Icon = icons[insight.type];
        return (
          <Card key={insight.id} className="p-4">
            <div className="flex items-start gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", colors[insight.type])}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-text-primary">{insight.title}</h4>
                  <Badge variant={insight.priority === "high" ? "warning" : insight.priority === "medium" ? "default" : "success"} className="text-[10px]">
                    {insight.priority}
                  </Badge>
                </div>
                <p className="text-xs text-text-secondary mt-1">{insight.description}</p>
                {insight.improvement && (
                  <div className="mt-2 p-2 rounded-lg bg-brand/5 border border-brand/10">
                    <p className="text-[11px] text-brand font-medium">
                      <Lightbulb size={10} className="inline mr-1" />
                      {insight.improvement}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-2 mt-2 text-[10px] text-text-tertiary">
                  <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                  {insight.actionable && <span>· Actionable</span>}
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
