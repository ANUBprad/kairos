import type { Threat, BenchmarkRunData } from "./types";

export function generateThreats(
  runs: BenchmarkRunData[],
  totalQuestions: number,
): Threat[] {
  const threats: Threat[] = [];

  threats.push(...generateInternalThreats(runs, totalQuestions));
  threats.push(...generateExternalThreats(runs));
  threats.push(...generateConstructThreats(runs));
  threats.push(...generateConclusionThreats(runs));

  return threats;
}

function generateInternalThreats(
  runs: BenchmarkRunData[],
  totalQuestions: number,
): Threat[] {
  const threats: Threat[] = [];

  if (totalQuestions < 30) {
    threats.push({
      category: "internal",
      title: "Small Sample Size",
      description: `The benchmark dataset contains only ${totalQuestions} questions. Results may not generalize to the broader document collection.`,
      impact: "high",
      mitigation: "Increase the dataset to 100+ questions for more reliable statistical conclusions.",
      evidence: [`${totalQuestions} questions evaluated`, "Statistical power is limited with small samples"],
    });
  } else if (totalQuestions < 100) {
    threats.push({
      category: "internal",
      title: "Moderate Sample Size",
      description: `${totalQuestions} questions provide reasonable but not robust statistical power. Small effect sizes may be missed.`,
      impact: "medium",
      mitigation: "Consider increasing dataset size for detecting small but meaningful differences.",
      evidence: [`${totalQuestions} questions evaluated`],
    });
  }

  if (runs.length < 5) {
    threats.push({
      category: "internal",
      title: "Limited Configuration Coverage",
      description: `Only ${runs.length} configurations were tested. The configuration space is large and important combinations may be missing.`,
      impact: "medium",
      mitigation: "Run additional experiments with varied parameters to improve coverage.",
      evidence: [`${runs.length} configurations tested`],
    });
  }

  return threats;
}

function generateExternalThreats(runs: BenchmarkRunData[]): Threat[] {
  const threats: Threat[] = [];

  const datasetNames = new Set(runs.map((r) => r.datasetName));
  if (datasetNames.size < 2) {
    threats.push({
      category: "external",
      title: "Single Dataset Evaluation",
      description: `All evaluations were performed on a single dataset (${Array.from(datasetNames)[0] ?? "unknown"}). Results may not transfer to other domains.`,
      impact: "high",
      mitigation: "Evaluate on multiple datasets from different domains to improve generalizability.",
      evidence: [`Datasets tested: ${Array.from(datasetNames).join(", ")}`],
    });
  }

  return threats;
}

function generateConstructThreats(runs: BenchmarkRunData[]): Threat[] {
  const threats: Threat[] = [];

  const hasGenerationMetrics = runs.some((r) => {
    const m = r.aggregatedMetrics;
    return m && typeof m.avgFaithfulness === "number";
  });

  if (!hasGenerationMetrics) {
    threats.push({
      category: "construct",
      title: "No Generation Quality Metrics",
      description: "The evaluation only measures retrieval quality. Answer quality (faithfulness, relevancy, correctness) is not assessed.",
      impact: "medium",
      mitigation: "Add LLM-as-judge evaluation for answer quality assessment.",
      evidence: ["Retrieval metrics available", "Generation metrics missing"],
    });
  }

  return threats;
}

function generateConclusionThreats(runs: BenchmarkRunData[]): Threat[] {
  const threats: Threat[] = [];

  const significantCount = countSignificantComparisons(runs);
  const totalComparisons = countTotalComparisons(runs);

  if (totalComparisons > 0 && significantCount / totalComparisons < 0.3) {
    threats.push({
      category: "conclusion",
      title: "Low Statistical Power",
      description: `Only ${significantCount} of ${totalComparisons} comparisons are statistically significant. Many observed differences may be due to chance.`,
      impact: "high",
      mitigation: "Increase sample size or run more experiments to improve statistical power.",
      evidence: [
        `${significantCount} significant comparisons`,
        `${totalComparisons} total comparisons`,
        `${((significantCount / totalComparisons) * 100).toFixed(0)}% significance rate`,
      ],
    });
  }

  return threats;
}

function countSignificantComparisons(runs: BenchmarkRunData[]): number {
  let count = 0;
  for (let i = 0; i < runs.length - 1; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const mA = runs[i].aggregatedMetrics;
      const mB = runs[j].aggregatedMetrics;
      if (mA && mB) {
        const diff = Math.abs((mA.avgRecallAtK ?? 0) - (mB.avgRecallAtK ?? 0));
        if (diff > 0.05) count++;
      }
    }
  }
  return count;
}

function countTotalComparisons(runs: BenchmarkRunData[]): number {
  return (runs.length * (runs.length - 1)) / 2;
}
