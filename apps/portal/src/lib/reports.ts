import { prisma } from "@/lib/prisma";
import type { ExperimentMetrics } from "./experiment-engine";

export interface ExperimentReport {
  experiment: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    tags: string[];
    config: Record<string, unknown>;
    createdAt: string;
  };
  dataset: {
    id: string;
    name: string;
    version: number;
    questionCount: number;
  } | null;
  summary: {
    totalRuns: number;
    avgLatencyMs: number;
    avgCostUsd: number;
    totalTokens: number;
    metrics: Partial<ExperimentMetrics>;
  };
  runs: Array<{
    id: string;
    query: string;
    status: string;
    latencyMs: number;
    chunkCount: number;
    tokensUsed: number;
    costUsd: number;
    metrics: Partial<ExperimentMetrics>;
    createdAt: string;
  }>;
}

export async function generateExperimentReport(experimentId: string): Promise<ExperimentReport> {
  const experiment = await prisma.experiment.findUnique({
    where: { id: experimentId },
    include: {
      dataset: { select: { id: true, name: true, version: true, _count: { select: { questions: true } } } },
      runs: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          query: true,
          status: true,
          totalLatency: true,
          chunkCount: true,
          tokensUsed: true,
          cost: true,
          metrics: true,
          createdAt: true,
        },
      },
    },
  });

  if (!experiment) throw new Error("Experiment not found");

  const completedRuns = experiment.runs.filter((r) => r.status === "completed");

  const avgLatency = completedRuns.length
    ? completedRuns.reduce((s, r) => s + (r.totalLatency ?? 0), 0) / completedRuns.length
    : 0;
  const totalTokens = completedRuns.reduce((s, r) => s + (r.tokensUsed ?? 0), 0);
  const totalCost = completedRuns.reduce((s, r) => s + (r.cost ?? 0), 0);

  const allMetrics: ExperimentMetrics[] = completedRuns
    .map((r) => r.metrics as ExperimentMetrics | null)
    .filter((m): m is ExperimentMetrics => m !== null);

  const avgMetrics: Partial<ExperimentMetrics> = {};
  if (allMetrics.length > 0) {
    const keys: (keyof ExperimentMetrics)[] = [
      "recallAtK", "precisionAtK", "mrr", "ndcg",
      "answerRelevancy", "faithfulness", "contextPrecision", "contextRecall",
      "latencyMs",
    ];
    for (const key of keys) {
      (avgMetrics as Record<string, number>)[key] =
        allMetrics.reduce((s, m) => s + ((m[key] as number) ?? 0), 0) / allMetrics.length;
    }
  }

  return {
    experiment: {
      id: experiment.id,
      name: experiment.name,
      description: experiment.description,
      status: experiment.status,
      tags: experiment.tags,
      config: experiment.configA as Record<string, unknown>,
      createdAt: experiment.createdAt.toISOString(),
    },
    dataset: experiment.dataset
      ? {
          id: experiment.dataset.id,
          name: experiment.dataset.name,
          version: experiment.dataset.version,
          questionCount: experiment.dataset._count.questions,
        }
      : null,
    summary: {
      totalRuns: completedRuns.length,
      avgLatencyMs: Math.round(avgLatency * 100) / 100,
      avgCostUsd: Math.round(totalCost * 10000) / 10000,
      totalTokens,
      metrics: avgMetrics,
    },
    runs: completedRuns.map((r) => ({
      id: r.id,
      query: r.query,
      status: r.status,
      latencyMs: r.totalLatency ?? 0,
      chunkCount: r.chunkCount ?? 0,
      tokensUsed: r.tokensUsed ?? 0,
      costUsd: r.cost ?? 0,
      metrics: (r.metrics as Partial<ExperimentMetrics>) ?? {},
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

export function reportToJson(report: ExperimentReport): string {
  return JSON.stringify(report, null, 2);
}

export function reportToMarkdown(report: ExperimentReport): string {
  const lines: string[] = [];
  lines.push(`# Experiment Report: ${report.experiment.name}`);
  lines.push("");
  if (report.experiment.description) {
    lines.push(report.experiment.description);
    lines.push("");
  }
  lines.push(`**Status:** ${report.experiment.status}`);
  lines.push(`**Created:** ${report.experiment.createdAt}`);
  if (report.experiment.tags.length) {
    lines.push(`**Tags:** ${report.experiment.tags.join(", ")}`);
  }
  lines.push("");

  lines.push("## Configuration");
  lines.push("");
  for (const [key, value] of Object.entries(report.experiment.config)) {
    lines.push(`| ${key} | ${JSON.stringify(value)} |`);
  }
  lines.push("");

  if (report.dataset) {
    lines.push("## Dataset");
    lines.push("");
    lines.push(`- **Name:** ${report.dataset.name}`);
    lines.push(`- **Version:** ${report.dataset.version}`);
    lines.push(`- **Questions:** ${report.dataset.questionCount}`);
    lines.push("");
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`| Metric | Value |`);
  lines.push(`|--------|-------|`);
  lines.push(`| Total Runs | ${report.summary.totalRuns} |`);
  lines.push(`| Avg Latency | ${report.summary.avgLatencyMs}ms |`);
  lines.push(`| Total Tokens | ${report.summary.totalTokens.toLocaleString()} |`);
  lines.push(`| Total Cost | $${report.summary.avgCostUsd.toFixed(4)} |`);
  lines.push("");

  if (Object.keys(report.summary.metrics).length > 0) {
    lines.push("## Metrics (Averages)");
    lines.push("");
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    for (const [key, value] of Object.entries(report.summary.metrics)) {
      if (typeof value === "number") {
        lines.push(`| ${key} | ${value.toFixed(4)} |`);
      }
    }
    lines.push("");
  }

  if (report.runs.length > 0) {
    lines.push("## Runs");
    lines.push("");
    lines.push(`| Query | Latency | Chunks | Tokens | Cost |`);
    lines.push(`|-------|---------|--------|--------|------|`);
    for (const run of report.runs) {
      const query = run.query.length > 50 ? run.query.slice(0, 47) + "..." : run.query;
      lines.push(
        `| ${query} | ${run.latencyMs.toFixed(0)}ms | ${run.chunkCount} | ${run.tokensUsed.toLocaleString()} | $${run.costUsd.toFixed(4)} |`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function reportToCsv(report: ExperimentReport): string {
  const headers = [
    "run_id", "query", "latency_ms", "chunk_count", "tokens_used", "cost_usd",
    "recall_at_k", "precision_at_k", "mrr", "ndcg", "created_at",
  ];
  const rows = report.runs.map((run) => [
    run.id,
    `"${run.query.replace(/"/g, '""')}"`,
    run.latencyMs.toFixed(2),
    run.chunkCount.toString(),
    run.tokensUsed.toString(),
    run.costUsd.toFixed(6),
    (run.metrics.recallAtK ?? 0).toFixed(4),
    (run.metrics.precisionAtK ?? 0).toFixed(4),
    (run.metrics.mrr ?? 0).toFixed(4),
    (run.metrics.ndcg ?? 0).toFixed(4),
    run.createdAt,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}

export async function exportComparisonReport(experimentAId: string, experimentBId: string): Promise<string> {
  const [reportA, reportB] = await Promise.all([
    generateExperimentReport(experimentAId),
    generateExperimentReport(experimentBId),
  ]);

  const lines: string[] = [];
  lines.push("# Experiment Comparison Report");
  lines.push("");
  lines.push(`## ${reportA.experiment.name} vs ${reportB.experiment.name}`);
  lines.push("");
  lines.push("| Metric | Experiment A | Experiment B | Delta |");
  lines.push("|--------|-------------|-------------|-------|");

  const metricKeys = [
    ...new Set([
      ...Object.keys(reportA.summary.metrics),
      ...Object.keys(reportB.summary.metrics),
    ]),
  ];

  for (const key of metricKeys) {
    const aVal = (reportA.summary.metrics as Record<string, number>)[key] ?? 0;
    const bVal = (reportB.summary.metrics as Record<string, number>)[key] ?? 0;
    const delta = aVal - bVal;
    const arrow = delta > 0 ? "+" : "";
    lines.push(`| ${key} | ${aVal.toFixed(4)} | ${bVal.toFixed(4)} | ${arrow}${delta.toFixed(4)} |`);
  }

  lines.push("");
  lines.push("| Summary | Experiment A | Experiment B |");
  lines.push("|---------|-------------|-------------|");
  lines.push(`| Total Runs | ${reportA.summary.totalRuns} | ${reportB.summary.totalRuns} |`);
  lines.push(`| Avg Latency | ${reportA.summary.avgLatencyMs}ms | ${reportB.summary.avgLatencyMs}ms |`);
  lines.push(`| Total Tokens | ${reportA.summary.totalTokens.toLocaleString()} | ${reportB.summary.totalTokens.toLocaleString()} |`);
  lines.push(`| Total Cost | $${reportA.summary.avgCostUsd.toFixed(4)} | $${reportB.summary.avgCostUsd.toFixed(4)} |`);

  return lines.join("\n");
}
