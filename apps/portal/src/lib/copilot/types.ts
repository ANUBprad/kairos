export type CopilotIntent =
  | "explain"
  | "learn"
  | "debug"
  | "compare"
  | "recommend"
  | "plan"
  | "optimize"
  | "interpret"
  | "summarize"
  | "explore"
  | "review"
  | "validate";

export interface IntentDetectionResult {
  intent: CopilotIntent;
  confidence: number;
  entities: IntentEntity[];
  subIntents: CopilotIntent[];
}

export interface IntentEntity {
  type: "metric" | "config" | "experiment" | "dataset" | "concept" | "comparison" | "constraint";
  value: string;
  start: number;
  end: number;
}

export interface CopilotContext {
  knowledgeBase: KnowledgeBaseContext | null;
  currentExperiment: ExperimentContext | null;
  benchmarkHistory: BenchmarkContext[];
  leaderboard: LeaderboardContext;
  statisticalComparisons: StatisticalComparisonContext[];
  researchScientist: ResearchScientistContext | null;
  experimentPlanner: ExperimentPlannerContext | null;
  retrievalDebugger: RetrievalDebuggerContext | null;
  reproducibility: ReproducibilityContext | null;
  currentConfiguration: ConfigurationContext;
  promptHistory: PromptContext[];
  conversationContext: ConversationContext;
}

export interface KnowledgeBaseContext {
  id: string;
  name: string;
  documentCount: number;
  chunkCount: number;
  embeddingCount: number;
}

export interface ExperimentContext {
  id: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
  metrics: Record<string, number>;
  startedAt: string;
}

export interface BenchmarkContext {
  id: string;
  name: string;
  datasetName: string;
  questionCount: number;
  metrics: Record<string, number>;
  createdAt: string;
}

export interface LeaderboardContext {
  entries: LeaderboardEntry[];
  topConfig: string;
  totalExperiments: number;
}

export interface LeaderboardEntry {
  rank: number;
  configName: string;
  metrics: Record<string, number>;
  benchmarkCount: number;
}

export interface StatisticalComparisonContext {
  metric: string;
  configA: string;
  configB: string;
  pValue: number;
  significant: boolean;
  effectSize: number;
  improvement: number;
}

export interface ResearchScientistContext {
  findings: Array<{
    title: string;
    confidence: number;
    severity: string;
  }>;
  threats: Array<{
    title: string;
    impact: string;
  }>;
  recommendations: Array<{
    title: string;
    priority: string;
  }>;
}

export interface ExperimentPlannerContext {
  coverageScore: number;
  totalCombinations: number;
  exploredCombinations: number;
  topRecommendations: Array<{
    rationale: string;
    expectedImprovement: number;
    priority: string;
  }>;
}

export interface RetrievalDebuggerContext {
  lastTraceId: string | null;
  commonIssues: string[];
}

export interface ReproducibilityContext {
  overallScore: number;
  manifestCount: number;
  provenanceActive: boolean;
}

export interface ConfigurationContext {
  retrievalMode: string;
  embeddingModel: string;
  chunkSize: number;
  topK: number;
  reranker: string;
  temperature: number;
}

export interface PromptContext {
  id: string;
  template: string;
  usedAt: string;
  metrics: Record<string, number> | null;
}

export interface ConversationContext {
  messageCount: number;
  previousIntents: CopilotIntent[];
  currentObjective: string | null;
  constraints: ConversationConstraints;
}

export interface ConversationConstraints {
  budgetMs: number | null;
  budgetTokens: number | null;
  maxExperiments: number | null;
  priorityMetric: string | null;
  focusArea: string | null;
}

export interface CopilotEvidence {
  type: EvidenceType;
  source: string;
  data: unknown;
  relevance: number;
  timestamp: string;
}

export type EvidenceType =
  | "benchmark"
  | "statistical"
  | "metric"
  | "config"
  | "finding"
  | "recommendation"
  | "threat"
  | "debugger"
  | "provenance"
  | "planner";

export interface CopilotResponse {
  answer: string;
  evidence: CopilotEvidence[];
  confidence: CopilotConfidence;
  relatedExperiments: string[];
  relatedBenchmarks: string[];
  relatedReports: string[];
  suggestedFollowUp: string[];
  intent: CopilotIntent;
}

export interface CopilotConfidence {
  score: number;
  factors: ConfidenceFactor[];
  label: "very_low" | "low" | "medium" | "high" | "very_high";
}

export interface ConfidenceFactor {
  name: string;
  score: number;
  weight: number;
  description: string;
}

export interface SuggestedQuestion {
  id: string;
  question: string;
  intent: CopilotIntent;
  relevance: number;
  reasoning: string;
}

export interface ResearchTimelineEvent {
  id: string;
  type: TimelineEventType;
  title: string;
  description: string;
  timestamp: string;
  metrics: Record<string, number> | null;
  significance: "high" | "medium" | "low";
}

export type TimelineEventType =
  | "knowledge_base_created"
  | "documents_uploaded"
  | "chunking_configured"
  | "retrieval_tested"
  | "benchmark_run"
  | "experiment_completed"
  | "finding_discovered"
  | "recommendation_made"
  | "milestone_reached";

export interface DailyBrief {
  date: string;
  totalExperiments: number;
  experimentsToday: number;
  confidenceChange: number;
  topFinding: string;
  weakestBenchmark: string;
  recommendedExperiment: string;
  researchDirection: string;
}

export interface MemorySnapshot {
  currentProject: string | null;
  currentBenchmark: string | null;
  currentExperiment: string | null;
  previousQuestions: string[];
  currentObjective: string | null;
  currentDataset: string | null;
  constraints: ConversationConstraints;
  lastUpdated: string;
}

export interface CopilotRequest {
  query: string;
  userId?: string;
  context?: Partial<CopilotContext>;
  constraints?: Partial<ConversationConstraints>;
}

export interface AdvisorRecommendation {
  category: "performance" | "efficiency" | "coverage" | "reproducibility" | "statistical";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  expectedImpact: string;
  actions: string[];
  evidence: string[];
}

export interface ResearchPlan {
  title: string;
  objective: string;
  steps: Array<{
    step: number;
    title: string;
    description: string;
    estimatedDuration: string;
    expectedOutcome: string;
    dependencies: number[];
    configuration?: Record<string, unknown>;
  }>;
  totalEstimatedDuration: string;
  expectedOutcome: string;
  risks: string[];
  alternatives: string[];
  successCriteria: string[];
}

export interface PromptBuilderInput {
  intent: IntentDetectionResult;
  context: CopilotContext;
  evidence: CopilotEvidence[];
  query: string;
}
