export interface ExperimentManifest {
  manifestVersion: string;
  manifestId: string;
  createdAt: string;
  experimentName: string;
  description: string;
  author: string;
  tags: string[];
  dataset: {
    id: string;
    name: string;
    source: string;
    questionCount: number;
    checksum: string;
  };
  pipeline: {
    chunking: PipelineStage;
    embedding: PipelineStage;
    retrieval: PipelineStage;
    reranking: PipelineStage | null;
    prompt: PipelineStage;
    generation: PipelineStage;
    evaluation: PipelineStage;
  };
  config: Record<string, unknown>;
  results: ExperimentResults;
  metadata: {
    kairosVersion: string;
    environment: Record<string, string>;
    dependencies: Record<string, string>;
  };
}

export interface PipelineStage {
  name: string;
  version: string;
  parameters: Record<string, unknown>;
  description: string;
}

export interface ExperimentResults {
  aggregatedMetrics: Record<string, number>;
  perQuestionMetrics: Array<{
    questionId: string;
    question: string;
    retrievalMetrics: Record<string, number> | null;
    generationMetrics: Record<string, number> | null;
    latencyMs: number;
  }>;
  statisticalSummary: {
    meanMetrics: Record<string, number>;
    stdMetrics: Record<string, number>;
    minMetrics: Record<string, number>;
    maxMetrics: Record<string, number>;
  };
}

export interface ConfigurationDiff {
  configA: {
    id: string;
    name: string;
    timestamp: string;
  };
  configB: {
    id: string;
    name: string;
    timestamp: string;
  };
  differences: ConfigDifference[];
  metricDifferences: MetricDifference[];
  statisticalDifferences: StatisticalDifference[];
  summary: DiffSummary;
}

export interface ConfigDifference {
  path: string;
  label: string;
  valueA: unknown;
  valueB: unknown;
  type: "added" | "removed" | "changed";
  category: "chunking" | "embedding" | "retrieval" | "reranking" | "prompt" | "generation" | "evaluation" | "system";
}

export interface MetricDifference {
  metric: string;
  label: string;
  valueA: number;
  valueB: number;
  absoluteDifference: number;
  relativeDifference: number;
  direction: "improved" | "degraded" | "unchanged";
  magnitude: "negligible" | "small" | "medium" | "large";
}

export interface StatisticalDifference {
  metric: string;
  label: string;
  testUsed: string;
  pValue: number;
  significant: boolean;
  effectSize: number;
  effectMagnitude: "negligible" | "small" | "medium" | "large";
  confidenceInterval: [number, number];
  interpretation: string;
}

export interface DiffSummary {
  totalParameters: number;
  changedParameters: number;
  addedParameters: number;
  removedParameters: number;
  metricsCompared: number;
  metricsImproved: number;
  metricsDegraded: number;
  metricsUnchanged: number;
  statisticallySignificant: number;
  overallAssessment: "identical" | "minor" | "moderate" | "major" | "completely_different";
}

export interface LineageNode {
  id: string;
  type: LineageNodeType;
  name: string;
  version: string;
  description: string;
  timestamp: string;
  parameters: Record<string, unknown>;
  dependencies: string[];
  metrics: Record<string, number> | null;
  metadata: Record<string, unknown>;
}

export type LineageNodeType =
  | "dataset"
  | "chunking"
  | "embedding"
  | "retrieval"
  | "reranking"
  | "prompt"
  | "generation"
  | "evaluation"
  | "report"
  | "manifest";

export interface LineageEdge {
  id: string;
  source: string;
  target: string;
  type: "produced_by" | "used_by" | "evaluated_by" | "generated_from";
  metadata: Record<string, unknown>;
}

export interface LineageGraph {
  nodes: LineageNode[];
  edges: LineageEdge[];
  rootNodes: string[];
  leafNodes: string[];
  metadata: {
    manifestId: string;
    createdAt: string;
    totalNodes: number;
    totalEdges: number;
  };
}

export interface ProvenanceRecord {
  id: string;
  timestamp: string;
  action: ProvenanceAction;
  actor: string;
  inputs: string[];
  outputs: string[];
  parameters: Record<string, unknown>;
  checksum: string;
  parentProvenanceId: string | null;
}

export type ProvenanceAction =
  | "created"
  | "modified"
  | "executed"
  | "evaluated"
  | "analyzed"
  | "exported"
  | "imported";

export interface ProvenanceChain {
  records: ProvenanceRecord[];
  chainId: string;
  startTimestamp: string;
  endTimestamp: string;
  integrity: boolean;
}

export interface ReproducibilityScore {
  overall: number;
  breakdown: {
    configCompleteness: number;
    dataProvenance: number;
    environmentCapture: number;
    dependencyLock: number;
    resultDeterminism: number;
    documentationQuality: number;
  };
  factors: ReproducibilityFactor[];
  recommendations: string[];
}

export interface ReproducibilityFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
  evidence: string[];
}

export interface Citation {
  id: string;
  type: CitationType;
  title: string;
  authors: string[];
  year: number;
  venue: string;
  doi: string | null;
  url: string | null;
  accessedAt: string;
  bibtex: string;
  apa: string;
}

export type CitationType =
  | "dataset"
  | "model"
  | "library"
  | "paper"
  | "benchmark"
  | "configuration";

export interface CitationCollection {
  citations: Citation[];
  manifestId: string;
  generatedAt: string;
  bibtexFile: string;
  apaReferences: string;
}
