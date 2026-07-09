import type { CopilotContext, ResearchPlan } from "./types";

interface PlannerInput {
  context: CopilotContext;
  budgetMs?: number;
  budgetTokens?: number;
  maxExperiments?: number;
  priorityMetric?: string;
  targetMetric?: string;
  targetValue?: number;
  timeframeDays?: number;
}

interface PlanStep {
  step: number;
  title: string;
  description: string;
  estimatedDuration: string;
  expectedOutcome: string;
  dependencies: number[];
  configuration?: Record<string, unknown>;
}

export function generateResearchPlan(input: PlannerInput): ResearchPlan {
  const { context, targetMetric, targetValue } = input;

  const steps: PlanStep[] = [];

  steps.push({
    step: steps.length + 1,
    title: "Baseline Assessment",
    description: "Run current best configuration to establish baseline metrics",
    estimatedDuration: "15-30 minutes",
    expectedOutcome: "Established baseline for comparison",
    dependencies: [],
    configuration: context.currentConfiguration as unknown as Record<string, unknown>,
  });

  if (context.experimentPlanner && context.experimentPlanner.coverageScore < 0.3) {
    steps.push({
      step: steps.length + 1,
      title: "Configuration Space Exploration",
      description: "Systematically test unexplored configuration combinations",
      estimatedDuration: "1-2 hours",
      expectedOutcome: "Identified promising configuration regions",
      dependencies: [1],
      configuration: {
        strategy: "exploration",
        focus: context.experimentPlanner.topRecommendations.length > 0
          ? context.experimentPlanner.topRecommendations[0].rationale
          : "Systematic grid search",
      },
    });
  }

  if (context.benchmarkHistory.length > 0) {
    const latest = context.benchmarkHistory[0];
    const hasHighVariance = Object.values(latest.metrics).some((v) => typeof v === "number" && v < 0.3);

    if (hasHighVariance) {
      steps.push({
        step: steps.length + 1,
        title: "High-Variance Metric Investigation",
        description: "Investigate metrics with high variance and low values",
        estimatedDuration: "30-60 minutes",
        expectedOutcome: "Root cause identified for poor metrics",
        dependencies: [1],
      });
    }
  }

  if (context.researchScientist && context.researchScientist.findings.length > 0) {
    const significantFindings = context.researchScientist.findings.filter((f) => f.severity !== "tentative");

    if (significantFindings.length > 0) {
      steps.push({
        step: steps.length + 1,
        title: "Validate Research Findings",
        description: `Validate ${significantFindings.length} research findings with additional experiments`,
        estimatedDuration: "1-2 hours",
        expectedOutcome: "Confirmed or refuted findings",
        dependencies: steps.map((s) => s.step),
      });
    }
  }

  steps.push({
    step: steps.length + 1,
    title: "Optimization Phase",
    description: "Fine-tune the best-performing configurations",
    estimatedDuration: "30-60 minutes",
    expectedOutcome: "Optimized configuration",
    dependencies: [1, 2],
  });

  if (context.reproducibility && context.reproducibility.overallScore < 0.7) {
    steps.push({
      step: steps.length + 1,
      title: "Reproducibility Verification",
      description: "Ensure all experiments are reproducible",
      estimatedDuration: "15-30 minutes",
      expectedOutcome: "All experiments reproducible with manifests",
      dependencies: steps.map((s) => s.step),
    });
  }

  steps.push({
    step: steps.length + 1,
    title: "Final Validation",
    description: "Run final validation with statistical significance testing",
    estimatedDuration: "15-30 minutes",
    expectedOutcome: "Statistically validated results",
    dependencies: steps.map((s) => s.step),
  });

  const totalMinutes = steps.length * 20;
  const totalEstimatedDuration = totalMinutes > 60
    ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
    : `${totalMinutes}m`;

  const objective = targetMetric && targetValue
    ? `Achieve ${targetMetric} >= ${targetValue}`
    : "Optimize RAG configuration for best overall performance";

  return {
    title: `Research Plan: ${objective}`,
    objective,
    steps,
    totalEstimatedDuration,
    expectedOutcome: "Statistically validated, reproducible RAG configuration",
    risks: identifyRisks(context),
    alternatives: generateAlternatives(context),
    successCriteria: generateSuccessCriteria(context, targetMetric, targetValue),
  };
}

function identifyRisks(context: CopilotContext): string[] {
  const risks: string[] = [];

  if (context.benchmarkHistory.length < 3) {
    risks.push("Insufficient baseline data for reliable comparison");
  }

  if (context.experimentPlanner && context.experimentPlanner.coverageScore < 0.2) {
    risks.push("Low coverage may miss optimal configurations");
  }

  if (context.reproducibility && context.reproducibility.overallScore < 0.5) {
    risks.push("Low reproducibility may invalidate findings");
  }

  const nonSignificant = context.statisticalComparisons.filter((c) => !c.significant);
  if (nonSignificant.length > context.statisticalComparisons.length * 0.5) {
    risks.push("Many comparisons lack statistical significance");
  }

  if (context.researchScientist && context.researchScientist.threats.length > 3) {
    risks.push("Multiple threats to validity identified");
  }

  return risks;
}

function generateAlternatives(context: CopilotContext): string[] {
  const alternatives: string[] = [];

  if (context.benchmarkHistory.length > 0) {
    const currentMode = context.currentConfiguration.retrievalMode;
    alternatives.push(`Try ${currentMode === "hybrid" ? "single-mode" : "hybrid"} retrieval`);

    if (context.currentConfiguration.reranker === "none") {
      alternatives.push("Add cross-encoder reranking");
    }

    if (context.currentConfiguration.chunkSize < 512) {
      alternatives.push("Increase chunk size for more context");
    } else if (context.currentConfiguration.chunkSize > 1024) {
      alternatives.push("Decrease chunk size for more precise retrieval");
    }
  }

  return alternatives;
}

function generateSuccessCriteria(
  context: CopilotContext,
  targetMetric?: string,
  targetValue?: number
): string[] {
  const criteria: string[] = [];

  if (targetMetric && targetValue) {
    criteria.push(`${targetMetric} >= ${targetValue}`);
  }

  if (context.statisticalComparisons.length > 0) {
    criteria.push("At least one statistically significant improvement (p < 0.05)");
  }

  if (context.reproducibility) {
    criteria.push(`Reproducibility score >= ${Math.max(context.reproducibility.overallScore, 0.7)}`);
  }

  criteria.push("All experiments have manifests for reproducibility");

  return criteria;
}

export function adaptPlanToConstraints(
  plan: ResearchPlan,
  constraints: {
    budgetMs?: number;
    maxExperiments?: number;
    timeframeDays?: number;
  }
): ResearchPlan {
  let adaptedSteps = [...plan.steps];

  if (constraints.maxExperiments && constraints.maxExperiments < adaptedSteps.length) {
    adaptedSteps = adaptedSteps.slice(0, constraints.maxExperiments);
  }

  if (constraints.timeframeDays && constraints.timeframeDays < 1) {
    adaptedSteps = adaptedSteps.filter(
      (s) => !s.title.includes("Exploration") || s.title === "Baseline Assessment"
    );
  }

  if (constraints.budgetMs && constraints.budgetMs < 1800000) {
    adaptedSteps = adaptedSteps.map((s) => ({
      ...s,
      estimatedDuration: `${Math.floor(parseInt(s.estimatedDuration) / 2)}-${Math.floor(parseInt(s.estimatedDuration.split("-")[1]) / 2)}m`,
    }));
  }

  return {
    ...plan,
    steps: adaptedSteps.map((s, i) => ({ ...s, step: i + 1 })),
    totalEstimatedDuration: `${adaptedSteps.length * 15}m`,
  };
}

export function prioritizeSteps(
  steps: PlanStep[],
  priorityMetric: string
): PlanStep[] {
  const prioritized = [...steps];

  if (priorityMetric === "latency") {
    prioritized.sort((a, b) => {
      const aLatency = a.title.toLowerCase().includes("latency") ? 0 : 1;
      const bLatency = b.title.toLowerCase().includes("latency") ? 0 : 1;
      return aLatency - bLatency;
    });
  } else if (priorityMetric === "accuracy") {
    prioritized.sort((a, b) => {
      const aAccuracy = a.title.toLowerCase().includes("accuracy") || a.title.toLowerCase().includes("retrieval") ? 0 : 1;
      const bAccuracy = b.title.toLowerCase().includes("accuracy") || b.title.toLowerCase().includes("retrieval") ? 0 : 1;
      return aAccuracy - bAccuracy;
    });
  } else if (priorityMetric === "reproducibility") {
    prioritized.sort((a, b) => {
      const aRepro = a.title.toLowerCase().includes("reproducibility") ? 0 : 1;
      const bRepro = b.title.toLowerCase().includes("reproducibility") ? 0 : 1;
      return aRepro - bRepro;
    });
  }

  return prioritized.map((s, i) => ({ ...s, step: i + 1 }));
}

export function estimateStepCosts(
  context: CopilotContext,
  step: PlanStep
): { timeMs: number; tokens: number } {
  const baseTimeMs = 15 * 60 * 1000;
  const baseTokens = 5000;

  let timeMultiplier = 1;
  let tokenMultiplier = 1;

  if (step.title.includes("Exploration")) {
    timeMultiplier = 3;
    tokenMultiplier = 2;
  } else if (step.title.includes("Validation")) {
    timeMultiplier = 2;
    tokenMultiplier = 3;
  } else if (step.title.includes("Optimization")) {
    timeMultiplier = 2;
    tokenMultiplier = 1.5;
  }

  if (context.benchmarkHistory.length > 5) {
    timeMultiplier *= 1.2;
  }

  return {
    timeMs: Math.floor(baseTimeMs * timeMultiplier),
    tokens: Math.floor(baseTokens * tokenMultiplier),
  };
}
