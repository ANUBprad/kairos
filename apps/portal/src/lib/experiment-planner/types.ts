export interface ConfigurationDimension {
  name: string;
  type: "categorical" | "numeric" | "boolean";
  values: (string | number | boolean)[];
  defaultValue: string | number | boolean;
  description: string;
}

export interface ConfigurationSpace {
  dimensions: ConfigurationDimension[];
  totalCombinations: number;
}

export interface ExperimentPoint {
  id: string;
  config: Record<string, string | number | boolean>;
  metrics: Record<string, number>;
  timestamp: string;
  costMs: number;
}

export interface CoverageAnalysis {
  totalCombinations: number;
  exploredCombinations: number;
  coverageScore: number;
  dimensionCoverage: Array<{
    dimension: string;
    exploredValues: number;
    totalValues: number;
    coverage: number;
  }>;
  unexploredCombinations: Array<Record<string, string | number | boolean>>;
}

export interface UncertaintyEstimate {
  config: Record<string, string | number | boolean>;
  metric: string;
  predictedValue: number;
  uncertainty: number;
  confidenceInterval: [number, number];
  nearbyExperiments: number;
  distanceToNearest: number;
}

export interface ParetoPoint {
  id: string;
  config: Record<string, string | number | boolean>;
  objectives: Record<string, number>;
  isDominated: boolean;
  rank: number;
}

export interface ParetoFrontier {
  points: ParetoPoint[];
  frontierPoints: ParetoPoint[];
  dimensions: string[];
  dominatedCount: number;
  frontierCount: number;
}

export interface InformationGainEstimate {
  config: Record<string, string | number | boolean>;
  expectedGain: number;
  gainType: "exploration" | "exploitation" | "uncertainty_reduction";
  reasoning: string;
  affectedMetrics: string[];
}

export interface ExperimentCostEstimate {
  config: Record<string, string | number | boolean>;
  estimatedLatencyMs: number;
  estimatedTokenCost: number;
  estimatedTotalCost: number;
  costFactors: Array<{
    factor: string;
    contribution: number;
  }>;
}

export interface ExperimentRecommendation {
  id: string;
  rank: number;
  config: Record<string, string | number | boolean>;
  expectedImprovement: number;
  confidence: number;
  statisticalBasis: string;
  expectedInformationGain: number;
  estimatedCost: ExperimentCostEstimate;
  priority: "high" | "medium" | "low";
  rationale: string;
  affectedMetrics: string[];
  paretoOptimal: boolean;
}

export interface ExperimentQueue {
  recommendations: ExperimentRecommendation[];
  totalEstimatedCost: number;
  totalEstimatedTimeMs: number;
  expectedOverallImprovement: number;
}

export interface PlannerResult {
  space: ConfigurationSpace;
  coverage: CoverageAnalysis;
  uncertainties: UncertaintyEstimate[];
  pareto: ParetoFrontier;
  recommendations: ExperimentRecommendation[];
  queue: ExperimentQueue;
  summary: {
    exploredRatio: number;
    bestEstimatedImprovement: number;
    criticalGaps: string[];
    researchDirection: string;
  };
}

export interface PlannerInput {
  runs: Array<{
    id: string;
    config: Record<string, unknown>;
    metrics: Record<string, number>;
    timestamp: string;
    costMs?: number;
  }>;
  objectives: string[];
  budgetMs?: number;
  budgetTokens?: number;
}
