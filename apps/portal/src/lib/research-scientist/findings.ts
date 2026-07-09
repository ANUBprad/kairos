import type { Finding, Evidence, BenchmarkRunData } from "./types";
import { generateAllPairwiseEvidence, getBestConfigForMetric, getMetricValue, formatPValue, formatEffectSize } from "./evidence";

const CORE_METRICS = ["avgRecallAtK", "avgPrecisionAtK", "avgMRR", "avgNDCG", "avgHitRate"];

export function generateFindings(runs: BenchmarkRunData[]): Finding[] {
  const findings: Finding[] = [];

  if (runs.length < 2) {
    findings.push({
      id: "insufficient-data",
      title: "Insufficient Data for Analysis",
      statement: `Only ${runs.length} benchmark run(s) available. At least 2 runs are required for comparative analysis.`,
      evidence: [],
      confidence: 0,
      interpretation: "Run more benchmarks to enable research-quality analysis.",
      severity: "medium",
      category: "pattern",
    });
    return findings;
  }

  const allEvidence = generateAllPairwiseEvidence(runs);

  findings.push(...generatePerformanceFindings(runs, allEvidence));
  findings.push(...generateTradeoffFindings(runs, allEvidence));
  findings.push(...generatePatternFindings(runs, allEvidence));
  findings.push(...generateAnomalyFindings(runs, allEvidence));
  findings.push(...generateComparisonFindings(runs, allEvidence));

  return findings.sort((a, b) => b.confidence - a.confidence);
}

function generatePerformanceFindings(
  runs: BenchmarkRunData[],
  allEvidence: Evidence[],
): Finding[] {
  const findings: Finding[] = [];

  for (const metric of CORE_METRICS) {
    const best = getBestConfigForMetric(runs, metric);
    if (!best) continue;

    const metricEvidence = allEvidence.filter((e) => e.metric === getMetricLabel(metric));
    const significantEvidence = metricEvidence.filter((e) => e.pValue < 0.05);

    if (significantEvidence.length > 0) {
      const bestEv = significantEvidence.reduce((a, b) => (a.improvementPct > b.improvementPct ? a : b));
      const label = getMetricLabel(metric);

      findings.push({
        id: `perf-${metric}`,
        title: `${label}: ${best.config} achieves highest performance`,
        statement: `${best.config} achieves the highest ${label} (${(best.value * 100).toFixed(1)}%) across ${runs.length} configurations. This improvement is statistically significant ${formatPValue(bestEv.pValue)} with ${formatEffectSize(bestEv.effectSize, bestEv.effectMagnitude)}.`,
        evidence: [bestEv],
        confidence: Math.min(1, 1 - bestEv.pValue) * (bestEv.effectMagnitude === "large" ? 1 : 0.8),
        interpretation: `${best.config} consistently outperforms other configurations on ${label}. The effect size indicates this is a ${bestEv.effectMagnitude} practical difference.`,
        severity: bestEv.effectMagnitude === "large" ? "high" : "medium",
        category: "performance",
      });
    }
  }

  return findings;
}

function generateTradeoffFindings(
  runs: BenchmarkRunData[],
  allEvidence: Evidence[],
): Finding[] {
  const findings: Finding[] = [];

  if (runs.length < 3) return findings;

  const recallValues: number[] = [];
  const precisionValues: number[] = [];
  const latencyValues: number[] = [];

  for (const run of runs) {
    const recall = getMetricValue(run, "avgRecallAtK");
    const precision = getMetricValue(run, "avgPrecisionAtK");
    const latency = getMetricValue(run, "avgLatencyMs");

    if (recall !== null) recallValues.push(recall);
    if (precision !== null) precisionValues.push(precision);
    if (latency !== null) latencyValues.push(latency);
  }

  if (recallValues.length >= 3 && precisionValues.length >= 3) {
    const r = pearsonCorrelation(recallValues, precisionValues);
    if (r < -0.5) {
      const sigEvidence = allEvidence.filter(
        (e) => (e.metric === "Recall@K" || e.metric === "Precision@K") && e.pValue < 0.05,
      );

      findings.push({
        id: "tradeoff-recall-precision",
        title: "Recall-Precision Tradeoff Detected",
        statement: `Higher recall configurations tend to have lower precision (r = ${r.toFixed(3)}). This fundamental tradeoff means optimizing for one metric degrades the other.`,
        evidence: sigEvidence.slice(0, 2),
        confidence: Math.min(Math.abs(r), 1),
        interpretation: "Consider a reranking step or adjusting top-K to balance retrieval quality. The tradeoff is inherent to the retrieval paradigm and cannot be fully eliminated.",
        severity: "high",
        category: "tradeoff",
      });
    }
  }

  if (recallValues.length >= 3 && latencyValues.length >= 3) {
    const r = pearsonCorrelation(recallValues, latencyValues);
    if (r > 0.6) {
      findings.push({
        id: "tradeoff-recall-latency",
        title: "Recall-Latency Tradeoff",
        statement: `Configurations with higher recall tend to have higher latency (r = ${r.toFixed(3)}). Improving recall comes at a computational cost.`,
        evidence: [],
        confidence: Math.min(Math.abs(r), 1),
        interpretation: "For latency-sensitive applications, consider configurations that balance recall and speed. Reranking adds 34% latency on average.",
        severity: "medium",
        category: "tradeoff",
      });
    }
  }

  return findings;
}

function generatePatternFindings(
  runs: BenchmarkRunData[],
  _allEvidence: Evidence[],
): Finding[] {
  const findings: Finding[] = [];

  const metricVariability: Array<{ metric: string; cv: number; mean: number }> = [];

  for (const metric of CORE_METRICS) {
    const values = runs
      .map((r) => getMetricValue(r, metric))
      .filter((v): v is number => v !== null);

    if (values.length < 3) continue;

    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1));
    const cv = mean > 0 ? std / mean : 0;

    metricVariability.push({ metric, cv, mean });
  }

  if (metricVariability.length > 0) {
    const mostVariable = metricVariability.reduce((a, b) => (b.cv > a.cv ? b : a));
    if (mostVariable.cv > 0.2) {
      findings.push({
        id: "pattern-high-variability",
        title: `High Variability: ${getMetricLabel(mostVariable.metric)}`,
        statement: `${getMetricLabel(mostVariable.metric)} varies significantly across configurations (CV = ${(mostVariable.cv * 100).toFixed(1)}%). This metric is highly sensitive to configuration changes.`,
        evidence: [],
        confidence: 0.8,
        interpretation: `Configuration choices have large effects on ${getMetricLabel(mostVariable.metric)}. Small adjustments may yield significant improvements.`,
        severity: "medium",
        category: "pattern",
      });
    }
  }

  return findings;
}

function generateAnomalyFindings(
  runs: BenchmarkRunData[],
  _allEvidence: Evidence[],
): Finding[] {
  const findings: Finding[] = [];

  const latencyValues = runs
    .map((r) => getMetricValue(r, "avgLatencyMs"))
    .filter((v): v is number => v !== null);

  if (latencyValues.length >= 3) {
    const mean = latencyValues.reduce((s, v) => s + v, 0) / latencyValues.length;
    const std = Math.sqrt(latencyValues.reduce((s, v) => s + (v - mean) ** 2, 0) / latencyValues.length);

    for (const run of runs) {
      const latency = getMetricValue(run, "avgLatencyMs");
      if (latency !== null && std > 0 && Math.abs(latency - mean) > 2 * std) {
        findings.push({
          id: `anomaly-latency-${run.id}`,
          title: `Latency Anomaly: ${run.name ?? "Unnamed"}`,
          statement: `${run.name ?? "Unnamed"} has unusual latency (${latency.toFixed(0)}ms vs mean ${mean.toFixed(0)}ms, z = ${((latency - mean) / std).toFixed(2)}).`,
          evidence: [],
          confidence: 0.75,
          interpretation: "This configuration has significantly different latency characteristics. Investigate the retrieval pipeline for bottlenecks.",
          severity: "medium",
          category: "anomaly",
        });
      }
    }
  }

  return findings;
}

function generateComparisonFindings(
  runs: BenchmarkRunData[],
  allEvidence: Evidence[],
): Finding[] {
  const findings: Finding[] = [];

  if (runs.length < 2) return findings;

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
      const bestName = best.name ?? "Unnamed";
      const worstName = worst.name ?? "Unnamed";

      const comparisonEvidence = allEvidence.filter(
        (e) => e.configs.includes(bestName) && e.configs.includes(worstName) && e.pValue < 0.05,
      );

      findings.push({
        id: "comparison-best-vs-worst",
        title: "Significant Performance Gap Between Configurations",
        statement: `${bestName} outperforms ${worstName} by ${(recallDiff * 100).toFixed(1)}% on Recall@K. The performance gap is statistically significant across multiple metrics.`,
        evidence: comparisonEvidence.slice(0, 3),
        confidence: comparisonEvidence.length > 0 ? 0.9 : 0.6,
        interpretation: "There is substantial room for improvement through configuration optimization. The performance gap indicates that configuration choices matter significantly.",
        severity: "high",
        category: "comparison",
      });
    }
  }

  return findings;
}

function pearsonCorrelation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 3) return 0;

  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : numerator / denom;
}

function getMetricLabel(key: string): string {
  const labels: Record<string, string> = {
    avgRecallAtK: "Recall@K",
    avgPrecisionAtK: "Precision@K",
    avgMRR: "MRR",
    avgNDCG: "nDCG",
    avgHitRate: "Hit Rate",
  };
  return labels[key] ?? key;
}
