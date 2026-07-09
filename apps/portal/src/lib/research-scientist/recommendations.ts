import type { Finding, BenchmarkRunData, Evidence, Recommendation } from "./types";
import { getBestConfigForMetric } from "./evidence";

export function generateRecommendations(
  runs: BenchmarkRunData[],
  findings: Finding[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  recs.push(...generateBestConfigRecommendation(runs, findings));
  recs.push(...generateTradeoffRecommendations(findings));
  recs.push(...generateImprovementRecommendations(runs, findings));
  recs.push(...generateExperimentRecommendations(findings));

  return recs.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function generateBestConfigRecommendation(
  runs: BenchmarkRunData[],
  findings: Finding[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  const bestRecall = getBestConfigForMetric(runs, "avgRecallAtK");
  const bestMRR = getBestConfigForMetric(runs, "avgMRR");

  if (bestRecall) {
    const evidence = findEvidenceForConfig(findings, bestRecall.config);
    recs.push({
      title: `Deploy ${bestRecall.config} for optimal retrieval`,
      description: `${bestRecall.config} achieves the highest Recall@K (${(bestRecall.value * 100).toFixed(1)}%) across all tested configurations.`,
      priority: "high",
      evidence,
      expectedImpact: "Maximize relevant document retrieval.",
      confidence: evidence.length > 0 ? Math.min(1, evidence[0].effectSize) : 0.7,
    });
  }

  if (bestMRR && bestMRR.config !== bestRecall?.config) {
    recs.push({
      title: `Consider ${bestMRR.config} for question answering`,
      description: `${bestMRR.config} achieves the highest MRR (${(bestMRR.value * 100).toFixed(1)}%), which is critical for QA applications where the first relevant result matters.`,
      priority: "medium",
      evidence: [],
      expectedImpact: "Improve first-hit relevance for QA use cases.",
      confidence: 0.7,
    });
  }

  return recs;
}

function generateTradeoffRecommendations(findings: Finding[]): Recommendation[] {
  const recs: Recommendation[] = [];

  const tradeoffs = findings.filter((f) => f.category === "tradeoff");
  for (const tf of tradeoffs) {
    recs.push({
      title: `Address ${tf.title}`,
      description: tf.interpretation,
      priority: tf.severity === "high" ? "high" : "medium",
      evidence: tf.evidence,
      expectedImpact: "Balance competing metrics for optimal overall performance.",
      confidence: tf.confidence,
    });
  }

  return recs;
}

function generateImprovementRecommendations(
  runs: BenchmarkRunData[],
  _findings: Finding[],
): Recommendation[] {
  const recs: Recommendation[] = [];

  const bestRecall = getBestConfigForMetric(runs, "avgRecallAtK");
  if (bestRecall && bestRecall.value < 0.7) {
    recs.push({
      title: "Increase top-K to improve recall",
      description: `Best recall is ${(bestRecall.value * 100).toFixed(1)}%. Increasing top-K should capture more relevant documents.`,
      priority: "high",
      evidence: [],
      expectedImpact: "5-15% improvement in recall.",
      confidence: 0.8,
    });
  }

  return recs;
}

function generateExperimentRecommendations(findings: Finding[]): Recommendation[] {
  const recs: Recommendation[] = [];

  const patterns = findings.filter((f) => f.category === "pattern");
  for (const p of patterns) {
    recs.push({
      title: `Investigate ${p.title}`,
      description: p.interpretation,
      priority: "medium",
      evidence: p.evidence,
      expectedImpact: "Better understanding of configuration sensitivity.",
      confidence: p.confidence,
    });
  }

  return recs;
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
  return evidence.slice(0, 3);
}
