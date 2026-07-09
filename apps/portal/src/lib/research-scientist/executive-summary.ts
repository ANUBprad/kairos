import type { ExecutiveSummary, Finding, BenchmarkRunData, Threat } from "./types";
import { getBestConfigForMetric, getMetricValue } from "./evidence";

export function generateExecutiveSummary(
  runs: BenchmarkRunData[],
  findings: Finding[],
  threats: Threat[],
  researchConfidence: number,
): ExecutiveSummary {
  const bestConfig = getBestConfigForMetric(runs, "avgRecallAtK");
  const bestMRR = getBestConfigForMetric(runs, "avgMRR");

  const overallConclusion = generateOverallConclusion(runs, bestConfig, researchConfidence);
  const mostImportantFinding = findMostImportantFinding(findings);
  const mostSurprising = findMostSurprisingObservation(findings, runs);
  const recommendedDeployment = generateDeploymentRecommendation(runs, bestConfig, bestMRR);
  const nextExperiment = suggestNextExperiment(findings, runs);

  return {
    overallConclusion,
    bestConfiguration: bestConfig?.config ?? "Insufficient data",
    confidenceLevel: researchConfidence,
    mostImportantFinding,
    mostSurprisingObservation: mostSurprising,
    recommendedDeployment,
    researchConfidence,
    nextExperiment,
  };
}

function generateOverallConclusion(
  runs: BenchmarkRunData[],
  bestConfig: { config: string; value: number } | null,
  confidence: number,
): string {
  if (!bestConfig) {
    return "Insufficient benchmark data to draw conclusions. Run more experiments.";
  }

  const confidenceDesc = confidence > 0.8
    ? "high confidence"
    : confidence > 0.5
      ? "moderate confidence"
      : "low confidence";

  return `After analyzing ${runs.length} benchmark configurations, ${bestConfig.config} achieves the best overall retrieval performance (${(bestConfig.value * 100).toFixed(1)}% Recall@K). This conclusion is drawn with ${confidenceDesc} based on the available evidence.`;
}

function findMostImportantFinding(findings: Finding[]): string {
  const important = findings
    .filter((f) => f.severity === "high" || f.severity === "critical")
    .sort((a, b) => b.confidence - a.confidence);

  if (important.length > 0) {
    return important[0].title;
  }

  if (findings.length > 0) {
    return findings[0].title;
  }

  return "No significant findings detected.";
}

function findMostSurprisingObservation(
  findings: Finding[],
  runs: BenchmarkRunData[],
): string {
  const anomalies = findings.filter((f) => f.category === "anomaly");
  if (anomalies.length > 0) {
    return anomalies[0].statement;
  }

  const tradeoffs = findings.filter((f) => f.category === "tradeoff");
  if (tradeoffs.length > 0) {
    return tradeoffs[0].statement;
  }

  if (runs.length >= 2) {
    const sorted = [...runs].sort((a, b) => {
      const scoreA = (a.aggregatedMetrics?.avgRecallAtK ?? 0) + (a.aggregatedMetrics?.avgMRR ?? 0);
      const scoreB = (b.aggregatedMetrics?.avgRecallAtK ?? 0) + (b.aggregatedMetrics?.avgMRR ?? 0);
      return scoreB - scoreA;
    });

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];
    const recallDiff = ((best.aggregatedMetrics?.avgRecallAtK ?? 0) - (worst.aggregatedMetrics?.avgRecallAtK ?? 0)) * 100;

    if (recallDiff > 15) {
      return `The performance gap between ${best.name ?? "best"} and ${worst.name ?? "worst"} is ${recallDiff.toFixed(1)} percentage points on Recall@K, indicating significant configuration sensitivity.`;
    }
  }

  return "No surprising observations detected.";
}

function generateDeploymentRecommendation(
  runs: BenchmarkRunData[],
  bestRecall: { config: string; value: number } | null,
  _bestMRR: { config: string; value: number } | null,
): string {
  if (!bestRecall) {
    return "Insufficient data for deployment recommendation.";
  }

  const recallVal = getMetricValue(
    runs.find((r) => r.name === bestRecall.config) ?? runs[0],
    "avgRecallAtK",
  );

  if (recallVal && recallVal > 0.8) {
    return `${bestRecall.config} is recommended for deployment. It achieves strong recall (${(recallVal * 100).toFixed(1)}%) and is suitable for production use.`;
  }

  if (recallVal && recallVal > 0.6) {
    return `${bestRecall.config} is acceptable for deployment but may benefit from additional optimization. Consider increasing top-K or adding reranking.`;
  }

  return `${bestRecall.config} has the best performance but recall is below 60%. Consider additional optimization before production deployment.`;
}

function suggestNextExperiment(findings: Finding[], runs: BenchmarkRunData[]): string {
  const tradeoffs = findings.filter((f) => f.category === "tradeoff");
  if (tradeoffs.length > 0) {
    return `Investigate the ${tradeoffs[0].title.toLowerCase()} by testing configurations that balance the competing metrics.`;
  }

  const bestRecall = getBestConfigForMetric(runs, "avgRecallAtK");
  if (bestRecall && bestRecall.value < 0.7) {
    return `Improve recall by increasing top-K or testing query expansion with ${bestRecall.config}.`;
  }

  return "Run additional experiments with varied parameters to improve statistical power.";
}
