export type {
  ConfigurationDimension,
  ConfigurationSpace,
  ExperimentPoint,
  CoverageAnalysis,
  UncertaintyEstimate,
  ParetoPoint,
  ParetoFrontier,
  InformationGainEstimate,
  ExperimentCostEstimate,
  ExperimentRecommendation,
  ExperimentQueue,
  PlannerResult,
  PlannerInput,
} from "./types";

export {
  analyzeConfigurationSpace,
  generateAllCombinations,
  configToKey,
  keyToConfig,
  getExploredConfigs,
  findNearestNeighbor,
  configDistance,
} from "./config-space";

export {
  calculateCoverage,
  identifyCoverageGaps,
} from "./coverage";

export {
  estimateUncertainty,
  estimateUncertainties,
  computeUncertaintyReduction,
} from "./uncertainty";

export {
  generateParetoFrontier,
  findKneePoint,
  computeHypervolume,
} from "./pareto";

export {
  estimateInformationGain,
  rankByInformationGain,
} from "./information-gain";

export {
  prioritizeExperiments,
} from "./prioritizer";

export {
  planCostQuality,
  estimateTotalCost,
  optimizeQueueForBudget,
} from "./cost-quality";
