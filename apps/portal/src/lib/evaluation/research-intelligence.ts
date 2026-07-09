

export interface IntelligenceRun {
  id: string;
  name: string | null;
  aggregatedMetrics: Record<string, number> | null;
  createdAt: Date;
  datasetName: string;
  questionCount: number;
  results: Array<{
    retrievalMetrics: Record<string, number> | null;
    generationMetrics: Record<string, number> | null;
    latencySearchMs: number | null;
  }>;
}

export interface ResearchFinding {
  id: string;
  type: "correlation" | "tradeoff" | "trend" | "pattern" | "anomaly" | "insight";
  severity: "critical" | "high" | "medium" | "low";
  title: string;
  observation: string;
  metrics: string[];
  evidence: string[];
  interpretation: string;
  confidence: number;
}

export interface TrendAnalysis {
  metric: string;
  direction: "improving" | "declining" | "stable" | "volatile";
  slope: number;
  rSquared: number;
  description: string;
}

export interface RootCause {
  issue: string;
  affectedMetric: string;
  possibleCauses: string[];
  evidence: string[];
  recommendation: string;
}

export interface ExperimentSuggestion {
  title: string;
  rationale: string;
  expectedImpact: string;
  priority: "high" | "medium" | "low";
  parameters: string[];
}

export interface IntelligenceResult {
  findings: ResearchFinding[];
  trends: TrendAnalysis[];
  rootCauses: RootCause[];
  experimentSuggestions: ExperimentSuggestion[];
  metricSummary: Record<string, { mean: number; std: number; min: number; max: number }>;
}

const RELEVANT_METRICS = [
  "recallAtK", "precisionAtK", "mrr", "ndcg", "hitRate",
  "faithfulness", "answerRelevancy", "contextPrecision",
  "contextRecall", "answerCorrectness",
];

const METRIC_LABELS: Record<string, string> = {
  recallAtK: "Recall@K",
  precisionAtK: "Precision@K",
  mrr: "MRR",
  ndcg: "nDCG",
  hitRate: "Hit Rate",
  faithfulness: "Faithfulness",
  answerRelevancy: "Answer Relevancy",
  contextPrecision: "Context Precision",
  contextRecall: "Context Recall",
  answerCorrectness: "Answer Correctness",
};

export function analyzeResearchIntelligence(runs: IntelligenceRun[]): IntelligenceResult {
  if (runs.length === 0) {
    return {
      findings: [],
      trends: [],
      rootCauses: [],
      experimentSuggestions: [],
      metricSummary: {},
    };
  }

  const metricSummary = computeMetricSummary(runs);
  const perQueryData = extractPerQueryData(runs);
  const findings: ResearchFinding[] = [];

  findings.push(...discoverCorrelations(perQueryData, runs));
  findings.push(...discoverTradeoffs(perQueryData, runs));
  findings.push(...discoverPatterns(perQueryData, runs));
  findings.push(...discoverAnomalies(perQueryData, runs));

  const trends = detectTrends(runs);
  findings.push(...trendsToFindings(trends, runs));

  const rootCauses = inferRootCauses(perQueryData, runs, metricSummary);
  findings.push(...rootCausesToFindings(rootCauses, runs));

  const insights = extractInsights(runs, metricSummary, perQueryData);
  findings.push(...insights);

  const experimentSuggestions = suggestExperiments(runs, metricSummary, findings);

  return {
    findings: findings.sort((a, b) => severityWeight(b.severity) - severityWeight(a.severity)),
    trends,
    rootCauses,
    experimentSuggestions,
    metricSummary,
  };
}

function computeMetricSummary(runs: IntelligenceRun[]): Record<string, { mean: number; std: number; min: number; max: number }> {
  const summary: Record<string, { mean: number; std: number; min: number; max: number }> = {};
  const allMetrics = new Set<string>();

  for (const run of runs) {
    if (run.aggregatedMetrics) {
      for (const key of Object.keys(run.aggregatedMetrics)) {
        allMetrics.add(key);
      }
    }
  }

  for (const metric of allMetrics) {
    const values = runs
      .map((r) => r.aggregatedMetrics?.[metric])
      .filter((v): v is number => typeof v === "number");

    if (values.length === 0) continue;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.length > 1
      ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1)
      : 0;

    summary[metric] = {
      mean: Math.round(mean * 10000) / 10000,
      std: Math.round(Math.sqrt(variance) * 10000) / 10000,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  return summary;
}

function extractPerQueryData(runs: IntelligenceRun[]): Map<string, Map<string, number[]>> {
  const data = new Map<string, Map<string, number[]>>();

  for (const run of runs) {
    const runData = new Map<string, number[]>();
    for (const result of run.results) {
      const metrics = result.retrievalMetrics ?? {};
      for (const [key, val] of Object.entries(metrics)) {
        if (typeof val === "number") {
          if (!runData.has(key)) runData.set(key, []);
          runData.get(key)!.push(val);
        }
      }
    }
    data.set(run.id, runData);
  }

  return data;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);

  const meanX = xSlice.reduce((s, v) => s + v, 0) / n;
  const meanY = ySlice.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = xSlice[i] - meanX;
    const dy = ySlice[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  if (denom === 0) return 0;
  return numerator / denom;
}

function discoverCorrelations(
  perQueryData: Map<string, Map<string, number[]>>,
  runs: IntelligenceRun[],
): ResearchFinding[] {
  const findings: ResearchFinding[] = [];

  const aggregatedPairs = new Map<string, Array<{ x: number; y: number }>>();
  for (const run of runs) {
    if (!run.aggregatedMetrics) continue;
    const keys = Object.keys(run.aggregatedMetrics);
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        const pairKey = `${keys[i]}|${keys[j]}`;
        if (!aggregatedPairs.has(pairKey)) aggregatedPairs.set(pairKey, []);
        aggregatedPairs.get(pairKey)!.push({
          x: run.aggregatedMetrics[keys[i]],
          y: run.aggregatedMetrics[keys[j]],
        });
      }
    }
  }

  for (const [pairKey, points] of aggregatedPairs) {
    if (points.length < 3) continue;
    const [metricA, metricB] = pairKey.split("|");
    const xVals = points.map((p) => p.x);
    const yVals = points.map((p) => p.y);
    const r = pearsonCorrelation(xVals, yVals);

    if (Math.abs(r) >= 0.7) {
      const labelA = METRIC_LABELS[metricA] ?? metricA;
      const labelB = METRIC_LABELS[metricB] ?? metricB;
      findings.push({
        id: `corr-${metricA}-${metricB}`,
        type: "correlation",
        severity: Math.abs(r) >= 0.9 ? "high" : "medium",
        title: `Strong ${r > 0 ? "positive" : "negative"} correlation: ${labelA} vs ${labelB}`,
        observation: `${labelA} and ${labelB} show a ${r > 0 ? "positive" : "negative"} correlation (r = ${r.toFixed(3)}) across ${points.length} configurations.`,
        metrics: [metricA, metricB],
        evidence: [
          `Pearson r = ${r.toFixed(3)} across ${points.length} data points`,
          `${labelA} range: ${Math.min(...xVals).toFixed(4)}–${Math.max(...xVals).toFixed(4)}`,
          `${labelB} range: ${Math.min(...yVals).toFixed(4)}–${Math.max(...yVals).toFixed(4)}`,
        ],
        interpretation: r > 0
          ? `Increasing ${labelA} tends to increase ${labelB}. These metrics reinforce each other.`
          : `Increasing ${labelA} tends to decrease ${labelB}. Optimizing one may degrade the other.`,
        confidence: Math.min(Math.abs(r), 1),
      });
    }
  }

  return findings;
}

function discoverTradeoffs(
  perQueryData: Map<string, Map<string, number[]>>,
  runs: IntelligenceRun[],
): ResearchFinding[] {
  const findings: ResearchFinding[] = [];

  for (const run of runs) {
    const rm = run.results[0]?.retrievalMetrics;
    if (!rm) continue;
  }

  const recallValues: number[] = [];
  const precisionValues: number[] = [];
  for (const run of runs) {
    if (run.aggregatedMetrics) {
      if (typeof run.aggregatedMetrics.avgRecallAtK === "number") recallValues.push(run.aggregatedMetrics.avgRecallAtK);
      if (typeof run.aggregatedMetrics.avgPrecisionAtK === "number") precisionValues.push(run.aggregatedMetrics.avgPrecisionAtK);
    }
  }

  if (recallValues.length >= 3 && precisionValues.length >= 3) {
    const r = pearsonCorrelation(recallValues, precisionValues);
    if (r < -0.5) {
      findings.push({
        id: "tradeoff-recall-precision",
        type: "tradeoff",
        severity: r < -0.7 ? "high" : "medium",
        title: "Recall-Precision Tradeoff Detected",
        observation: `Higher recall configurations tend to have lower precision (r = ${r.toFixed(3)}).`,
        metrics: ["recallAtK", "precisionAtK"],
        evidence: [
          `Correlation: r = ${r.toFixed(3)}`,
          `Recall range: ${Math.min(...recallValues).toFixed(4)}–${Math.max(...recallValues).toFixed(4)}`,
          `Precision range: ${Math.min(...precisionValues).toFixed(4)}–${Math.max(...precisionValues).toFixed(4)}`,
        ],
        interpretation: "Configurations optimized for recall retrieve more documents but include more irrelevant results. Consider a reranking step or adjusting top-K to balance retrieval quality.",
        confidence: Math.min(Math.abs(r), 1),
      });
    }
  }

  return findings;
}

function discoverPatterns(
  perQueryData: Map<string, Map<string, number[]>>,
  runs: IntelligenceRun[],
): ResearchFinding[] {
  const findings: ResearchFinding[] = [];

  if (runs.length < 3) return findings;

  const metricVariability: Array<{ metric: string; cv: number; mean: number }> = [];

  for (const metric of RELEVANT_METRICS) {
    const values = runs
      .map((r) => r.aggregatedMetrics?.[`avg${metric.charAt(0).toUpperCase()}${metric.slice(1)}`] ?? r.aggregatedMetrics?.[metric])
      .filter((v): v is number => typeof v === "number");

    if (values.length < 3) continue;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
    const cv = mean > 0 ? std / mean : 0;

    metricVariability.push({ metric, cv, mean });
  }

  if (metricVariability.length > 0) {
    const mostVariable = metricVariability.reduce((a, b) => b.cv > a.cv ? b : a);
    const mostStable = metricVariability.reduce((a, b) => b.cv < a.cv ? b : a);

    if (mostVariable.cv > 0.2) {
      findings.push({
        id: "pattern-high-variability",
        type: "pattern",
        severity: "medium",
        title: `High Variability: ${METRIC_LABELS[mostVariable.metric] ?? mostVariable.metric}`,
        observation: `${METRIC_LABELS[mostVariable.metric] ?? mostVariable.metric} varies significantly across configurations (CV = ${(mostVariable.cv * 100).toFixed(1)}%).`,
        metrics: [mostVariable.metric],
        evidence: [
          `Coefficient of variation: ${(mostVariable.cv * 100).toFixed(1)}%`,
          `Mean: ${mostVariable.mean.toFixed(4)}`,
          `This metric is highly sensitive to configuration changes.`,
        ],
        interpretation: `${METRIC_LABELS[mostVariable.metric] ?? mostVariable.metric} is the most sensitive metric to configuration changes. Small adjustments to your pipeline may have large effects on this metric.`,
        confidence: 0.8,
      });
    }

    if (mostStable.cv < 0.05 && metricVariability.length > 1) {
      findings.push({
        id: "pattern-low-variability",
        type: "pattern",
        severity: "low",
        title: `Stable Metric: ${METRIC_LABELS[mostStable.metric] ?? mostStable.metric}`,
        observation: `${METRIC_LABELS[mostStable.metric] ?? mostStable.metric} is relatively stable across configurations (CV = ${(mostStable.cv * 100).toFixed(1)}%).`,
        metrics: [mostStable.metric],
        evidence: [
          `Coefficient of variation: ${(mostStable.cv * 100).toFixed(1)}%`,
          `Mean: ${mostStable.mean.toFixed(4)}`,
        ],
        interpretation: `This metric is robust to configuration changes, suggesting it measures a fundamental property of the retrieval system rather than configuration-dependent behavior.`,
        confidence: 0.7,
      });
    }
  }

  return findings;
}

function discoverAnomalies(
  perQueryData: Map<string, Map<string, number[]>>,
  runs: IntelligenceRun[],
): ResearchFinding[] {
  const findings: ResearchFinding[] = [];

  for (const run of runs) {
    if (!run.aggregatedMetrics) continue;

    const latency = run.aggregatedMetrics.avgLatencyMs;
    if (typeof latency !== "number") continue;

    const allLatencies = runs
      .map((r) => r.aggregatedMetrics?.avgLatencyMs)
      .filter((v): v is number => typeof v === "number");

    if (allLatencies.length < 3) continue;

    const mean = allLatencies.reduce((s, v) => s + v, 0) / allLatencies.length;
    const std = Math.sqrt(allLatencies.reduce((s, v) => s + (v - mean) ** 2, 0) / allLatencies.length);

    if (std > 0 && Math.abs(latency - mean) > 2 * std) {
      findings.push({
        id: `anomaly-latency-${run.id}`,
        type: "anomaly",
        severity: "medium",
        title: `Latency Anomaly: ${run.name || "Unnamed"}`,
        observation: `${run.name || "Unnamed"} has unusual latency (${latency.toFixed(0)}ms vs mean ${mean.toFixed(0)}ms).`,
        metrics: ["latency"],
        evidence: [
          `Observed: ${latency.toFixed(0)}ms`,
          `Mean: ${mean.toFixed(0)}ms`,
          `Standard deviation: ${std.toFixed(0)}ms`,
          `Z-score: ${((latency - mean) / std).toFixed(2)}`,
        ],
        interpretation: `This configuration's latency is ${((latency - mean) / std).toFixed(1)} standard deviations from the mean. Investigate the retrieval pipeline or embedding model for potential bottlenecks.`,
        confidence: 0.75,
      });
    }
  }

  return findings;
}

function detectTrends(runs: IntelligenceRun[]): TrendAnalysis[] {
  const trends: TrendAnalysis[] = [];

  if (runs.length < 3) return trends;

  const sorted = [...runs].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  for (const metric of RELEVANT_METRICS) {
    const avgKey = `avg${metric.charAt(0).toUpperCase()}${metric.slice(1)}`;
    const values = sorted
      .map((r, i) => ({ x: i, y: r.aggregatedMetrics?.[avgKey] ?? r.aggregatedMetrics?.[metric] }))
      .filter((v): v is { x: number; y: number } => typeof v.y === "number");

    if (values.length < 3) continue;

    const result = linearRegression(values.map((v) => v.x), values.map((v) => v.y));

    let direction: TrendAnalysis["direction"] = "stable";
    if (Math.abs(result.slope) > 0.01 && result.rSquared > 0.3) {
      direction = result.slope > 0 ? "improving" : "declining";
    } else if (result.rSquared < 0.3) {
      const variance = values.map((v) => v.y);
      const mean = variance.reduce((s, v) => s + v, 0) / variance.length;
      const cv = mean > 0 ? Math.sqrt(variance.reduce((s, v) => s + (v - mean) ** 2, 0) / variance.length) / mean : 0;
      if (cv > 0.15) direction = "volatile";
    }

    if (direction !== "stable") {
      trends.push({
        metric,
        direction,
        slope: result.slope,
        rSquared: result.rSquared,
        description: `${METRIC_LABELS[metric] ?? metric} is ${direction} over time (slope = ${result.slope.toFixed(4)}, R² = ${result.rSquared.toFixed(3)}).`,
      });
    }
  }

  return trends;
}

function linearRegression(x: number[], y: number[]): { slope: number; intercept: number; rSquared: number } {
  const n = x.length;
  if (n < 2) return { slope: 0, intercept: 0, rSquared: 0 };

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denominator += dx * dx;
  }

  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = meanY - slope * meanX;

  const yHat = x.map((xi) => slope * xi + intercept);
  const ssRes = y.reduce((s, yi, i) => s + (yi - yHat[i]) ** 2, 0);
  const ssTot = y.reduce((s, yi) => s + (yi - meanY) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, rSquared };
}

function trendsToFindings(trends: TrendAnalysis[], runs: IntelligenceRun[]): ResearchFinding[] {
  return trends.map((t) => ({
    id: `trend-${t.metric}-${t.direction}`,
    type: "trend" as const,
    severity: (t.direction === "declining" ? "high" : t.direction === "volatile" ? "medium" : "low") as ResearchFinding["severity"],
    title: `${METRIC_LABELS[t.metric] ?? t.metric}: ${t.direction.charAt(0).toUpperCase() + t.direction.slice(1)} Trend`,
    observation: t.description,
    metrics: [t.metric],
    evidence: [
      `Slope: ${t.slope.toFixed(6)}`,
      `R²: ${t.rSquared.toFixed(3)}`,
      `Data points: ${runs.length}`,
    ],
    interpretation: t.direction === "declining"
      ? `Performance on ${METRIC_LABELS[t.metric] ?? t.metric} has been degrading. Investigate recent configuration changes or data quality issues.`
      : t.direction === "volatile"
        ? `${METRIC_LABELS[t.metric] ?? t.metric} shows high variance. The system may be sensitive to specific data distributions.`
        : `${METRIC_LABELS[t.metric] ?? t.metric} is improving. Current changes appear beneficial.`,
    confidence: t.rSquared,
  }));
}

function inferRootCauses(
  perQueryData: Map<string, Map<string, number[]>>,
  runs: IntelligenceRun[],
  metricSummary: Record<string, { mean: number; std: number; min: number; max: number }>,
): RootCause[] {
  const causes: RootCause[] = [];

  const recallStats = metricSummary.avgRecallAtK;
  if (recallStats && recallStats.mean < 0.5) {
    causes.push({
      issue: "Low average recall across configurations",
      affectedMetric: "recallAtK",
      possibleCauses: [
        "Top-K may be too small to capture all relevant documents",
        "Embedding model may not capture semantic similarity well for this domain",
        "Chunking strategy may split relevant information across multiple chunks",
        "Similarity threshold may be too aggressive",
      ],
      evidence: [
        `Average recall: ${recallStats.mean.toFixed(4)}`,
        `Standard deviation: ${recallStats.std.toFixed(4)}`,
        `Range: ${recallStats.min.toFixed(4)}–${recallStats.max.toFixed(4)}`,
      ],
      recommendation: "Increase top-K, experiment with different embedding models, or try larger chunk sizes.",
    });
  }

  const precisionStats = metricSummary.avgPrecisionAtK;
  if (precisionStats && precisionStats.mean < 0.3) {
    causes.push({
      issue: "Low average precision across configurations",
      affectedMetric: "precisionAtK",
      possibleCauses: [
        "Top-K is too large, retrieving too many documents",
        "Knowledge base contains many semantically similar but irrelevant documents",
        "Embedding model lacks discriminative power for fine-grained distinctions",
      ],
      evidence: [
        `Average precision: ${precisionStats.mean.toFixed(4)}`,
        `Standard deviation: ${precisionStats.std.toFixed(4)}`,
      ],
      recommendation: "Decrease top-K, implement reranking, or improve document quality in the knowledge base.",
    });
  }

  const ndcgStats = metricSummary.avgNDCG;
  if (ndcgStats && ndcgStats.mean < 0.4 && recallStats && recallStats.mean > 0.6) {
    causes.push({
      issue: "High recall but low nDCG: results are not well-ranked",
      affectedMetric: "ndcg",
      possibleCauses: [
        "Retrieved documents are relevant but appear at lower ranks",
        "No reranking step to improve ordering of retrieved results",
        "Dense retrieval may not capture fine-grained relevance differences",
      ],
      evidence: [
        `Average recall: ${recallStats.mean.toFixed(4)}`,
        `Average nDCG: ${ndcgStats.mean.toFixed(4)}`,
        `The gap suggests relevance is captured but ordering is suboptimal.`,
      ],
      recommendation: "Add a cross-encoder reranking step to improve the ordering of retrieved documents.",
    });
  }

  const latencyStats = metricSummary.avgLatencyMs;
  if (latencyStats && latencyStats.mean > 2000) {
    causes.push({
      issue: "High average latency",
      affectedMetric: "latency",
      possibleCauses: [
        "Large top-K increases retrieval and reranking time",
        "Embedding model is computationally expensive",
        "Chunk count is very large, slowing vector search",
      ],
      evidence: [
        `Average latency: ${latencyStats.mean.toFixed(0)}ms`,
        `Range: ${latencyStats.min.toFixed(0)}–${latencyStats.max.toFixed(0)}ms`,
      ],
      recommendation: "Reduce top-K, use a smaller embedding model, or implement indexing optimizations.",
    });
  }

  return causes;
}

function rootCausesToFindings(rootCauses: RootCause[], _runs: IntelligenceRun[]): ResearchFinding[] {
  return rootCauses.map((rc) => ({
    id: `root-${rc.affectedMetric}`,
    type: "insight" as const,
    severity: "high" as const,
    title: `Root Cause: ${rc.issue}`,
    observation: rc.possibleCauses[0] ?? rc.issue,
    metrics: [rc.affectedMetric],
    evidence: rc.evidence,
    interpretation: rc.recommendation,
    confidence: 0.7,
  }));
}

function extractInsights(
  runs: IntelligenceRun[],
  _metricSummary: Record<string, { mean: number; std: number; min: number; max: number }>,
  _perQueryData: Map<string, Map<string, number[]>>,
): ResearchFinding[] {
  const findings: ResearchFinding[] = [];

  if (runs.length >= 2) {
    const sorted = [...runs].sort((a, b) => {
      const scoreA = (a.aggregatedMetrics?.avgRecallAtK ?? 0) + (a.aggregatedMetrics?.avgMRR ?? 0);
      const scoreB = (b.aggregatedMetrics?.avgRecallAtK ?? 0) + (b.aggregatedMetrics?.avgMRR ?? 0);
      return scoreB - scoreA;
    });

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    if (best.aggregatedMetrics && worst.aggregatedMetrics) {
      const recallDiff = (best.aggregatedMetrics.avgRecallAtK ?? 0) - (worst.aggregatedMetrics.avgRecallAtK ?? 0);
      if (recallDiff > 0.1) {
        findings.push({
          id: "insight-best-vs-worst",
          type: "insight",
          severity: "high",
          title: "Significant Performance Gap Between Configurations",
          observation: `Best (${best.name || "Unnamed"}) outperforms worst (${worst.name || "Unnamed"}) by ${(recallDiff * 100).toFixed(1)}% on recall.`,
          metrics: ["recallAtK"],
          evidence: [
            `Best recall: ${(best.aggregatedMetrics.avgRecallAtK ?? 0).toFixed(4)}`,
            `Worst recall: ${(worst.aggregatedMetrics.avgRecallAtK ?? 0).toFixed(4)}`,
            `Gap: ${recallDiff.toFixed(4)}`,
          ],
          interpretation: "There is substantial room for improvement through configuration optimization. The performance gap indicates that configuration choices matter significantly.",
          confidence: 0.9,
        });
      }
    }
  }

  return findings;
}

function suggestExperiments(
  runs: IntelligenceRun[],
  metricSummary: Record<string, { mean: number; std: number; min: number; max: number }>,
  findings: ResearchFinding[],
): ExperimentSuggestion[] {
  const suggestions: ExperimentSuggestion[] = [];

  const tradeoffFindings = findings.filter((f) => f.type === "tradeoff");
  for (const f of tradeoffFindings) {
    suggestions.push({
      title: `Resolve ${f.metrics.join("-")} tradeoff`,
      rationale: f.observation,
      expectedImpact: "Find configurations that balance both metrics without sacrificing either.",
      priority: f.severity === "high" ? "high" : "medium",
      parameters: ["topK", "similarityThreshold", "reranking"],
    });
  }

  const recallStats = metricSummary.avgRecallAtK;
  if (recallStats && recallStats.mean < 0.6) {
    suggestions.push({
      title: "Improve recall with larger top-K",
      rationale: `Average recall is ${recallStats.mean.toFixed(4)}, suggesting documents are missed.`,
      expectedImpact: "Increasing top-K should improve recall at the cost of precision.",
      priority: "high",
      parameters: ["topK"],
    });
  }

  const latencyStats = metricSummary.avgLatencyMs;
  if (latencyStats && latencyStats.mean > 1500) {
    suggestions.push({
      title: "Optimize latency with smaller chunks or model",
      rationale: `Average latency is ${latencyStats.mean.toFixed(0)}ms.`,
      expectedImpact: "Reducing chunk size or using a faster embedding model could decrease latency.",
      priority: "medium",
      parameters: ["chunkSize", "embeddingModel"],
    });
  }

  if (runs.length < 5) {
    suggestions.push({
      title: "Run more experiments for statistical power",
      rationale: `Only ${runs.length} configurations tested. More data improves pattern detection.`,
      expectedImpact: "More experiments will enable stronger statistical conclusions.",
      priority: "medium",
      parameters: ["varied"],
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: "Explore cross-encoder reranking",
      rationale: "All configurations have been tested without reranking.",
      expectedImpact: "Cross-encoder reranking could improve nDCG and precision.",
      priority: "low",
      parameters: ["reranking", "rerankerModel"],
    });
  }

  return suggestions;
}

function severityWeight(severity: ResearchFinding["severity"]): number {
  switch (severity) {
    case "critical": return 4;
    case "high": return 3;
    case "medium": return 2;
    case "low": return 1;
  }
}

export function getMetricLabel(key: string): string {
  return METRIC_LABELS[key] ?? key;
}
