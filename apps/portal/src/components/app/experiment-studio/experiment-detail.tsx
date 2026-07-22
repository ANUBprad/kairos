"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  GitBranch,
  Database,
  Cpu,
  FileSearch,
  Brain,
  BarChart3,
  Play,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { MetricGrid } from "./metric-card";
import { RadarChart } from "./charts";
import type { Experiment } from "./types";
import { formatMetricValue, getMetricColor, getStatusLabel } from "./types";

interface ExperimentDetailProps {
  experiment: Experiment;
  onBack?: () => void;
  onCompare?: (id: string) => void;
  onRun?: (id: string) => void;
  className?: string;
}

const TIMELINE_ICONS: Record<string, typeof Clock> = {
  created: FileText,
  started: Play,
  embedding: Cpu,
  indexing: Database,
  retrieval: FileSearch,
  generation: Brain,
  evaluation: BarChart3,
  completed: CheckCircle2,
  failed: XCircle,
  retried: ArrowRight,
  comparison_created: GitBranch,
};

export function ExperimentDetail({ experiment, onBack, onCompare, onRun, className }: ExperimentDetailProps) {
  const radarData = useMemo(() => {
    if (!experiment.metrics) return [];
    return [
      { metric: "Recall", value: experiment.metrics.recallAtK },
      { metric: "MRR", value: experiment.metrics.mrr },
      { metric: "nDCG", value: experiment.metrics.ndcg },
      { metric: "Faith", value: experiment.metrics.faithfulness },
      { metric: "Relevancy", value: experiment.metrics.answerRelevancy },
      { metric: "Grounded", value: experiment.metrics.groundedness },
    ];
  }, [experiment.metrics]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to experiments">
              ← Back
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-text-primary">{experiment.name}</h2>
              <Badge variant={experiment.status === "completed" ? "success" : experiment.status === "running" ? "brand" : experiment.status === "failed" ? "warning" : "default"}>
                {getStatusLabel(experiment.status)}
              </Badge>
            </div>
            <p className="text-sm text-text-secondary mt-0.5">{experiment.description || "No description"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => onCompare?.(experiment.id)}>
            <GitBranch size={14} />
            Compare
          </Button>
          {experiment.status === "draft" && (
            <Button variant="primary" size="sm" onClick={() => onRun?.(experiment.id)}>
              Run Experiment
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Dataset</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.datasetName}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Embedding Model</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.embeddingModel}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Retriever</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.retriever}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">LLM</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.llm}</p>
        </Card>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Chunk Strategy</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.chunkStrategy}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Chunk Size</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.chunkSize}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Overlap</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.chunkOverlap}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Top K</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.topK}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Threshold</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.similarityThreshold}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Reranker</p>
          <p className="text-sm font-medium text-text-primary mt-1">{experiment.reranker || "None"}</p>
        </Card>
      </div>

      {experiment.metrics && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Evaluation Metrics</h3>
          <MetricGrid
            metrics={{
              recallAtK: experiment.metrics.recallAtK,
              precisionAtK: experiment.metrics.precisionAtK,
              mrr: experiment.metrics.mrr,
              ndcg: experiment.metrics.ndcg,
              faithfulness: experiment.metrics.faithfulness,
              answerRelevancy: experiment.metrics.answerRelevancy,
              contextPrecision: experiment.metrics.contextPrecision,
              contextRecall: experiment.metrics.contextRecall,
              groundedness: experiment.metrics.groundedness,
              hallucinationRate: experiment.metrics.hallucinationRate,
              citationAccuracy: experiment.metrics.citationAccuracy,
              retrievalSuccessRate: experiment.metrics.retrievalSuccessRate,
            }}
            columns={4}
            compact
          />
        </div>
      )}

      {experiment.metrics && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Performance Profile</h3>
            <Card className="p-4 flex justify-center">
              <RadarChart data={radarData} size={240} />
            </Card>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-text-primary mb-3">Cost & Performance</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Latency</span>
                <span className="font-medium text-text-primary">{formatMetricValue(experiment.metrics.latencyMs, "duration")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Embedding Cost</span>
                <span className="font-medium text-text-primary">{formatMetricValue(experiment.metrics.embeddingCost, "currency")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Generation Cost</span>
                <span className="font-medium text-text-primary">{formatMetricValue(experiment.metrics.generationCost, "currency")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Total Cost</span>
                <span className={cn("font-medium", getMetricColor(experiment.metrics.totalCost, false))}>{formatMetricValue(experiment.metrics.totalCost, "currency")}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Total Tokens</span>
                <span className="font-medium text-text-primary">{formatMetricValue(experiment.metrics.tokenUsage.totalTokens, "tokens")}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {experiment.timeline && experiment.timeline.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Timeline</h3>
          <div className="space-y-0">
            {experiment.timeline.map((event, i) => {
              const Icon = TIMELINE_ICONS[event.type] || Clock;
              const isLast = i === experiment.timeline!.length - 1;
              return (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center", event.type === "completed" ? "bg-success/10" : event.type === "failed" ? "bg-error/10" : "bg-brand/10")}>
                      <Icon size={14} className={event.type === "completed" ? "text-success" : event.type === "failed" ? "text-error" : "text-brand"} />
                    </div>
                    {!isLast && <div className="w-px h-6 bg-border" />}
                  </div>
                  <div className="pb-4">
                    <p className="text-sm font-medium text-text-primary">{event.label}</p>
                    <p className="text-xs text-text-secondary">{event.description}</p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-text-tertiary">
                      <span>{new Date(event.timestamp).toLocaleTimeString()}</span>
                      {event.durationMs !== undefined && <span>· {formatMetricValue(event.durationMs, "duration")}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
