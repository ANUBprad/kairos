import type { DescriptiveStats } from "./statistics";

export interface ReportConfig {
  title: string;
  author?: string;
  date?: string;
  description?: string;
}

export interface ReportDatasetInfo {
  name: string;
  questionCount: number;
  source?: string;
  knowledgeBase?: string;
}

export interface ReportStrategyResult {
  label: string;
  metrics: Record<string, number>;
  perQuestionStats: Record<string, DescriptiveStats>;
  retrievalConfig: Record<string, unknown>;
}

export interface ReportSection {
  title: string;
  content: string;
  tables?: ReportTable[];
  charts?: ReportChart[];
}

export interface ReportTable {
  caption: string;
  headers: string[];
  rows: string[][];
}

export interface ReportChart {
  type: "bar" | "radar" | "line";
  title: string;
  data: Array<{ label: string; value: number }>;
  series?: Array<{ label: string; values: number[] }>;
}

export interface FullReport {
  metadata: {
    title: string;
    generatedAt: string;
    version: string;
  };
  config: ReportConfig;
  dataset: ReportDatasetInfo;
  results: ReportStrategyResult[];
  sections: ReportSection[];
  summary: {
    totalExperiments: number;
    bestOverall: string;
    topMetrics: Record<string, string>;
    keyFindings: string[];
    recommendations: string[];
  };
  markdown: string;
  json: string;
}

export function generateFullReport(
  config: ReportConfig,
  dataset: ReportDatasetInfo,
  strategyResults: ReportStrategyResult[],
): FullReport {
  const metadata = {
    title: config.title,
    generatedAt: new Date().toISOString(),
    version: "1.0",
  };

  const summary = generateSummary(strategyResults);

  const sections: ReportSection[] = [
    generateTitleSection(config, dataset),
    generateDatasetSection(dataset),
    generateConfigurationSection(strategyResults),
    generateMetricsOverviewSection(strategyResults),
    generateDetailedResultsSection(strategyResults),
    generateStatisticalAnalysisSection(strategyResults),
    generateLatencyAnalysisSection(strategyResults),
    generateRankingSection(strategyResults),
    generateDiscussionSection(summary),
    generateConclusionSection(summary),
    generateFutureWorkSection(),
  ];

  const markdown = renderMarkdown(config, metadata, dataset, sections, summary);

  return {
    metadata,
    config,
    dataset,
    results: strategyResults,
    sections,
    summary,
    markdown,
    json: JSON.stringify({ metadata, config, dataset, results: strategyResults, sections, summary }, null, 2),
  };
}

function generateSummary(results: ReportStrategyResult[]) {
  const best = results.reduce((a, b) => {
    const scoreA = (a.metrics.avgRecallAtK ?? 0) + (a.metrics.avgMRR ?? 0) + (a.metrics.avgNDCG ?? 0);
    const scoreB = (b.metrics.avgRecallAtK ?? 0) + (b.metrics.avgMRR ?? 0) + (b.metrics.avgNDCG ?? 0);
    return scoreA >= scoreB ? a : b;
  }, results[0]);

  const topMetrics: Record<string, string> = {};
  for (const key of Object.keys(best?.metrics || {})) {
    const sorted = [...results].sort((a, b) => (b.metrics[key] ?? 0) - (a.metrics[key] ?? 0));
    topMetrics[`best_${key}`] = sorted[0]?.label ?? "";
  }

  const keyFindings: string[] = [];
  if (results.length >= 2) {
    const top2 = [...results].sort((a, b) => (b.metrics.avgRecallAtK ?? 0) - (a.metrics.avgRecallAtK ?? 0));
    keyFindings.push(
      `${top2[0].label} achieves the highest Recall@K (${(top2[0].metrics.avgRecallAtK * 100).toFixed(1)}%), ${(top2[0].metrics.avgRecallAtK - top2[1].metrics.avgRecallAtK > 0.05 ? `${((top2[0].metrics.avgRecallAtK / top2[1].metrics.avgRecallAtK - 1) * 100).toFixed(0)}% higher than ${top2[1].label}` : "comparable to the next best configuration")}.`,
    );

    const fastest = [...results].sort((a, b) => (a.metrics.avgLatencyMs ?? Infinity) - (b.metrics.avgLatencyMs ?? Infinity))[0];
    keyFindings.push(
      `${fastest.label} is the fastest configuration with an average latency of ${fastest.metrics.avgLatencyMs.toFixed(0)}ms.`,
    );
  }

  const recommendations: string[] = [];
  for (const r of results) {
    if ((r.metrics.avgRecallAtK ?? 0) < 0.5) {
      recommendations.push(`${r.label}: Low recall (${(r.metrics.avgRecallAtK * 100).toFixed(0)}%). Consider increasing top-K or lowering similarity threshold.`);
    }
    if ((r.metrics.avgPrecisionAtK ?? 0) < 0.3) {
      recommendations.push(`${r.label}: Low precision (${(r.metrics.avgPrecisionAtK * 100).toFixed(0)}%). Try reranking or increasing similarity threshold.`);
    }
  }
  if (recommendations.length === 0) {
    recommendations.push("All configurations show acceptable performance. Consider exploring additional strategies or fine-tuning hyperparameters.");
  }

  return {
    totalExperiments: results.length,
    bestOverall: best?.label ?? "",
    topMetrics,
    keyFindings,
    recommendations,
  };
}

function generateTitleSection(config: ReportConfig, dataset: ReportDatasetInfo): ReportSection {
  return {
    title: "Report Overview",
    content: [
      `**Title:** ${config.title}`,
      config.author ? `**Author:** ${config.author}` : "",
      config.date ? `**Date:** ${config.date}` : "",
      `**Generated:** ${new Date().toISOString()}`,
      config.description ? `**Description:** ${config.description}` : "",
      "",
      `This report presents a comprehensive evaluation of retrieval strategies applied to the **${dataset.name}** dataset (${dataset.questionCount} questions).`,
      "",
      "The evaluation covers multiple configurations across retrieval models, chunking strategies, and hyperparameters. Each configuration is assessed using standard Information Retrieval metrics: Recall@K, Precision@K, Hit Rate, MRR, and nDCG.",
      "",
    ].filter(Boolean).join("\n"),
  };
}

function generateDatasetSection(dataset: ReportDatasetInfo): ReportSection {
  const headers = ["Property", "Value"];
  const rows = [
    ["Dataset Name", dataset.name],
    ["Questions", String(dataset.questionCount)],
  ];
  if (dataset.source) rows.push(["Source", dataset.source]);
  if (dataset.knowledgeBase) rows.push(["Knowledge Base", dataset.knowledgeBase]);

  return {
    title: "Dataset Information",
    content: "Details of the benchmark dataset used in this evaluation.",
    tables: [{ caption: "Dataset Properties", headers, rows }],
  };
}

function generateConfigurationSection(results: ReportStrategyResult[]): ReportSection {
  const headers = ["Configuration", "Strategy", "Top-K", "Chunk Size", "Overlap", "Embedding Model", "Retrieval Mode"];
  const rows = results.map((r) => [
    r.label,
    String(r.retrievalConfig.retrievalStrategy ?? r.retrievalConfig.retrievalMode ?? "vector"),
    String(r.retrievalConfig.topK ?? "?"),
    String(r.retrievalConfig.chunkSize ?? "?"),
    String(r.retrievalConfig.chunkOverlap ?? "?"),
    String(r.retrievalConfig.embeddingModel ?? "?"),
    String(r.retrievalConfig.retrievalMode ?? "?"),
  ]);

  return {
    title: "Configuration Matrix",
    content: "All evaluated configurations with their parameters.",
    tables: [{ caption: "Experimental Configurations", headers, rows }],
  };
}

function generateMetricsOverviewSection(results: ReportStrategyResult[]): ReportSection {
  const headers = ["Configuration", "Recall@K", "Precision@K", "Hit Rate", "MRR", "nDCG", "Latency (ms)"];
  const rows = results.map((r) => [
    r.label,
    (r.metrics.avgRecallAtK ?? 0).toFixed(4),
    (r.metrics.avgPrecisionAtK ?? 0).toFixed(4),
    (r.metrics.avgHitRate ?? 0).toFixed(4),
    (r.metrics.avgMRR ?? 0).toFixed(4),
    (r.metrics.avgNDCG ?? 0).toFixed(4),
    (r.metrics.avgLatencyMs ?? 0).toFixed(1),
  ]);

  const charts: ReportChart[] = [];
  if (results.length > 0) {
    charts.push({
      type: "bar",
      title: "Recall@K Comparison",
      data: results.map((r) => ({ label: r.label, value: r.metrics.avgRecallAtK ?? 0 })),
    });
    charts.push({
      type: "bar",
      title: "MRR Comparison",
      data: results.map((r) => ({ label: r.label, value: r.metrics.avgMRR ?? 0 })),
    });
  }

  return {
    title: "Metrics Overview",
    content: "Aggregated metrics across all configurations. Higher is better for all metrics except Latency.",
    tables: [{ caption: "Aggregated Metrics Summary", headers, rows }],
    charts,
  };
}

function generateDetailedResultsSection(results: ReportStrategyResult[]): ReportSection {
  const tables: ReportTable[] = [];
  const charts: ReportChart[] = [];

  for (const r of results) {
    const headers = ["Statistic", "Recall@K", "Precision@K", "MRR", "nDCG", "Hit Rate", "Latency (ms)"];
    const stats = r.perQuestionStats;
    const rows = [
      ["Mean",
        formatStat(stats.recallAtK?.mean),
        formatStat(stats.precisionAtK?.mean),
        formatStat(stats.mrr?.mean),
        formatStat(stats.ndcg?.mean),
        formatStat(stats.hitRate?.mean),
        formatStat(stats.latencyMs?.mean),
      ],
      ["Median",
        formatStat(stats.recallAtK?.median),
        formatStat(stats.precisionAtK?.median),
        formatStat(stats.mrr?.median),
        formatStat(stats.ndcg?.median),
        formatStat(stats.hitRate?.median),
        formatStat(stats.latencyMs?.median),
      ],
      ["Std Dev",
        formatStat(stats.recallAtK?.stdDev),
        formatStat(stats.precisionAtK?.stdDev),
        formatStat(stats.mrr?.stdDev),
        formatStat(stats.ndcg?.stdDev),
        formatStat(stats.hitRate?.stdDev),
        formatStat(stats.latencyMs?.stdDev),
      ],
      ["95% CI",
        `${stats.recallAtK?.ci95Lower.toFixed(4)}–${stats.recallAtK?.ci95Upper.toFixed(4)}`,
        `${stats.precisionAtK?.ci95Lower.toFixed(4)}–${stats.precisionAtK?.ci95Upper.toFixed(4)}`,
        `${stats.mrr?.ci95Lower.toFixed(4)}–${stats.mrr?.ci95Upper.toFixed(4)}`,
        `${stats.ndcg?.ci95Lower.toFixed(4)}–${stats.ndcg?.ci95Upper.toFixed(4)}`,
        `${stats.hitRate?.ci95Lower.toFixed(4)}–${stats.hitRate?.ci95Upper.toFixed(4)}`,
        `${stats.latencyMs?.ci95Lower.toFixed(1)}–${stats.latencyMs?.ci95Upper.toFixed(1)}`,
      ],
      ["Min",
        formatStat(stats.recallAtK?.min),
        formatStat(stats.precisionAtK?.min),
        formatStat(stats.mrr?.min),
        formatStat(stats.ndcg?.min),
        formatStat(stats.hitRate?.min),
        formatStat(stats.latencyMs?.min),
      ],
      ["Max",
        formatStat(stats.recallAtK?.max),
        formatStat(stats.precisionAtK?.max),
        formatStat(stats.mrr?.max),
        formatStat(stats.ndcg?.max),
        formatStat(stats.hitRate?.max),
        formatStat(stats.latencyMs?.max),
      ],
    ];

    tables.push({
      caption: `Detailed Statistics — ${r.label}`,
      headers,
      rows,
    });

    charts.push({
      type: "radar",
      title: `Radar Chart — ${r.label}`,
      data: [
        { label: "Recall@K", value: r.metrics.avgRecallAtK ?? 0 },
        { label: "Precision@K", value: r.metrics.avgPrecisionAtK ?? 0 },
        { label: "Hit Rate", value: r.metrics.avgHitRate ?? 0 },
        { label: "MRR", value: r.metrics.avgMRR ?? 0 },
        { label: "nDCG", value: r.metrics.avgNDCG ?? 0 },
      ],
    });
  }

  return {
    title: "Detailed Results",
    content: "Per-configuration detailed statistics including mean, median, standard deviation, 95% confidence intervals, and range.",
    tables,
    charts,
  };
}

function generateStatisticalAnalysisSection(results: ReportStrategyResult[]): ReportSection {
  if (results.length < 2) {
    return {
      title: "Statistical Analysis",
      content: "At least 2 configurations are required for comparative statistical analysis.",
    };
  }

  const content = [
    "Comparative statistical analysis between configurations. The improvement percentage indicates the relative difference in mean Recall@K.",
    "",
  ];

  const tables: ReportTable[] = [];
  const sorted = [...results].sort((a, b) => (b.metrics.avgRecallAtK ?? 0) - (a.metrics.avgRecallAtK ?? 0));
  const best = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const other = sorted[i];
    const improvement = best.metrics.avgRecallAtK - other.metrics.avgRecallAtK;
    const improvementPct = other.metrics.avgRecallAtK !== 0
      ? ((best.metrics.avgRecallAtK - other.metrics.avgRecallAtK) / other.metrics.avgRecallAtK) * 100
      : 0;

    tables.push({
      caption: `${best.label} vs ${other.label}`,
      headers: ["Metric", best.label, other.label, "Difference", "Improvement"],
      rows: [
        ["Recall@K",
          best.metrics.avgRecallAtK.toFixed(4),
          other.metrics.avgRecallAtK.toFixed(4),
          `+${improvement.toFixed(4)}`,
          `+${improvementPct.toFixed(1)}%`,
        ],
        ["Precision@K",
          best.metrics.avgPrecisionAtK.toFixed(4),
          other.metrics.avgPrecisionAtK.toFixed(4),
          (best.metrics.avgPrecisionAtK - other.metrics.avgPrecisionAtK).toFixed(4),
          `${other.metrics.avgPrecisionAtK !== 0 ? `+${((best.metrics.avgPrecisionAtK - other.metrics.avgPrecisionAtK) / other.metrics.avgPrecisionAtK * 100).toFixed(1)}%` : "N/A"}`,
        ],
        ["MRR",
          best.metrics.avgMRR.toFixed(4),
          other.metrics.avgMRR.toFixed(4),
          (best.metrics.avgMRR - other.metrics.avgMRR).toFixed(4),
          `${other.metrics.avgMRR !== 0 ? `+${((best.metrics.avgMRR - other.metrics.avgMRR) / other.metrics.avgMRR * 100).toFixed(1)}%` : "N/A"}`,
        ],
        ["nDCG",
          best.metrics.avgNDCG.toFixed(4),
          other.metrics.avgNDCG.toFixed(4),
          (best.metrics.avgNDCG - other.metrics.avgNDCG).toFixed(4),
          `${other.metrics.avgNDCG !== 0 ? `+${((best.metrics.avgNDCG - other.metrics.avgNDCG) / other.metrics.avgNDCG * 100).toFixed(1)}%` : "N/A"}`,
        ],
      ],
    });
  }

  return {
    title: "Statistical Analysis",
    content: content.join("\n"),
    tables,
  };
}

function generateLatencyAnalysisSection(results: ReportStrategyResult[]): ReportSection {
  const sorted = [...results].sort((a, b) => (a.metrics.avgLatencyMs ?? 0) - (b.metrics.avgLatencyMs ?? 0));
  const fastest = sorted[0];
  const slowest = sorted[sorted.length - 1];

  const content = [
    "Latency analysis across configurations. Lower latency is better.",
    "",
    `Fastest: **${fastest.label}** (${fastest.metrics.avgLatencyMs.toFixed(0)}ms average)`,
    `Slowest: **${slowest.label}** (${slowest.metrics.avgLatencyMs.toFixed(0)}ms average)`,
    `Range: ${fastest.metrics.avgLatencyMs.toFixed(0)}ms – ${slowest.metrics.avgLatencyMs.toFixed(0)}ms`,
    "",
  ];

  const headers = ["Configuration", "Avg Latency (ms)", "vs Fastest"];
  const rows = sorted.map((r) => [
    r.label,
    r.metrics.avgLatencyMs.toFixed(1),
    r === fastest ? "—" : `${((r.metrics.avgLatencyMs / fastest.metrics.avgLatencyMs - 1) * 100).toFixed(0)}% slower`,
  ]);

  return {
    title: "Latency Analysis",
    content: content.join("\n"),
    tables: [{ caption: "Latency Comparison", headers, rows }],
    charts: [{
      type: "bar",
      title: "Average Latency by Configuration",
      data: sorted.map((r) => ({ label: r.label, value: r.metrics.avgLatencyMs ?? 0 })),
    }],
  };
}

function generateRankingSection(results: ReportStrategyResult[]): ReportSection {
  const sorted = [...results].sort((a, b) => {
    const scoreA = (a.metrics.avgRecallAtK ?? 0) + (a.metrics.avgMRR ?? 0) + (a.metrics.avgNDCG ?? 0);
    const scoreB = (b.metrics.avgRecallAtK ?? 0) + (b.metrics.avgMRR ?? 0) + (b.metrics.avgNDCG ?? 0);
    return scoreB - scoreA;
  });

  const headers = ["Rank", "Configuration", "Composite Score", "Recall@K", "MRR", "nDCG"];
  const rows = sorted.map((r, i) => {
    const score = (r.metrics.avgRecallAtK ?? 0) + (r.metrics.avgMRR ?? 0) + (r.metrics.avgNDCG ?? 0);
    return [
      `#${i + 1}`,
      r.label,
      score.toFixed(4),
      (r.metrics.avgRecallAtK ?? 0).toFixed(4),
      (r.metrics.avgMRR ?? 0).toFixed(4),
      (r.metrics.avgNDCG ?? 0).toFixed(4),
    ];
  });

  return {
    title: "Ranking & Leaderboard",
    content: "Configurations ranked by composite score (Recall@K + MRR + nDCG).",
    tables: [{ caption: "Final Rankings", headers, rows }],
  };
}

function generateDiscussionSection(summary: {
  bestOverall: string;
  keyFindings: string[];
  recommendations: string[];
}): ReportSection {
  const content = [
    "## Key Findings",
    "",
    ...summary.keyFindings.map((f) => `- ${f}`),
    "",
    "## Interpretation",
    "",
    "The evaluation reveals important tradeoffs between retrieval quality, latency, and computational cost. ",
    "Configurations that prioritize recall tend to include more noise (lower precision), while precision-focused ",
    "configurations may miss relevant information. The optimal choice depends on the specific use case:",
    "",
    "- **Question Answering:** Prioritize MRR and Precision@K for concise, accurate answers",
    "- **Research/Exploration:** Prioritize Recall@K to capture all relevant information",
    "- **Real-time Applications:** Prioritize low latency, potentially sacrificing some accuracy",
    "",
  ];

  return {
    title: "Discussion",
    content: content.join("\n"),
  };
}

function generateConclusionSection(summary: {
  bestOverall: string;
  recommendations: string[];
}): ReportSection {
  const content = [
    `Based on the evaluation, **${summary.bestOverall}** achieves the best overall performance across the tested configurations.`,
    "",
    "## Recommendations",
    "",
    ...summary.recommendations.map((r) => `- ${r}`),
    "",
  ];

  return {
    title: "Conclusion & Recommendations",
    content: content.join("\n"),
  };
}

function generateFutureWorkSection(): ReportSection {
  const content = [
    "Future work that could extend this evaluation:",
    "",
    "- **Cross-Encoder Reranking:** Integrate a dedicated cross-encoder model for more accurate relevance scoring",
    "- **LLM-as-Judge Evaluation:** Use an LLM to evaluate answer quality, faithfulness, and coherence",
    "- **Multi-Hop Retrieval:** Implement recursive retrieval for complex questions requiring multiple reasoning steps",
    "- **Adaptive Retrieval:** Adjust top-K and similarity threshold dynamically based on query type",
    "- **Diverse Embedding Models:** Compare additional embedding providers (Cohere, Voyage, etc.)",
    "- **Cost Analysis:** Include token usage and API cost as evaluation metrics",
    "- **A/B Testing Framework:** Run live A/B tests in production to validate offline benchmark results",
    "",
  ];

  return {
    title: "Future Work",
    content: content.join("\n"),
  };
}

function renderMarkdown(
  config: ReportConfig,
  metadata: { title: string; generatedAt: string; version: string },
  dataset: ReportDatasetInfo,
  sections: ReportSection[],
  summary: { keyFindings: string[]; recommendations: string[]; bestOverall: string; totalExperiments: number; topMetrics: Record<string, string> },
): string {
  const lines: string[] = [];

  lines.push(`# ${config.title}`, "");
  lines.push(`**Generated:** ${new Date(metadata.generatedAt).toLocaleString()}  `);
  lines.push(`**Version:** ${metadata.version}  `);
  if (config.author) lines.push(`**Author:** ${config.author}  `);
  lines.push("", "---", "");

  lines.push("## Executive Summary", "");
  lines.push(`- **Dataset:** ${dataset.name} (${dataset.questionCount} questions)`);
  lines.push(`- **Configurations Tested:** ${summary.totalExperiments}`);
  lines.push(`- **Best Overall:** ${summary.bestOverall}`);
  lines.push("", "### Key Findings", "");
  for (const f of summary.keyFindings) {
    lines.push(`- ${f}`);
  }
  lines.push("", "### Recommendations", "");
  for (const r of summary.recommendations) {
    lines.push(`- ${r}`);
  }
  lines.push("", "---", "");

  for (const section of sections) {
    lines.push(`## ${section.title}`, "");
    lines.push(section.content, "");

    if (section.tables) {
      for (const table of section.tables) {
        lines.push(`**${table.caption}**`, "");
        lines.push(`| ${table.headers.join(" | ")} |`);
        lines.push(`| ${table.headers.map(() => "---").join(" | ")} |`);
        for (const row of table.rows) {
          lines.push(`| ${row.join(" | ")} |`);
        }
        lines.push("");
      }
    }

    if (section.charts) {
      lines.push("### Charts", "");
      for (const chart of section.charts) {
        lines.push(`**${chart.title}** (${chart.type})`, "");
        lines.push("| Label | Value |");
        lines.push("| --- | --- |");
        for (const d of chart.data) {
          lines.push(`| ${d.label} | ${d.value.toFixed(4)} |`);
        }
        lines.push("");
      }
    }

    lines.push("---", "");
  }

  const footer = [
    "---",
    "",
    `_Report generated by Kairos Evaluation Framework v${metadata.version}_`,
    `_Dataset: ${dataset.name}_`,
    `_${dataset.questionCount} questions evaluated_`,
    "",
  ];
  lines.push(...footer);

  return lines.join("\n");
}

function formatStat(value: number | undefined): string {
  if (value == null) return "—";
  return value.toFixed(4);
}
