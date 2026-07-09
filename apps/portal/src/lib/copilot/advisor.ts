import type { CopilotContext, CopilotEvidence } from "./types";

interface AdvisorInput {
  context: CopilotContext;
  evidence: CopilotEvidence[];
  objective: string;
  constraints: {
    budgetMs?: number;
    budgetTokens?: number;
    maxExperiments?: number;
    priorityMetric?: string;
  };
}

interface AdvisorRecommendation {
  category: "performance" | "efficiency" | "coverage" | "reproducibility" | "statistical";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  expectedImpact: string;
  actions: string[];
  evidence: string[];
}

export function generateAdvisorRecommendations(input: AdvisorInput): AdvisorRecommendation[] {
  const { context, evidence, constraints } = input;
  const recommendations: AdvisorRecommendation[] = [];

  recommendations.push(...analyzePerformanceGaps(context, evidence));
  recommendations.push(...analyzeCoverageGaps(context));
  recommendations.push(...analyzeReproducibilityIssues(context));
  recommendations.push(...analyzeStatisticalIssues(context, evidence));
  recommendations.push(...analyzeEfficiencyOpportunities(context, constraints));

  recommendations.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });

  return recommendations.slice(0, 10);
}

function analyzePerformanceGaps(
  context: CopilotContext,
  _evidence: CopilotEvidence[]
): AdvisorRecommendation[] {
  const recommendations: AdvisorRecommendation[] = [];

  if (context.benchmarkHistory.length < 3) {
    recommendations.push({
      category: "performance",
      title: "Increase Experiment Count",
      description: "More experiments needed for reliable performance assessment.",
      priority: "high",
      expectedImpact: "Improved statistical power and confidence",
      actions: [
        "Run at least 3 more benchmark experiments",
        "Test different configurations for each",
        "Ensure consistent dataset usage",
      ],
      evidence: [`Only ${context.benchmarkHistory.length} experiments completed`],
    });
  }

  if (context.leaderboard.entries.length > 1) {
    const top = context.leaderboard.entries[0];
    const second = context.leaderboard.entries[1];
    const topRecall = top.metrics.avgRecallAtK ?? 0;
    const secondRecall = second.metrics.avgRecallAtK ?? 0;
    const gap = topRecall - secondRecall;

    if (gap < 0.05) {
      recommendations.push({
        category: "performance",
        title: "Tight Competition at Top",
        description: `Top two configurations differ by only ${(gap * 100).toFixed(1)}% in Recall.`,
        priority: "medium",
        expectedImpact: "Potential to find better configuration",
        actions: [
          "Test hybrid combinations of top configurations",
          "Try different chunk sizes with both approaches",
          "Consider adding reranking to both",
        ],
        evidence: [
          `Top: ${top.configName} (${(topRecall * 100).toFixed(1)}%)`,
          `Second: ${second.configName} (${(secondRecall * 100).toFixed(1)}%)`,
        ],
      });
    }
  }

  return recommendations;
}

function analyzeCoverageGaps(context: CopilotContext): AdvisorRecommendation[] {
  const recommendations: AdvisorRecommendation[] = [];

  if (context.experimentPlanner) {
    const planner = context.experimentPlanner;

    if (planner.coverageScore < 0.2) {
      recommendations.push({
        category: "coverage",
        title: "Low Configuration Coverage",
        description: `Only ${(planner.coverageScore * 100).toFixed(0)}% of configuration space explored.`,
        priority: "high",
        expectedImpact: "Discovery of potentially better configurations",
        actions: [
          "Systematically test unexplored dimensions",
          "Focus on most impactful parameters first",
          "Use the Experiment Planner for guidance",
        ],
        evidence: [
          `${planner.exploredCombinations}/${planner.totalCombinations} combinations tested`,
        ],
      });
    }

    if (planner.topRecommendations.length > 0) {
      const topRec = planner.topRecommendations[0];
      recommendations.push({
        category: "coverage",
        title: "Planner Recommendation Available",
        description: topRec.rationale,
        priority: topRec.priority as "high" | "medium" | "low",
        expectedImpact: `+${(topRec.expectedImprovement * 100).toFixed(1)}% expected improvement`,
        actions: [
          "Review the recommended configuration",
          "Check resource requirements",
          "Schedule the experiment",
        ],
        evidence: [`Expected improvement: ${(topRec.expectedImprovement * 100).toFixed(1)}%`],
      });
    }
  }

  return recommendations;
}

function analyzeReproducibilityIssues(context: CopilotContext): AdvisorRecommendation[] {
  const recommendations: AdvisorRecommendation[] = [];

  if (context.reproducibility) {
    const repro = context.reproducibility;

    if (repro.overallScore < 0.5) {
      recommendations.push({
        category: "reproducibility",
        title: "Improve Reproducibility",
        description: `Reproducibility score is ${(repro.overallScore * 100).toFixed(0)}%.`,
        priority: "medium",
        expectedImpact: "More trustworthy and reproducible results",
        actions: [
          "Generate manifests for all experiments",
          "Enable provenance tracking",
          "Document all configuration changes",
        ],
        evidence: [`Score: ${(repro.overallScore * 100).toFixed(0)}%`],
      });
    }

    if (!repro.provenanceActive) {
      recommendations.push({
        category: "reproducibility",
        title: "Enable Provenance Tracking",
        description: "Provenance tracking is not active.",
        priority: "low",
        expectedImpact: "Full experiment lineage tracking",
        actions: [
          "Enable provenance in experiment settings",
          "Verify chain integrity regularly",
        ],
        evidence: ["Provenance status: inactive"],
      });
    }
  }

  return recommendations;
}

function analyzeStatisticalIssues(
  context: CopilotContext,
  _evidence: CopilotEvidence[]
): AdvisorRecommendation[] {
  const recommendations: AdvisorRecommendation[] = [];

  const nonSignificant = context.statisticalComparisons.filter(
    (c) => !c.significant && Math.abs(c.improvement) > 0.05
  );

  if (nonSignificant.length > 0) {
    recommendations.push({
      category: "statistical",
      title: "Non-Significant Improvements Detected",
      description: `${nonSignificant.length} comparisons show improvements but lack statistical significance.`,
      priority: "high",
      expectedImpact: "More reliable conclusions",
      actions: [
        "Increase sample size (more questions)",
        "Run experiments multiple times",
        "Use paired statistical tests",
      ],
      evidence: nonSignificant.slice(0, 3).map(
        (c) => `${c.configA} vs ${c.configB}: +${(c.improvement * 100).toFixed(1)}% (p=${c.pValue.toFixed(3)})`
      ),
    });
  }

  if (context.benchmarkHistory.length > 0) {
    const questionCounts = context.benchmarkHistory.map((b) => b.questionCount);
    const avgQuestions = questionCounts.reduce((s, q) => s + q, 0) / questionCounts.length;

    if (avgQuestions < 50) {
      recommendations.push({
        category: "statistical",
        title: "Low Question Count",
        description: `Average of ${avgQuestions.toFixed(0)} questions per benchmark.`,
        priority: "medium",
        expectedImpact: "More reliable metric estimates",
        actions: [
          "Add more questions to benchmark datasets",
          "Use stratified sampling for diversity",
          "Consider bootstrap confidence intervals",
        ],
        evidence: [`Average questions: ${avgQuestions.toFixed(0)}`],
      });
    }
  }

  return recommendations;
}

function analyzeEfficiencyOpportunities(
  context: CopilotContext,
  constraints: AdvisorInput["constraints"]
): AdvisorRecommendation[] {
  const recommendations: AdvisorRecommendation[] = [];

  if (constraints.budgetMs && constraints.budgetMs < 3600000) {
    recommendations.push({
      category: "efficiency",
      title: "Time-Constrained Optimization",
      description: `Budget of ${(constraints.budgetMs / 60000).toFixed(0)} minutes detected.`,
      priority: "high",
      expectedImpact: "Maximum results within time constraint",
      actions: [
        "Focus on high-impact, low-cost experiments",
        "Use smaller datasets for quick iterations",
        "Prioritize latency-sensitive configurations",
      ],
      evidence: [`Time budget: ${(constraints.budgetMs / 60000).toFixed(0)} minutes`],
    });
  }

  if (context.benchmarkHistory.length > 0) {
    const latencies = context.benchmarkHistory
      .map((b) => b.metrics.latencySearchMs || b.metrics.totalLatencyMs)
      .filter((l) => l !== undefined) as number[];

    if (latencies.length > 0) {
      const avgLatency = latencies.reduce((s, l) => s + l, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      if (maxLatency > avgLatency * 2) {
        recommendations.push({
          category: "efficiency",
          title: "Latency Variability Detected",
          description: `Latency varies from ${(Math.min(...latencies)).toFixed(0)}ms to ${maxLatency.toFixed(0)}ms.`,
          priority: "medium",
          expectedImpact: "More consistent performance",
          actions: [
            "Investigate cause of latency spikes",
            "Consider caching frequent queries",
            "Optimize retrieval pipeline",
          ],
          evidence: [
            `Average: ${avgLatency.toFixed(0)}ms`,
            `Max: ${maxLatency.toFixed(0)}ms`,
          ],
        });
      }
    }
  }

  return recommendations;
}

export function prioritizeForConstraints(
  recommendations: AdvisorRecommendation[],
  constraints: AdvisorInput["constraints"]
): AdvisorRecommendation[] {
  return recommendations.map((rec) => {
    let adjustedPriority = rec.priority;

    if (constraints.priorityMetric === "latency" && rec.category === "efficiency") {
      adjustedPriority = "high";
    }

    if (constraints.priorityMetric === "accuracy" && rec.category === "performance") {
      adjustedPriority = "high";
    }

    if (constraints.maxExperiments && constraints.maxExperiments < 3 && rec.category === "coverage") {
      adjustedPriority = "low";
    }

    return { ...rec, priority: adjustedPriority };
  }).sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}
