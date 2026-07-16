"use client";

import { useState, useEffect, memo } from "react";
import { PageHeader } from "@/components/app/page-header";
import { ChartScatter, ChartBar } from "@/components/ui/charts";
import { ConfidenceIntervalChart } from "@/components/ui/confidence-interval-chart";
import { HeatMap } from "@/components/ui/heat-map";
import { PremiumCard } from "@/components/ui/premium-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Filter,
  Search,
} from "lucide-react";
import { listDatasets, getBaselines } from "@/lib/actions/evaluation";
import { logger } from "@/lib/logger";

interface BenchmarkRun {
  id: string;
  name: string;
  embedding: string;
  chunking: string;
  retriever: string;
  llm: string;
  dataset: string;
  recall: number;
  precision: number;
  mrr: number;
  ndcg: number;
  faithfulness: number;
  latency: number;
  cost: number;
}

const METRICS = [
  { key: "recall", label: "Recall@3" },
  { key: "precision", label: "Precision@3" },
  { key: "mrr", label: "MRR" },
  { key: "ndcg", label: "nDCG" },
  { key: "faithfulness", label: "Faithfulness" },
  { key: "latency", label: "Latency (ms)" },
  { key: "cost", label: "Cost ($)" },
];

const BenchmarkExplorerClientInner = function BenchmarkExplorerClient() {
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Record<string, string | null>>({
    embedding: null,
    chunking: null,
    retriever: null,
    llm: null,
    dataset: null,
  });
  const [xMetric, setXMetric] = useState("recall");
  const [yMetric, setYMetric] = useState("mrr");

  useEffect(() => {
    async function fetchData() {
      try {
        const [datasets, baselines] = await Promise.all([
          listDatasets(),
          getBaselines(),
        ]);

        const datasetNames = datasets.map((d) => d.name.toLowerCase());

        const mappedRuns: BenchmarkRun[] = baselines.map((run) => {
          const metrics = (run.aggregatedMetrics && typeof run.aggregatedMetrics === "object" && !Array.isArray(run.aggregatedMetrics))
            ? run.aggregatedMetrics as Record<string, unknown>
            : {};
          return {
            id: run.id,
            name: run.name || "Unnamed Run",
            embedding: String(metrics.embedding || "unknown"),
            chunking: String(metrics.chunking || "unknown"),
            retriever: String(metrics.retriever || "unknown"),
            llm: String(metrics.llm || "unknown"),
            dataset: datasetNames[0] || "unknown",
            recall: Number(metrics.avgRecallAtK) || 0,
            precision: Number(metrics.avgPrecisionAtK) || 0,
            mrr: Number(metrics.avgMRR) || 0,
            ndcg: Number(metrics.avgNDCG) || 0,
            faithfulness: Number(metrics.avgFaithfulness) || 0,
            latency: Number(metrics.avgLatencyMs) || 0,
            cost: Number(metrics.totalCost) || 0,
          };
        });

        setRuns(mappedRuns);
      } catch (error) {
        logger.error("Failed to fetch benchmark data", { error: error instanceof Error ? error.message : String(error) });
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filteredRuns = runs.filter((run) =>
    Object.entries(filters).every(([key, val]) => !val || run[key as keyof BenchmarkRun] === val)
  );

  const filterOptions = {
    embedding: [...new Set(runs.map((r) => r.embedding))].filter(Boolean),
    chunking: [...new Set(runs.map((r) => r.chunking))].filter(Boolean),
    retriever: [...new Set(runs.map((r) => r.retriever))].filter(Boolean),
    llm: [...new Set(runs.map((r) => r.llm))].filter(Boolean),
    dataset: [...new Set(runs.map((r) => r.dataset))].filter(Boolean),
  };

  const scatterData = filteredRuns.map((run) => ({
    name: run.name,
    x: run[xMetric as keyof BenchmarkRun] as number,
    y: run[yMetric as keyof BenchmarkRun] as number,
  }));

  const barData = filteredRuns.map((run) => ({
    name: run.name,
    Recall: run.recall,
    MRR: run.mrr,
    nDCG: run.ndcg,
    Faithfulness: run.faithfulness,
  }));

  const ciData = METRICS.slice(0, 5).map((m) => {
    const values = filteredRuns.map((r) => r[m.key as keyof BenchmarkRun] as number);
    const mean = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const std = values.length > 0 ? Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) : 0;
    return {
      label: m.label,
      mean,
      lower: mean - 1.96 * std,
      upper: mean + 1.96 * std,
    };
  });

  const matrixRows = filteredRuns.map((r) => r.name);
  const matrixCols = ["Recall", "MRR", "nDCG", "Precision"];
  const matrixCells = filteredRuns.map((r) => [r.recall, r.mrr, r.ndcg, r.precision]);

  if (loading) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Benchmark Explorer"
          description="Interactive exploration of benchmark results with filtering, scatter plots, and statistical comparisons."
          purpose="Compare retrieval configurations across multiple metrics and datasets to find the optimal setup."
          nextAction={{ label: "Run Benchmark", href: "/app/evaluation" }}
          relatedPages={[
            { label: "Evaluation", href: "/app/evaluation" },
            { label: "Retrieval Lab", href: "/app/retrieval-lab" },
          ]}
        />
        <div className="space-y-4">
          <Skeleton className="h-16 w-full" />
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="animate-fade-in">
        <PageHeader
          title="Benchmark Explorer"
          description="Interactive exploration of benchmark results with filtering, scatter plots, and statistical comparisons."
          purpose="Compare retrieval configurations across multiple metrics and datasets to find the optimal setup."
          nextAction={{ label: "Run Benchmark", href: "/app/evaluation" }}
          relatedPages={[
            { label: "Evaluation", href: "/app/evaluation" },
            { label: "Retrieval Lab", href: "/app/retrieval-lab" },
          ]}
        />
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16">
          <Search size={40} className="mb-3 text-text-tertiary" />
          <p className="text-sm font-medium text-text-secondary">No benchmark data yet</p>
          <p className="mt-1 text-xs text-text-tertiary">
            Run benchmarks from the Evaluation page to explore results here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Benchmark Explorer"
        description="Interactive exploration of benchmark results with filtering, scatter plots, and statistical comparisons."
        purpose="Compare retrieval configurations across multiple metrics and datasets to find the optimal setup."
        nextAction={{ label: "Run Benchmark", href: "/app/evaluation" }}
        relatedPages={[
          { label: "Evaluation", href: "/app/evaluation" },
          { label: "Retrieval Lab", href: "/app/retrieval-lab" },
        ]}
      />

      <PremiumCard variant="elevated" className="mb-4">
        <div className="flex flex-wrap items-center gap-3 p-4">
          <Filter size={14} className="text-text-tertiary" />
          {Object.entries(filterOptions).map(([key, options]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                {key}:
              </span>
              <select
                value={filters[key] || ""}
                onChange={(e) =>
                  setFilters({ ...filters, [key]: e.target.value || null })
                }
                className="rounded-md border border-border bg-bg px-2 py-1 text-xs text-text-secondary outline-none focus:border-brand min-w-0 max-w-[120px] sm:max-w-none"
              >
                <option value="">All</option>
                {options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="ml-auto text-xs text-text-tertiary">
            {filteredRuns.length} configurations
          </div>
        </div>
      </PremiumCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <PremiumCard variant="elevated">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-text-primary">Cost-Quality Tradeoff</h3>
              <div className="flex items-center gap-2">
                <select
                  value={xMetric}
                  onChange={(e) => setXMetric(e.target.value)}
                  className="rounded border border-border bg-bg px-2 py-1 text-xs text-text-secondary outline-none"
                >
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      X: {m.label}
                    </option>
                  ))}
                </select>
                <select
                  value={yMetric}
                  onChange={(e) => setYMetric(e.target.value)}
                  className="rounded border border-border bg-bg px-2 py-1 text-xs text-text-secondary outline-none"
                >
                  {METRICS.map((m) => (
                    <option key={m.key} value={m.key}>
                      Y: {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <ChartScatter
              data={scatterData.map((d) => ({ ...d, id: d.name }))}
              xKey="x"
              yKey="y"
              xLabel={METRICS.find((m) => m.key === xMetric)?.label}
              yLabel={METRICS.find((m) => m.key === yMetric)?.label}
              height={280}
            />
          </div>
        </PremiumCard>

        <PremiumCard variant="elevated">
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Metric Comparison</h3>
            <ChartBar data={barData} xKey="name" yKeys={[
              { key: "Recall", color: "#FF5A0A" },
              { key: "MRR", color: "#3B82F6" },
              { key: "nDCG", color: "#22C55E" },
            ]} height={280} />
          </div>
        </PremiumCard>

        <PremiumCard variant="elevated">
          <div className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-text-primary">Confidence Intervals</h3>
            <ConfidenceIntervalChart data={ciData} height={280} />
          </div>
        </PremiumCard>

        <PremiumCard variant="elevated">
          <div className="p-4">
            <HeatMap
              rows={matrixRows}
              columns={matrixCols}
              cells={matrixCells}
              title="Configuration Heatmap"
              formatter={(v) => v.toFixed(2)}
            />
          </div>
        </PremiumCard>
      </div>
    </div>
  );
};

export const BenchmarkExplorerClient = memo(BenchmarkExplorerClientInner);
