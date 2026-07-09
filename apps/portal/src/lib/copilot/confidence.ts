import type {
  CopilotConfidence,
  ConfidenceFactor,
  CopilotEvidence,
  CopilotContext,
} from "./types";

interface ConfidenceInput {
  evidence: CopilotEvidence[];
  context: CopilotContext;
  intentConfidence: number;
}

const FACTOR_WEIGHTS = {
  evidenceQuantity: 0.2,
  statisticalSignificance: 0.2,
  effectSizes: 0.15,
  reproducibility: 0.1,
  experimentCoverage: 0.15,
  plannerConfidence: 0.1,
  researchConfidence: 0.1,
};

export function computeConfidence(input: ConfidenceInput): CopilotConfidence {
  const { evidence, context, intentConfidence } = input;

  const factors: ConfidenceFactor[] = [];

  factors.push(computeEvidenceQuantityFactor(evidence));
  factors.push(computeStatisticalSignificanceFactor(evidence));
  factors.push(computeEffectSizeFactor(evidence));
  factors.push(computeReproducibilityFactor(context));
  factors.push(computeExperimentCoverageFactor(context));
  factors.push(computePlannerConfidenceFactor(context));
  factors.push(computeResearchConfidenceFactor(context));

  let weightedSum = 0;
  let totalWeight = 0;

  for (const factor of factors) {
    weightedSum += factor.score * factor.weight;
    totalWeight += factor.weight;
  }

  const rawScore = totalWeight > 0 ? weightedSum / totalWeight : 0.3;
  const finalScore = Math.min(1, rawScore * 0.7 + intentConfidence * 0.3);

  const label = getConfidenceLabel(finalScore);

  return {
    score: finalScore,
    factors,
    label,
  };
}

function computeEvidenceQuantityFactor(evidence: CopilotEvidence[]): ConfidenceFactor {
  const count = evidence.length;
  let score: number;

  if (count >= 10) score = 1.0;
  else if (count >= 5) score = 0.8;
  else if (count >= 3) score = 0.6;
  else if (count >= 1) score = 0.4;
  else score = 0.2;

  return {
    name: "Evidence Quantity",
    score,
    weight: FACTOR_WEIGHTS.evidenceQuantity,
    description: `${count} evidence items available`,
  };
}

function computeStatisticalSignificanceFactor(evidence: CopilotEvidence[]): ConfidenceFactor {
  const statisticalEvidence = evidence.filter((e) => e.type === "statistical");

  if (statisticalEvidence.length === 0) {
    return {
      name: "Statistical Significance",
      score: 0.3,
      weight: FACTOR_WEIGHTS.statisticalSignificance,
      description: "No statistical evidence available",
    };
  }

  let significantCount = 0;
  for (const e of statisticalEvidence) {
    const data = e.data as { pValue?: number; significant?: boolean };
    if (data.significant || (data.pValue !== undefined && data.pValue < 0.05)) {
      significantCount++;
    }
  }

  const ratio = significantCount / statisticalEvidence.length;
  const score = 0.3 + ratio * 0.7;

  return {
    name: "Statistical Significance",
    score,
    weight: FACTOR_WEIGHTS.statisticalSignificance,
    description: `${significantCount}/${statisticalEvidence.length} comparisons statistically significant`,
  };
}

function computeEffectSizeFactor(evidence: CopilotEvidence[]): ConfidenceFactor {
  const statisticalEvidence = evidence.filter((e) => e.type === "statistical");

  if (statisticalEvidence.length === 0) {
    return {
      name: "Effect Sizes",
      score: 0.3,
      weight: FACTOR_WEIGHTS.effectSizes,
      description: "No effect size data available",
    };
  }

  let largeEffects = 0;
  let moderateEffects = 0;

  for (const e of statisticalEvidence) {
    const data = e.data as { effectSize?: number };
    if (data.effectSize !== undefined) {
      if (data.effectSize > 0.8) largeEffects++;
      else if (data.effectSize > 0.5) moderateEffects++;
    }
  }

  const total = statisticalEvidence.length;
  const score = 0.3 + ((largeEffects * 1.0 + moderateEffects * 0.7) / total) * 0.7;

  return {
    name: "Effect Sizes",
    score: Math.min(1, score),
    weight: FACTOR_WEIGHTS.effectSizes,
    description: `${largeEffects} large, ${moderateEffects} moderate effect sizes`,
  };
}

function computeReproducibilityFactor(context: CopilotContext): ConfidenceFactor {
  if (!context.reproducibility) {
    return {
      name: "Reproducibility",
      score: 0.3,
      weight: FACTOR_WEIGHTS.reproducibility,
      description: "No reproducibility data available",
    };
  }

  const score = context.reproducibility.overallScore;

  return {
    name: "Reproducibility",
    score,
    weight: FACTOR_WEIGHTS.reproducibility,
    description: `Reproducibility score: ${(score * 100).toFixed(0)}%`,
  };
}

function computeExperimentCoverageFactor(context: CopilotContext): ConfidenceFactor {
  if (!context.experimentPlanner) {
    return {
      name: "Experiment Coverage",
      score: 0.3,
      weight: FACTOR_WEIGHTS.experimentCoverage,
      description: "No planner data available",
    };
  }

  const score = context.experimentPlanner.coverageScore;

  return {
    name: "Experiment Coverage",
    score,
    weight: FACTOR_WEIGHTS.experimentCoverage,
    description: `Configuration coverage: ${(score * 100).toFixed(0)}%`,
  };
}

function computePlannerConfidenceFactor(context: CopilotContext): ConfidenceFactor {
  if (!context.experimentPlanner || context.experimentPlanner.topRecommendations.length === 0) {
    return {
      name: "Planner Confidence",
      score: 0.3,
      weight: FACTOR_WEIGHTS.plannerConfidence,
      description: "No planner recommendations available",
    };
  }

  const topRec = context.experimentPlanner.topRecommendations[0];
  const score = Math.min(1, topRec.expectedImprovement + 0.3);

  return {
    name: "Planner Confidence",
    score,
    weight: FACTOR_WEIGHTS.plannerConfidence,
    description: `Top recommendation expects ${(topRec.expectedImprovement * 100).toFixed(1)}% improvement`,
  };
}

function computeResearchConfidenceFactor(context: CopilotContext): ConfidenceFactor {
  if (!context.researchScientist || context.researchScientist.findings.length === 0) {
    return {
      name: "Research Confidence",
      score: 0.3,
      weight: FACTOR_WEIGHTS.researchConfidence,
      description: "No research findings available",
    };
  }

  const avgConfidence = context.researchScientist.findings.reduce(
    (sum, f) => sum + f.confidence,
    0
  ) / context.researchScientist.findings.length;

  return {
    name: "Research Confidence",
    score: avgConfidence,
    weight: FACTOR_WEIGHTS.researchConfidence,
    description: `Average finding confidence: ${(avgConfidence * 100).toFixed(0)}%`,
  };
}

function getConfidenceLabel(score: number): CopilotConfidence["label"] {
  if (score >= 0.8) return "very_high";
  if (score >= 0.6) return "high";
  if (score >= 0.4) return "medium";
  if (score >= 0.2) return "low";
  return "very_low";
}

export function getConfidenceColor(label: CopilotConfidence["label"]): string {
  const colors: Record<CopilotConfidence["label"], string> = {
    very_high: "text-green-500",
    high: "text-green-400",
    medium: "text-amber-500",
    low: "text-orange-500",
    very_low: "text-red-500",
  };
  return colors[label];
}

export function formatConfidence(confidence: CopilotConfidence): string {
  return `${(confidence.score * 100).toFixed(0)}% (${confidence.label.replace("_", " ")})`;
}
