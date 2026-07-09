import type { DescriptiveStats } from "./statistics";
import { compareMetrics, type ComparisonResult as SignificanceComparison } from "./significance";
import type { IntelligenceResult } from "./research-intelligence";
import { getMetricLabel } from "./research-intelligence";

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
  perQueryMetrics?: Record<string, number[]>;
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
  intelligenceResult?: IntelligenceResult,
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
    generateResearchFindingsSection(intelligenceResult),
    generateDiscussionSection(summary, intelligenceResult),
    generateThreatsToValiditySection(strategyResults, dataset),
    generateConclusionSection(summary),
    generateFutureWorkSection(intelligenceResult),
    generateReproducibilitySection(),
    generateProvenanceSection(),
    generateCitationSection(),
    generateNextExperimentsSection(),
    generateCoverageAnalysisSection(),
    generateResearchRoadmapSection(),
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
    json: JSON.stringify({
      metadata,
      config,
      dataset,
      results: strategyResults,
      sections,
      summary,
      statisticalAnalysis: {
        hasPerQueryData: strategyResults.every((r) => r.perQueryMetrics && Object.keys(r.perQueryMetrics).length > 0),
        sampleSize: strategyResults[0]?.perQueryMetrics?.recallAtK?.length ?? 0,
        significanceLevel: 0.05,
        testMethods: ["Paired t-test (normal differences)", "Wilcoxon signed-rank (non-normal differences)"],
      },
    }, null, 2),
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

  const sorted = [...results].sort((a, b) => (b.metrics.avgRecallAtK ?? 0) - (a.metrics.avgRecallAtK ?? 0));
  const best = sorted[0];

  const hasPerQuery = sorted.every((r) => r.perQueryMetrics && Object.keys(r.perQueryMetrics).length > 0);

  if (!hasPerQuery) {
    const content = [
      "Comparative statistical analysis between configurations. Per-query metrics are required for rigorous statistical testing.",
      "The following comparison uses aggregated means. For statistically valid conclusions, ensure per-query metrics are stored.",
      "",
    ];

    const tables: ReportTable[] = [];
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

  const content = [
    "Rigorous statistical comparison between configurations using per-query metrics.",
    "Tests are automatically selected based on normality of differences (paired t-test for normal, Wilcoxon signed-rank for non-normal).",
    "All comparisons use a significance level of α = 0.05.",
    "",
  ];

  const metricKeys = ["recallAtK", "precisionAtK", "mrr", "ndcg", "hitRate"];
  const tables: ReportTable[] = [];

  for (let i = 1; i < sorted.length; i++) {
    const other = sorted[i];

    const statResults: SignificanceComparison[] = [];
    for (const key of metricKeys) {
      const baselineValues = other.perQueryMetrics?.[key] ?? [];
      const treatmentValues = best.perQueryMetrics?.[key] ?? [];
      if (baselineValues.length >= 2 && treatmentValues.length >= 2) {
        try {
          const result = compareMetrics(baselineValues, treatmentValues, key, other.label, best.label);
          statResults.push(result);
        } catch {
          // skip if comparison fails
        }
      }
    }

    if (statResults.length === 0) continue;

    const headers = ["Metric", "Test Used", "p-value", "Effect Size", "95% CI", "Significant?", "Interpretation"];
    const rows = statResults.map((r) => [
      r.metricName,
      r.significance.testUsed,
      r.significance.pValue.toFixed(4),
      `${r.effectSize.value.toFixed(3)} (${r.effectSize.magnitude})`,
      `[${r.bootstrapCI.ciLower.toFixed(4)}, ${r.bootstrapCI.ciUpper.toFixed(4)}]`,
      r.significance.significant ? "Yes" : "No",
      r.interpretation,
    ]);

    tables.push({
      caption: `${other.label} vs ${best.label} — Statistical Comparison`,
      headers,
      rows,
    });
  }

  const sigCount = tables.reduce((s, t) => s + t.rows.filter((r) => r[5] === "Yes").length, 0);
  const totalCount = tables.reduce((s, t) => s + t.rows.length, 0);

  content.push(`**Summary:** ${sigCount} of ${totalCount} metric comparisons are statistically significant at α = 0.05.`);
  content.push("");

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
}, intelligenceResult?: IntelligenceResult): ReportSection {
  const lines: string[] = [
    "## Key Findings",
    "",
    ...summary.keyFindings.map((f) => `- ${f}`),
    "",
  ];

  if (intelligenceResult && intelligenceResult.trends.length > 0) {
    lines.push("## Temporal Trends", "");
    for (const trend of intelligenceResult.trends) {
      lines.push(`- ${getMetricLabel(trend.metric)}: ${trend.description}`);
    }
    lines.push("");
  }

  if (intelligenceResult && intelligenceResult.rootCauses.length > 0) {
    lines.push("## Identified Issues", "");
    for (const rc of intelligenceResult.rootCauses) {
      lines.push(`- **${rc.issue}**: ${rc.recommendation}`);
    }
    lines.push("");
  }

  lines.push(
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
  );

  return {
    title: "Discussion",
    content: lines.join("\n"),
  };
}

function generateResearchFindingsSection(intelligenceResult?: IntelligenceResult): ReportSection {
  if (!intelligenceResult || intelligenceResult.findings.length === 0) {
    return {
      title: "Research Findings",
      content: "No automated findings detected. Run more experiments to enable pattern analysis.",
    };
  }

  const lines: string[] = [
    "Automated analysis of benchmark results identified the following research findings:",
    "",
  ];

  const byType = new Map<string, typeof intelligenceResult.findings>();
  for (const finding of intelligenceResult.findings) {
    const group = byType.get(finding.type) ?? [];
    group.push(finding);
    byType.set(finding.type, group);
  }

  const typeLabels: Record<string, string> = {
    correlation: "Correlations",
    tradeoff: "Tradeoffs",
    trend: "Trends",
    pattern: "Patterns",
    anomaly: "Anomalies",
    insight: "Insights",
  };

  for (const [type, findings] of byType) {
    lines.push(`### ${typeLabels[type] ?? type}`, "");
    for (const f of findings) {
      lines.push(`**${f.title}** (${f.severity} severity)`);
      lines.push(`- Observation: ${f.observation}`);
      lines.push(`- Evidence: ${f.evidence.join("; ")}`);
      lines.push(`- Interpretation: ${f.interpretation}`);
      lines.push("");
    }
  }

  if (intelligenceResult.metricSummary && Object.keys(intelligenceResult.metricSummary).length > 0) {
    lines.push("### Metric Summary", "");
    const headers = ["Metric", "Mean", "Std Dev", "Min", "Max"];
    const rows = Object.entries(intelligenceResult.metricSummary).map(([key, stats]) => [
      getMetricLabel(key),
      stats.mean.toFixed(4),
      stats.std.toFixed(4),
      stats.min.toFixed(4),
      stats.max.toFixed(4),
    ]);

    lines.push(`| ${headers.join(" | ")} |`);
    lines.push(`| ${headers.map(() => "---").join(" | ")} |`);
    for (const row of rows) {
      lines.push(`| ${row.join(" | ")} |`);
    }
    lines.push("");
  }

  return {
    title: "Research Findings",
    content: lines.join("\n"),
  };
}

function generateThreatsToValiditySection(
  results: ReportStrategyResult[],
  dataset: ReportDatasetInfo,
): ReportSection {
  const totalQuestions = dataset.questionCount;
  const lines: string[] = [
    "This section identifies potential threats to the validity of the evaluation results.",
    "",
    "## Internal Validity",
    "",
  ];

  if (totalQuestions < 30) {
    lines.push(`- **Small sample size:** The dataset contains only ${totalQuestions} questions. Results may not generalize. Consider using datasets with 100+ questions for more reliable conclusions.`);
  } else if (totalQuestions < 100) {
    lines.push(`- **Moderate sample size:** ${totalQuestions} questions provide reasonable but not robust statistical power. Small effect sizes may be missed.`);
  } else {
    lines.push(`- **Adequate sample size:** ${totalQuestions} questions provide sufficient statistical power for most comparisons.`);
  }

  lines.push(
    "",
    "## Construct Validity",
    "",
    "- **Metric limitations:** IR metrics (Recall@K, Precision@K, nDCG) measure retrieval quality but do not capture answer quality, factual correctness, or user satisfaction.",
    "- **Aggregation effects:** Averaging across questions may mask per-question variability. Some questions may benefit from different configurations.",
    "- **Ground truth assumptions:** Relevance judgments are assumed to be binary (relevant/irrelevant). Partial relevance is not captured.",
    "",
    "## External Validity",
    "",
    `- **Domain specificity:** Results are specific to the **${dataset.name}** dataset and may not transfer to other domains or document collections.`,
    "- **Configuration scope:** Only the tested configurations are evaluated. Other parameter combinations may perform differently.",
    "- **Static evaluation:** Benchmark results reflect a point-in-time evaluation. Performance may vary as the knowledge base evolves.",
    "",
    "## Conclusion Validity",
    "",
    "- **Multiple comparisons:** Testing multiple metrics increases the chance of false positives. The analysis uses α = 0.05 without correction for multiple testing.",
    "- **Selection bias:** Configurations may not represent the full parameter space. Results should be interpreted as indicative rather than definitive.",
    "",
  );

  return {
    title: "Threats to Validity",
    content: lines.join("\n"),
  };
}

function generateFutureWorkSection(intelligenceResult?: IntelligenceResult): ReportSection {
  const lines: string[] = [
    "Future work that could extend this evaluation:",
    "",
  ];

  if (intelligenceResult && intelligenceResult.experimentSuggestions.length > 0) {
    lines.push("### Recommended Experiments (from automated analysis)", "");
    for (const sug of intelligenceResult.experimentSuggestions) {
      lines.push(`**${sug.title}** (${sug.priority} priority)`);
      lines.push(`- Rationale: ${sug.rationale}`);
      lines.push(`- Expected impact: ${sug.expectedImpact}`);
      lines.push(`- Parameters to vary: ${sug.parameters.join(", ")}`);
      lines.push("");
    }
  }

  lines.push(
    "### General Recommendations",
    "",
    "- **Cross-Encoder Reranking:** Integrate a dedicated cross-encoder model for more accurate relevance scoring",
    "- **LLM-as-Judge Evaluation:** Use an LLM to evaluate answer quality, faithfulness, and coherence",
    "- **Multi-Hop Retrieval:** Implement recursive retrieval for complex questions requiring multiple reasoning steps",
    "- **Adaptive Retrieval:** Adjust top-K and similarity threshold dynamically based on query type",
    "- **Diverse Embedding Models:** Compare additional embedding providers (Cohere, Voyage, etc.)",
    "- **Cost Analysis:** Include token usage and API cost as evaluation metrics",
    "- **A/B Testing Framework:** Run live A/B tests in production to validate offline benchmark results",
    "",
  );

  return {
    title: "Future Work",
    content: lines.join("\n"),
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

function generateReproducibilitySection(): ReportSection {
  return {
    title: "Reproducibility",
    content: `This report supports full reproducibility through experiment manifests. Each experiment configuration is captured in a structured manifest that includes:

- **Dataset**: Identifier, source, question count, and checksum for data integrity verification
- **Pipeline**: Complete configuration of chunking, embedding, retrieval, reranking, prompt, generation, and evaluation stages
- **Environment**: Runtime environment details including Kairos version, Node.js version, and platform
- **Results**: Aggregated metrics, per-question metrics, and statistical summaries

To reproduce this experiment:
1. Import the experiment manifest (available in JSON or YAML format)
2. Verify the dataset checksum matches your local copy
3. Configure the pipeline with the captured parameters
4. Run the evaluation with the same settings

The reproducibility score indicates how completely the experiment configuration was captured. Higher scores mean more complete documentation for reproduction.`,
    tables: [],
  };
}

function generateProvenanceSection(): ReportSection {
  return {
    title: "Provenance Summary",
    content: `All actions in this experiment are tracked through a provenance chain. Each step records:

- **Action**: What was performed (created, executed, evaluated, analyzed, exported)
- **Actor**: Who or what performed the action
- **Inputs**: What data was consumed
- **Outputs**: What data was produced
- **Parameters**: Configuration used for the action
- **Checksum**: Integrity verification for the record

The provenance chain ensures that every result can be traced back to its origin. Any modification to the data or configuration will be detected through checksum verification.`,
    tables: [],
  };
}

function generateCitationSection(): ReportSection {
  return {
    title: "Citation Information",
    content: `When citing results from this experiment, please use the following references:

**Kairos System**
Kairos Team. (2024). Kairos: Explainable RAG Research Workbench. GitHub Repository. https://github.com/kairos-rag/kairos

**Benchmark Dataset**
The benchmark dataset used in this experiment should be cited according to its original source.

**Embedding Model**
The embedding model used should be cited according to its original publication.

**Configuration**
When comparing configurations, cite the specific parameter settings used in this experiment.

All citations are available in BibTeX format for easy inclusion in LaTeX documents.`,
    tables: [],
  };
}

function generateNextExperimentsSection(): ReportSection {
  return {
    title: "Next Recommended Experiments",
    content: `Based on the analysis of current results and configuration coverage, the following experiments are recommended:

**Priority 1: High-Impact Exploration**
Focus on configurations that are predicted to yield the highest improvement with high confidence. These experiments target regions of the configuration space with high expected information gain.

**Priority 2: Uncertainty Reduction**
Execute experiments in areas where prediction uncertainty is highest. This reduces model uncertainty and improves future recommendation quality.

**Priority 3: Pareto-Optimal Discovery**
Explore configurations on the Pareto frontier to find optimal tradeoffs between competing objectives (e.g., accuracy vs. latency).

Each recommendation includes:
- Expected improvement percentage
- Confidence level
- Statistical basis (nearest neighbor analysis)
- Expected information gain
- Estimated cost (latency and tokens)`,
    tables: [],
  };
}

function generateCoverageAnalysisSection(): ReportSection {
  return {
    title: "Coverage Analysis",
    content: `Configuration coverage measures how much of the potential configuration space has been explored.

**Coverage Score**
The coverage score is calculated as: explored combinations / total combinations.

**Dimension Coverage**
Each configuration dimension (retrieval mode, chunk size, top-K, etc.) is analyzed independently to identify which values have been tested.

**Coverage Gaps**
Gaps are identified when:
- A dimension has less than 50% value coverage
- Numeric dimensions have large gaps between tested values
- Overall coverage is below 10%

**Research Direction**
Based on coverage analysis:
1. If coverage < 10%: Focus on broad exploration
2. If coverage 10-30%: Fill critical gaps in under-covered dimensions
3. If coverage 30-70%: Balance exploration and exploitation
4. If coverage > 70%: Focus on fine-tuning around the Pareto frontier`,
    tables: [],
  };
}

function generateResearchRoadmapSection(): ReportSection {
  return {
    title: "Research Roadmap",
    content: `This roadmap outlines the recommended research trajectory based on current results and configuration coverage.

**Phase 1: Foundation (Current)**
- Establish baseline performance with standard configurations
- Identify initial patterns and tradeoffs
- Build coverage of core configuration dimensions

**Phase 2: Exploration**
- Test under-explored configuration regions
- Validate hypotheses from Phase 1 findings
- Reduce uncertainty in high-impact areas

**Phase 3: Optimization**
- Fine-tune around Pareto-optimal configurations
- Optimize for specific deployment constraints
- Validate robustness across datasets

**Phase 4: Advanced**
- Test novel combinations not previously explored
- Investigate interactions between parameters
- Develop domain-specific configurations

**Milestones**
- 25% coverage: Initial pattern identification
- 50% coverage: Robust trend detection
- 75% coverage: Optimization-ready
- 90%+ coverage: Comprehensive understanding`,
    tables: [],
  };
}
