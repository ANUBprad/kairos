"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { Info, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RadarChart, GroupedBarChart, TrendChart } from "./charts";
import type { ExperimentMetrics, MetricKey } from "./types";
import { METRIC_CONFIG, formatMetricValue, getMetricColor } from "./types";

interface EvaluationCenterProps {
  currentMetrics: ExperimentMetrics;
  baselineMetrics?: ExperimentMetrics;
  trendData?: { metric: MetricKey; data: { timestamp: string; value: number }[] }[];
  className?: string;
}

const METRIC_SECTIONS = [
  {
    title: "Retrieval Quality",
    description: "How well does the system find relevant documents?",
    metrics: ["recallAtK", "precisionAtK", "mrr", "ndcg", "retrievalSuccessRate"] as MetricKey[],
  },
  {
    title: "Generation Quality",
    description: "How good are the generated answers?",
    metrics: ["faithfulness", "answerRelevancy", "groundedness", "contextPrecision", "contextRecall"] as MetricKey[],
  },
  {
    title: "Reliability",
    description: "How trustworthy and accurate are the outputs?",
    metrics: ["hallucinationRate", "citationAccuracy"] as MetricKey[],
  },
  {
    title: "Performance",
    description: "Speed and cost efficiency",
    metrics: ["latencyMs", "totalCost", "totalTokens"] as MetricKey[],
  },
];

export function EvaluationCenter({ currentMetrics, baselineMetrics, trendData = [], className }: EvaluationCenterProps) {
  const radarData = useMemo(() => {
    return [
      { metric: "Recall", value: currentMetrics.recallAtK },
      { metric: "Precision", value: currentMetrics.precisionAtK },
      { metric: "MRR", value: currentMetrics.mrr },
      { metric: "nDCG", value: currentMetrics.ndcg },
      { metric: "Faithfulness", value: currentMetrics.faithfulness },
      { metric: "Relevancy", value: currentMetrics.answerRelevancy },
      { metric: "Grounded", value: currentMetrics.groundedness },
      { metric: "Cite Acc", value: currentMetrics.citationAccuracy },
    ];
  }, [currentMetrics]);

  const barData = useMemo(() => {
    const keys: MetricKey[] = ["recallAtK", "precisionAtK", "mrr", "ndcg", "faithfulness", "answerRelevancy"];
    const values = keys.map((k) => ({
      label: METRIC_CONFIG[k].shortLabel,
      values: [{ key: "Score", value: currentMetrics[k] as number, color: "var(--color-brand)" }],
    }));
    if (baselineMetrics) {
      values.forEach((v, i) => {
        v.values.push({ key: "Baseline", value: baselineMetrics[keys[i]] as number, color: "#3B82F6" });
      });
    }
    return values;
  }, [currentMetrics, baselineMetrics]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-2">Performance Profile</h4>
          <div className="flex justify-center">
            <RadarChart data={radarData} size={220} />
          </div>
        </Card>
        <Card className="p-4 lg:col-span-2">
          <h4 className="text-sm font-semibold text-text-primary mb-2">Metric Comparison</h4>
          <GroupedBarChart data={barData} height={200} />
        </Card>
      </div>

      {METRIC_SECTIONS.map((section) => (
        <div key={section.title}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-text-primary">{section.title}</h3>
            <p className="text-xs text-text-secondary">{section.description}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {section.metrics.map((key) => {
              const config = METRIC_CONFIG[key];
              const value = currentMetrics[key] as number;
              const baseline = baselineMetrics?.[key] as number | undefined;
              const delta = baseline !== undefined ? value - baseline : undefined;

              return (
                <Card key={key} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-medium text-text-primary">{config.label}</h4>
                        <div className="group relative">
                          <Info size={12} className="text-text-tertiary cursor-help" />
                          <div className="absolute left-0 top-6 z-50 hidden group-hover:block w-64 rounded-lg border border-border bg-surface p-3 shadow-lg">
                            <p className="text-xs text-text-secondary">{config.description}</p>
                            <p className="text-[10px] text-text-tertiary mt-1 font-mono">{config.formula}</p>
                            <p className="text-[10px] text-text-tertiary mt-1">{config.whyItMatters}</p>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className={cn("text-2xl font-bold", getMetricColor(value, config.higherIsBetter))}>
                          {formatMetricValue(value, config.format)}
                        </span>
                        {delta !== undefined && (
                          <span className={cn("text-xs font-medium flex items-center gap-0.5", delta > 0 ? "text-success" : delta < 0 ? "text-error" : "text-text-tertiary")}>
                            {delta > 0 ? <TrendingUp size={10} /> : delta < 0 ? <TrendingDown size={10} /> : null}
                            {delta > 0 ? "+" : ""}{(delta * 100).toFixed(1)}%
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-text-tertiary mt-1">{config.whyItMatters}</p>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-border/30">
                    <div className="flex items-center justify-between text-[10px] text-text-tertiary">
                      <span>{config.formula}</span>
                      <span>{config.higherIsBetter ? "↑ Higher is better" : "↓ Lower is better"}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}

      {trendData.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-text-primary mb-3">Metric Trends</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {trendData.map((trend) => (
              <Card key={trend.metric} className="p-4">
                <h4 className="text-xs font-medium text-text-secondary mb-2">{METRIC_CONFIG[trend.metric].label}</h4>
                <TrendChart
                  data={trend.data.map((d) => ({ timestamp: d.timestamp, value: d.value }))}
                  height={80}
                  formatValue={(v) => formatMetricValue(v, METRIC_CONFIG[trend.metric].format)}
                />
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
