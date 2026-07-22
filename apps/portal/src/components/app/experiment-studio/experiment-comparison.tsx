"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { GitCompare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GroupedBarChart, Heatmap } from "./charts";
import type { ExperimentComparison } from "./types";
import { METRIC_CONFIG, formatMetricValue, getMetricColor } from "./types";
import type { MetricKey } from "./types";

interface ExperimentComparisonViewProps {
  comparison: ExperimentComparison;
  className?: string;
}

export function ExperimentComparisonView({ comparison, className }: ExperimentComparisonViewProps) {
  const { experimentA: a, experimentB: b, metrics } = comparison;

  const radarData = useMemo(() => {
    const keys: MetricKey[] = ["recallAtK", "precisionAtK", "mrr", "ndcg", "faithfulness", "answerRelevancy"];
    return keys.map((k) => ({
      metric: METRIC_CONFIG[k].shortLabel,
      valueA: metrics[k].a,
      valueB: metrics[k].b,
    }));
  }, [metrics]);

  const barData = useMemo(() => {
    const keys: MetricKey[] = ["recallAtK", "precisionAtK", "mrr", "ndcg", "faithfulness", "answerRelevancy", "groundedness", "contextPrecision"];
    return keys.map((k) => ({
      label: METRIC_CONFIG[k].shortLabel,
      values: [
        { key: "A", value: metrics[k].a, color: "var(--color-brand)" },
        { key: "B", value: metrics[k].b, color: "#3B82F6" },
      ],
    }));
  }, [metrics]);

  const heatmapRows = useMemo(() => {
    const keys: MetricKey[] = ["recallAtK", "precisionAtK", "mrr", "ndcg", "faithfulness", "answerRelevancy", "groundedness", "hallucinationRate", "citationAccuracy", "latencyMs"];
    return keys.map((k) => METRIC_CONFIG[k].shortLabel);
  }, []);

  const heatmapCells = useMemo(() => {
    const keys: MetricKey[] = ["recallAtK", "precisionAtK", "mrr", "ndcg", "faithfulness", "answerRelevancy", "groundedness", "hallucinationRate", "citationAccuracy", "latencyMs"];
    return keys.map((k) => {
      const v = metrics[k];
      return [v.a, v.b, Math.abs(v.delta)];
    });
  }, [metrics]);

  const winner = useMemo(() => {
    const scoringKeys: MetricKey[] = ["recallAtK", "mrr", "ndcg", "faithfulness", "answerRelevancy", "groundedness"];
    let aWins = 0;
    let bWins = 0;
    scoringKeys.forEach((k) => {
      const v = metrics[k];
      if (v.winner === "a") aWins++;
      else if (v.winner === "b") bWins++;
    });
    if (aWins > bWins) return "A";
    if (bWins > aWins) return "B";
    return "Tie";
  }, [metrics]);

  return (
    <div className={cn("space-y-6", className)}>
      <div className="flex items-center gap-4">
        <Card className="flex-1 p-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-brand" />
            <h3 className="text-sm font-bold text-text-primary">{a.name}</h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">{a.embeddingModel} · {a.retriever} · {a.chunkStrategy}</p>
        </Card>
        <GitCompare size={20} className="text-text-tertiary shrink-0" />
        <Card className="flex-1 p-4">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h3 className="text-sm font-bold text-text-primary">{b.name}</h3>
          </div>
          <p className="text-xs text-text-secondary mt-1">{b.embeddingModel} · {b.retriever} · {b.chunkStrategy}</p>
        </Card>
      </div>

      <div className="text-center">
        <Badge variant={winner === "Tie" ? "default" : "brand"} className="text-sm">
          {winner === "Tie" ? "No clear winner" : `Experiment ${winner} wins`}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Radar Comparison</h4>
          <div className="flex justify-center">
            <svg width="260" height="260" viewBox="0 0 260 260" role="img" aria-label="Radar comparison chart">
              {Array.from({ length: 5 }, (_, level) => {
                const r = ((level + 1) / 5) * 100;
                const points = radarData.map((_, i) => {
                  const angle = (i / radarData.length) * 2 * Math.PI - Math.PI / 2;
                  return `${130 + r * Math.cos(angle)},${130 + r * Math.sin(angle)}`;
                }).join(" ");
                return <polygon key={level} points={points} fill="none" stroke="currentColor" strokeWidth="0.5" opacity="0.15" />;
              })}
              <polygon
                points={radarData.map((d, i) => {
                  const angle = (i / radarData.length) * 2 * Math.PI - Math.PI / 2;
                  const r = d.valueA * 100;
                  return `${130 + r * Math.cos(angle)},${130 + r * Math.sin(angle)}`;
                }).join(" ")}
                fill="var(--color-brand)" fillOpacity="0.1" stroke="var(--color-brand)" strokeWidth="2"
              />
              <polygon
                points={radarData.map((d, i) => {
                  const angle = (i / radarData.length) * 2 * Math.PI - Math.PI / 2;
                  const r = d.valueB * 100;
                  return `${130 + r * Math.cos(angle)},${130 + r * Math.sin(angle)}`;
                }).join(" ")}
                fill="#3B82F6" fillOpacity="0.1" stroke="#3B82F6" strokeWidth="2"
              />
              {radarData.map((d, i) => {
                const angle = (i / radarData.length) * 2 * Math.PI - Math.PI / 2;
                const lr = 118;
                return <text key={i} x={130 + lr * Math.cos(angle)} y={130 + lr * Math.sin(angle)} textAnchor="middle" dominantBaseline="middle" className="fill-text-secondary text-[9px]">{d.metric}</text>;
              })}
            </svg>
          </div>
          <div className="flex items-center justify-center gap-4 mt-2 text-xs">
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-brand" /> {a.name}</span>
            <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {b.name}</span>
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-semibold text-text-primary mb-3">Metric Comparison</h4>
          <GroupedBarChart data={barData} height={200} />
        </Card>
      </div>

      <Card className="p-4">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Detailed Comparison</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs" role="table">
            <caption className="sr-only">Experiment comparison metrics</caption>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-3 text-text-tertiary font-medium" scope="col">Metric</th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium" scope="col">{a.name}</th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium" scope="col">{b.name}</th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium" scope="col">Delta</th>
                <th className="text-right py-2 px-3 text-text-tertiary font-medium" scope="col">Winner</th>
              </tr>
            </thead>
            <tbody>
              {(Object.keys(metrics) as MetricKey[]).map((key) => {
                const v = metrics[key];
                const config = METRIC_CONFIG[key];
                return (
                  <tr key={key} className="border-b border-border/50 hover:bg-surface-hover">
                    <td className="py-2 px-3 text-text-primary font-medium">{config.label}</td>
                    <td className={cn("py-2 px-3 text-right font-mono", getMetricColor(v.a, config.higherIsBetter))}>{formatMetricValue(v.a, config.format)}</td>
                    <td className={cn("py-2 px-3 text-right font-mono", getMetricColor(v.b, config.higherIsBetter))}>{formatMetricValue(v.b, config.format)}</td>
                    <td className={cn("py-2 px-3 text-right font-mono", v.delta > 0 ? "text-success" : v.delta < 0 ? "text-error" : "text-text-tertiary")}>
                      {v.delta > 0 ? "+" : ""}{formatMetricValue(v.delta, config.format)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      {v.winner === "a" ? <TrendingUp size={12} className="text-brand inline" /> : v.winner === "b" ? <TrendingDown size={12} className="text-blue-500 inline" /> : <Minus size={12} className="text-text-tertiary inline" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-4">
        <h4 className="text-sm font-semibold text-text-primary mb-3">Metric Heatmap</h4>
        <Heatmap
          rows={heatmapRows}
          columns={["Exp A", "Exp B", "|Delta|"]}
          cells={heatmapCells}
          formatValue={(v) => (v * 100).toFixed(0) + "%"}
        />
      </Card>
    </div>
  );
}
