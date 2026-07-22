"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, Clock, DollarSign, HardDrive } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GroupedBarChart, Heatmap } from "./charts";
import type { BenchmarkStrategy } from "./types";
import { METRIC_CONFIG, formatMetricValue, getMetricColor } from "./types";

interface BenchmarkCenterProps {
  strategies: BenchmarkStrategy[];
  className?: string;
}

export function BenchmarkCenter({ strategies, className }: BenchmarkCenterProps) {
  const [compareMode, setCompareMode] = useState<"quality" | "speed" | "cost" | "memory">("quality");

  const sortedStrategies = useMemo(() => {
    return [...strategies].sort((a, b) => {
      switch (compareMode) {
        case "quality": return b.metrics.recallAtK - a.metrics.recallAtK;
        case "speed": return a.metrics.latencyMs - b.metrics.latencyMs;
        case "cost": return a.metrics.totalCost - b.metrics.totalCost;
        case "memory": return b.metrics.tokenUsage.totalTokens - a.metrics.tokenUsage.totalTokens;
      }
    });
  }, [strategies, compareMode]);

  const barData = useMemo(() => {
    return sortedStrategies.map((s) => ({
      label: s.name,
      values: [
        { key: "Recall@K", value: s.metrics.recallAtK, color: "var(--color-brand)" },
        { key: "MRR", value: s.metrics.mrr, color: "#3B82F6" },
        { key: "nDCG", value: s.metrics.ndcg, color: "#8B5CF6" },
        { key: "Faithfulness", value: s.metrics.faithfulness, color: "#10B981" },
      ],
    }));
  }, [sortedStrategies]);

  const heatmapData = useMemo(() => {
    const metricKeys: (keyof typeof METRIC_CONFIG)[] = ["recallAtK", "precisionAtK", "mrr", "ndcg", "faithfulness", "latencyMs", "totalCost"];
    return {
      rows: sortedStrategies.map((s) => s.name),
      columns: metricKeys.map((k) => METRIC_CONFIG[k].shortLabel),
      cells: sortedStrategies.map((s) =>
        metricKeys.map((k) => s.metrics[k] as number)
      ),
    };
  }, [sortedStrategies]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-2" role="radiogroup" aria-label="Benchmark comparison mode">
        {([
          { key: "quality" as const, label: "Quality", icon: TrendingUp },
          { key: "speed" as const, label: "Speed", icon: Clock },
          { key: "cost" as const, label: "Cost", icon: DollarSign },
          { key: "memory" as const, label: "Memory", icon: HardDrive },
        ]).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setCompareMode(key)}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", compareMode === key ? "bg-brand/10 text-brand border border-brand/20" : "bg-surface border border-border text-text-secondary hover:bg-surface-hover")}
            role="radio"
            aria-checked={compareMode === key}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      <Card className="p-4">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Strategy Comparison</h4>
        <GroupedBarChart data={barData} height={200} />
      </Card>

      <div className="space-y-2">
        {sortedStrategies.map((s, i) => {
          const isTop = i === 0;
          return (
            <Card key={s.id} className={cn("p-4", isTop && "border-brand/30 bg-brand/5")}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={cn("text-lg font-bold", isTop ? "text-brand" : "text-text-tertiary")}>#{i + 1}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-text-primary">{s.name}</h4>
                      {isTop && <Badge variant="brand" className="text-[10px]">Best {compareMode}</Badge>}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{s.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <div className="text-center">
                    <p className="text-text-tertiary">Quality</p>
                    <p className={cn("font-bold", getMetricColor(s.quality, true))}>{(s.quality * 100).toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-text-tertiary">Speed</p>
                    <p className={cn("font-bold", getMetricColor(s.speed, true))}>{(s.speed * 100).toFixed(0)}%</p>
                  </div>
                  <div className="text-center">
                    <p className="text-text-tertiary">Cost</p>
                    <p className="font-bold text-text-primary">{formatMetricValue(s.cost, "currency")}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-text-tertiary">Latency</p>
                    <p className="font-bold text-text-primary">{formatMetricValue(s.metrics.latencyMs, "duration")}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-2">
                {(["recallAtK", "mrr", "ndcg", "faithfulness", "answerRelevancy"] as const).map((key) => (
                  <span key={key} className={cn("text-[10px] font-medium", getMetricColor(s.metrics[key], METRIC_CONFIG[key].higherIsBetter))}>
                    {METRIC_CONFIG[key].shortLabel}: {(s.metrics[key] * 100).toFixed(0)}%
                  </span>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Full Metric Heatmap</h4>
        <Heatmap
          rows={heatmapData.rows}
          columns={heatmapData.columns}
          cells={heatmapData.cells}
          formatValue={(v) => (v * 100).toFixed(0) + "%"}
        />
      </Card>
    </div>
  );
}
