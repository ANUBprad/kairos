export interface Evidence {
  metric: string;
  configs: string[];
  pValue: number;
  confidenceInterval: [number, number];
  effectSize: number;
  effectMagnitude: "negligible" | "small" | "medium" | "large";
  benchmarkIds: string[];
  reasoning: string;
  improvement: number;
  improvementPct: number;
}

export interface Finding {
  id: string;
  title: string;
  statement: string;
  evidence: Evidence[];
  confidence: number;
  interpretation: string;
  severity: "critical" | "high" | "medium" | "low";
  category: "performance" | "tradeoff" | "pattern" | "anomaly" | "comparison";
}

export interface DiscussionPoint {
  topic: string;
  observation: string;
  evidence: Evidence[];
  explanation: string;
  implications: string[];
}

export interface Threat {
  category: "internal" | "external" | "construct" | "conclusion";
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  mitigation: string;
  evidence: string[];
}

export interface FutureWorkItem {
  title: string;
  rationale: string;
  expectedImpact: string;
  priority: "high" | "medium" | "low";
  missingEvidence: string[];
  parameters: string[];
}

export interface ExecutiveSummary {
  overallConclusion: string;
  bestConfiguration: string;
  confidenceLevel: number;
  mostImportantFinding: string;
  mostSurprisingObservation: string;
  recommendedDeployment: string;
  researchConfidence: number;
  nextExperiment: string;
}

export interface ResearchPaper {
  abstract: string;
  executiveSummary: ExecutiveSummary;
  findings: Finding[];
  discussion: DiscussionPoint[];
  threats: Threat[];
  futureWork: FutureWorkItem[];
  conclusion: string;
  markdown: string;
  json: string;
}

export interface BenchmarkRunData {
  id: string;
  name: string | null;
  aggregatedMetrics: Record<string, number> | null;
  createdAt: Date;
  datasetName: string;
  questionCount: number;
  config: Record<string, unknown>;
  results: Array<{
    retrievalMetrics: Record<string, number> | null;
    generationMetrics: Record<string, number> | null;
    latencySearchMs: number | null;
  }>;
}

export interface ResearchScientistInput {
  runs: BenchmarkRunData[];
  datasetName: string;
  totalQuestions: number;
}

export interface Recommendation {
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  evidence: Evidence[];
  expectedImpact: string;
  confidence: number;
}
