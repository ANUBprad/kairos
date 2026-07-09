import type { DiscussionPoint, Finding, Evidence, BenchmarkRunData } from "./types";
import { getMetricValue, getBestConfigForMetric, getMetricLabel } from "./evidence";

const CORE_METRICS = ["avgRecallAtK", "avgPrecisionAtK", "avgMRR", "avgNDCG", "avgHitRate"];

export function generateDiscussion(
  runs: BenchmarkRunData[],
  findings: Finding[],
): DiscussionPoint[] {
  const points: DiscussionPoint[] = [];

  points.push(...explainWhyResultsHappened(runs, findings));
  points.push(...explainMetricCovariation(runs));
  points.push(...explainTradeoffs(runs, findings));
  points.push(...explainSimilarConfigs(runs));
  points.push(...explainUnexpectedObservations(findings));

  return points;
}

function explainWhyResultsHappened(
  runs: BenchmarkRunData[],
  findings: Finding[],
): DiscussionPoint[] {
  const points: DiscussionPoint[] = [];

  const bestRecall = getBestConfigForMetric(runs, "avgRecallAtK");
  const bestPrecision = getBestConfigForMetric(runs, "avgPrecisionAtK");
  const bestNDCG = getBestConfigForMetric(runs, "avgNDCG");

  if (bestRecall && bestPrecision) {
    if (bestRecall.config !== bestPrecision.config) {
      points.push({
        topic: "Why different configurations optimize different metrics",
        observation: `${bestRecall.config} achieves highest recall while ${bestPrecision.config} achieves highest precision.`,
        evidence: [],
        explanation: "Recall-oriented configurations retrieve more documents (higher top-K), which increases the chance of finding relevant documents but also introduces more noise. Precision-oriented configurations are more selective, returning fewer but more targeted results.",
        implications: [
          "No single configuration is optimal for all use cases",
          "The choice between recall and precision depends on the application",
          "Hybrid approaches may balance both metrics",
        ],
      });
    }
  }

  if (bestNDCG) {
    const ndcgEvidence = findEvidenceForConfig(findings, bestNDCG.config);
    points.push({
      topic: "Why ranking quality varies across configurations",
      observation: `${bestNDCG.config} achieves the highest nDCG (${(bestNDCG.value * 100).toFixed(1)}%).`,
      evidence: ndcgEvidence,
      explanation: "nDCG measures not just whether relevant documents are retrieved, but whether they are ranked at the top. Configurations with reranking or better similarity scoring tend to have higher nDCG.",
      implications: [
        "Reranking improves ranking quality even when recall is similar",
        "The order of retrieved documents matters for user experience",
        "nDCG is the most comprehensive single metric for retrieval quality",
      ],
    });
  }

  return points;
}

function explainMetricCovariation(runs: BenchmarkRunData[]): DiscussionPoint[] {
  const points: DiscussionPoint[] = [];

  const metrics: Array<{ key: string; label: string }> = CORE_METRICS.map((k) => ({
    key: k,
    label: getMetricLabel(k),
  }));

  for (let i = 0; i < metrics.length; i++) {
    for (let j = i + 1; j < metrics.length; j++) {
      const valuesI = runs.map((r) => getMetricValue(r, metrics[i].key)).filter((v): v is number => v !== null);
      const valuesJ = runs.map((r) => getMetricValue(r, metrics[j].key)).filter((v): v is number => v !== null);

      if (valuesI.length >= 3 && valuesJ.length >= 3) {
        const r = pearsonCorrelation(valuesI, valuesJ);
        if (Math.abs(r) > 0.7) {
          points.push({
            topic: `Why ${metrics[i].label} and ${metrics[j].label} move together`,
            observation: `${metrics[i].label} and ${metrics[j].label} show ${r > 0 ? "strong positive" : "strong negative"} correlation (r = ${r.toFixed(3)}).`,
            evidence: [],
            explanation: r > 0
              ? `Improvements in ${metrics[i].label} tend to coincide with improvements in ${metrics[j].label}. This suggests the underlying retrieval mechanism benefits both metrics simultaneously.`
              : `Improvements in ${metrics[i].label} tend to degrade ${metrics[j].label}. This is a fundamental tradeoff in the retrieval paradigm.`,
            implications: [
              r > 0 ? "Optimizing for one metric also improves the other" : "Optimizing for one metric may harm the other",
              "Consider composite metrics that balance both",
            ],
          });
        }
      }
    }
  }

  return points.slice(0, 3);
}

function explainTradeoffs(
  runs: BenchmarkRunData[],
  findings: Finding[],
): DiscussionPoint[] {
  const points: DiscussionPoint[] = [];

  const tradeoffFindings = findings.filter((f) => f.category === "tradeoff");
  for (const tf of tradeoffFindings) {
    points.push({
      topic: tf.title,
      observation: tf.statement,
      evidence: tf.evidence,
      explanation: tf.interpretation,
      implications: [
        "Tradeoffs are inherent to the retrieval paradigm",
        "The optimal balance depends on the application requirements",
        "Consider multi-objective optimization approaches",
      ],
    });
  }

  return points;
}

function explainSimilarConfigs(runs: BenchmarkRunData[]): DiscussionPoint[] {
  const points: DiscussionPoint[] = [];

  if (runs.length < 3) return points;

  const configScores = runs.map((r) => {
    const metrics = r.aggregatedMetrics ?? {};
    return {
      name: r.name ?? "Unnamed",
      recall: metrics.avgRecallAtK ?? 0,
      precision: metrics.avgPrecisionAtK ?? 0,
      ndcg: metrics.avgNDCG ?? 0,
    };
  });

  const clusters: Array<{ configs: string[]; avgRecall: number }> = [];
  const threshold = 0.05;

  for (const c of configScores) {
    const similar = configScores.filter(
      (other) =>
        other.name !== c.name &&
        Math.abs(other.recall - c.recall) < threshold &&
        Math.abs(other.precision - c.precision) < threshold,
    );

    if (similar.length > 0) {
      const existing = clusters.find((cl) => cl.configs.includes(c.name));
      if (!existing) {
        clusters.push({
          configs: [c.name, ...similar.map((s) => s.name)],
          avgRecall: (c.recall + similar.reduce((s, x) => s + x.recall, 0)) / (1 + similar.length),
        });
      }
    }
  }

  if (clusters.length > 0) {
    const cluster = clusters[0];
    points.push({
      topic: "Configurations with similar performance",
      observation: `${cluster.configs.join(", ")} achieve similar performance (avg Recall@K: ${(cluster.avgRecall * 100).toFixed(1)}%).`,
      evidence: [],
      explanation: "These configurations are functionally equivalent for this dataset. Differences in their parameters do not meaningfully affect retrieval quality.",
      implications: [
        "Choose the configuration with lowest latency among equivalent options",
        "The performance difference between these configurations is not statistically meaningful",
        "Consider other factors like cost, complexity, or maintainability",
      ],
    });
  }

  return points;
}

function explainUnexpectedObservations(findings: Finding[]): DiscussionPoint[] {
  const points: DiscussionPoint[] = [];

  const anomalyFindings = findings.filter((f) => f.category === "anomaly");
  for (const af of anomalyFindings) {
    points.push({
      topic: af.title,
      observation: af.statement,
      evidence: af.evidence,
      explanation: af.interpretation,
      implications: [
        "Anomalies may indicate configuration issues or data quality problems",
        "Investigate the specific configuration for potential bottlenecks",
      ],
    });
  }

  return points;
}

function findEvidenceForConfig(findings: Finding[], config: string): Evidence[] {
  const evidence: Evidence[] = [];
  for (const f of findings) {
    for (const e of f.evidence) {
      if (e.configs.includes(config)) {
        evidence.push(e);
      }
    }
  }
  return evidence.slice(0, 2);
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
