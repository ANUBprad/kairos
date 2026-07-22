export interface Experiment {
  id: string;
  name: string;
  description: string;
  status: "draft" | "running" | "completed" | "failed" | "archived";
  datasetId: string;
  datasetName: string;
  knowledgeBaseId: string;
  knowledgeBaseName: string;
  embeddingModel: string;
  retriever: string;
  reranker: string;
  llm: string;
  promptTemplate: string;
  chunkStrategy: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  retrievalMode: string;
  tags: string[];
  isFavorite: boolean;
  isArchived: boolean;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  runtimeMs?: number;
  cost?: number;
  owner: string;
  metrics?: ExperimentMetrics;
  evaluation?: ExperimentEvaluation;
  timeline?: ExperimentTimelineEvent[];
}

export interface ExperimentMetrics {
  recallAtK: number;
  precisionAtK: number;
  mrr: number;
  ndcg: number;
  faithfulness: number;
  answerRelevancy: number;
  contextPrecision: number;
  contextRecall: number;
  groundedness: number;
  hallucinationRate: number;
  citationAccuracy: number;
  retrievalSuccessRate: number;
  latencyMs: number;
  embeddingCost: number;
  generationCost: number;
  totalCost: number;
  tokenUsage: TokenUsage;
  [key: string]: number | TokenUsage;
}

export interface TokenUsage {
  embeddingTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ExperimentEvaluation {
  faithfulness: MetricScore;
  answerRelevancy: MetricScore;
  contextPrecision: MetricScore;
  contextRecall: MetricScore;
  groundedness: MetricScore;
  latency: MetricScore;
  cost: MetricScore;
  tokenUsage: MetricScore;
  citationCoverage: MetricScore;
  retrievalSuccessRate: MetricScore;
}

export interface MetricScore {
  score: number;
  label: string;
  description: string;
  formula: string;
  whyItMatters: string;
  interpretation: string;
  range: [number, number];
  higherIsBetter: boolean;
}

export interface ExperimentTimelineEvent {
  id: string;
  type: "created" | "started" | "embedding" | "indexing" | "retrieval" | "generation" | "evaluation" | "completed" | "failed" | "retried" | "comparison_created";
  label: string;
  description: string;
  timestamp: string;
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

export interface ExperimentComparison {
  id: string;
  experimentAId: string;
  experimentBId: string;
  experimentA: Experiment;
  experimentB: Experiment;
  metrics: ComparisonMetrics;
  createdAt: string;
}

export interface ComparisonMetrics {
  recallAtK: ComparisonValue;
  precisionAtK: ComparisonValue;
  mrr: ComparisonValue;
  ndcg: ComparisonValue;
  faithfulness: ComparisonValue;
  answerRelevancy: ComparisonValue;
  contextPrecision: ComparisonValue;
  contextRecall: ComparisonValue;
  groundedness: ComparisonValue;
  hallucinationRate: ComparisonValue;
  citationAccuracy: ComparisonValue;
  retrievalSuccessRate: ComparisonValue;
  latency: ComparisonValue;
  tokenUsage: ComparisonValue;
  embeddingCost: ComparisonValue;
  generationCost: ComparisonValue;
  totalCost: ComparisonValue;
  totalTokens: ComparisonValue;
  [key: string]: ComparisonValue;
}

export interface ComparisonValue {
  a: number;
  b: number;
  delta: number;
  percentChange: number;
  winner: "a" | "b" | "tie";
}

export interface EvaluationDataset {
  id: string;
  name: string;
  description: string;
  version: number;
  questionCount: number;
  questions: EvaluationQuestion[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EvaluationQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
  relevantDocumentIds: string[];
  relevantChunkIds: string[];
  difficulty: "easy" | "medium" | "hard";
  topic: string;
  tags: string[];
  notes: string;
}

export interface BenchmarkRun {
  id: string;
  experimentId: string;
  datasetId: string;
  status: "pending" | "running" | "completed" | "failed";
  strategy: string;
  config: BenchmarkConfig;
  metrics: ExperimentMetrics;
  perQuestionResults: QuestionResult[];
  startedAt: string;
  completedAt?: string;
  runtimeMs?: number;
  error?: string;
}

export interface BenchmarkConfig {
  chunkStrategy: string;
  chunkSize: number;
  chunkOverlap: number;
  topK: number;
  similarityThreshold: number;
  embeddingModel: string;
  retrievalMode: string;
  retrievalStrategy?: string;
  queryExpansion?: boolean;
  multiQuery?: boolean;
  reranking?: boolean;
  compression?: boolean;
}

export interface QuestionResult {
  questionId: string;
  question: string;
  expectedAnswer: string;
  generatedAnswer: string;
  retrievedChunks: string[];
  relevantChunks: string[];
  metrics: {
    recallAtK: number;
    precisionAtK: number;
    mrr: number;
    ndcg: number;
    faithfulness: number;
    answerRelevancy: number;
  };
  latencyMs: number;
  tokenUsage: TokenUsage;
}

export interface FailureCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  count: number;
  examples: FailureExample[];
  recommendations: string[];
}

export interface FailureExample {
  questionId: string;
  question: string;
  expectedAnswer: string;
  actualAnswer: string;
  severity: "low" | "medium" | "high";
  metrics: Record<string, number>;
}

export interface BenchmarkStrategy {
  id: string;
  name: string;
  description: string;
  speed: number;
  quality: number;
  memory: number;
  cost: number;
  metrics: ExperimentMetrics;
}

export interface Insight {
  id: string;
  type: "suggestion" | "warning" | "info" | "success";
  title: string;
  description: string;
  metric?: string;
  improvement?: string;
  confidence: number;
  priority: "low" | "medium" | "high";
  actionable: boolean;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  color?: string;
  metadata?: Record<string, unknown>;
}

export interface RadarDataPoint {
  metric: string;
  value: number;
  maxValue: number;
}

export interface TrendDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface HeatmapCell {
  row: string;
  column: string;
  value: number;
  color?: string;
}

export type MetricKey =
  | "recallAtK"
  | "precisionAtK"
  | "mrr"
  | "ndcg"
  | "faithfulness"
  | "answerRelevancy"
  | "contextPrecision"
  | "contextRecall"
  | "groundedness"
  | "hallucinationRate"
  | "citationAccuracy"
  | "retrievalSuccessRate"
  | "latencyMs"
  | "totalCost"
  | "totalTokens";

export const METRIC_CONFIG: Record<MetricKey, { label: string; shortLabel: string; higherIsBetter: boolean; format: "percent" | "number" | "currency" | "duration" | "tokens"; description: string; formula: string; whyItMatters: string }> = {
  recallAtK: { label: "Recall@K", shortLabel: "Recall", higherIsBetter: true, format: "percent", description: "Proportion of relevant documents retrieved in top-K results", formula: "|Retrieved ∩ Relevant| / |Relevant|", whyItMatters: "Measures completeness of retrieval — are we finding what matters?" },
  precisionAtK: { label: "Precision@K", shortLabel: "Precision", higherIsBetter: true, format: "percent", description: "Proportion of retrieved documents that are relevant", formula: "|Retrieved ∩ Relevant| / |Retrieved|", whyItMatters: "Measures retrieval precision — are we avoiding noise?" },
  mrr: { label: "Mean Reciprocal Rank", shortLabel: "MRR", higherIsBetter: true, format: "percent", description: "Average reciprocal rank of the first relevant result", formula: "1/|Q| × Σ(1/rank_i)", whyItMatters: "How quickly does the system find the right answer?" },
  ndcg: { label: "Normalized Discounted Cumulative Gain", shortLabel: "nDCG", higherIsBetter: true, format: "percent", description: "Ranking quality accounting for position-dependent gains", formula: "DCG@K / IDCG@K", whyItMatters: "Are the most relevant results ranked highest?" },
  faithfulness: { label: "Faithfulness", shortLabel: "Faith", higherIsBetter: true, format: "percent", description: "Degree to which the answer is supported by retrieved context", formula: "|Supported claims| / |Total claims|", whyItMatters: "Prevents hallucination — is the answer grounded in facts?" },
  answerRelevancy: { label: "Answer Relevancy", shortLabel: "Relevancy", higherIsBetter: true, format: "percent", description: "How well the answer addresses the original question", formula: "Semantic similarity(Q, A)", whyItMatters: "Is the answer actually useful for the question?" },
  contextPrecision: { label: "Context Precision", shortLabel: "Ctx Prec", higherIsBetter: true, format: "percent", description: "Precision of the retrieved context for the expected answer", formula: "|Relevant in context| / |Context chunks|", whyItMatters: "Is the context focused and relevant?" },
  contextRecall: { label: "Context Recall", shortLabel: "Ctx Recall", higherIsBetter: true, format: "percent", description: "Coverage of the expected answer by retrieved context", formula: "|Expected covered by context| / |Expected total|", whyItMatters: "Does the context contain enough info to answer?" },
  groundedness: { label: "Groundedness", shortLabel: "Ground", higherIsBetter: true, format: "percent", description: "Degree to which claims in the answer are grounded in context", formula: "|Grounded claims| / |Total claims|", whyItMatters: "Is the answer trustworthy and verifiable?" },
  hallucinationRate: { label: "Hallucination Rate", shortLabel: "Halluc", higherIsBetter: false, format: "percent", description: "Rate of unsupported or fabricated claims in answers", formula: "|Unsupported claims| / |Total claims|", whyItMatters: "Lower hallucination = more reliable system" },
  citationAccuracy: { label: "Citation Accuracy", shortLabel: "Cite Acc", higherIsBetter: true, format: "percent", description: "Accuracy of citations referenced in answers", formula: "|Correct citations| / |Total citations|", whyItMatters: "Can users verify the system's claims?" },
  retrievalSuccessRate: { label: "Retrieval Success Rate", shortLabel: "Ret Success", higherIsBetter: true, format: "percent", description: "Rate at which relevant documents appear in top-K results", formula: "|Queries with relevant in top-K| / |Total queries|", whyItMatters: "Overall retrieval reliability metric" },
  latencyMs: { label: "Latency", shortLabel: "Latency", higherIsBetter: false, format: "duration", description: "End-to-end response time in milliseconds", formula: "P50/P95/P99 of response times", whyItMatters: "User experience depends on fast responses" },
  totalCost: { label: "Total Cost", shortLabel: "Cost", higherIsBetter: false, format: "currency", description: "Total API cost per query (embedding + generation)", formula: "embedding_cost + generation_cost", whyItMatters: "Cost efficiency at scale" },
  totalTokens: { label: "Total Tokens", shortLabel: "Tokens", higherIsBetter: false, format: "tokens", description: "Total token consumption per query", formula: "embedding_tokens + prompt_tokens + completion_tokens", whyItMatters: "Token efficiency affects cost and latency" },
};

export const ALL_METRIC_KEYS = Object.keys(METRIC_CONFIG) as MetricKey[];

export function formatMetricValue(value: number, format: "percent" | "number" | "currency" | "duration" | "tokens"): string {
  switch (format) {
    case "percent": return `${(value * 100).toFixed(1)}%`;
    case "currency": return `$${value.toFixed(4)}`;
    case "duration": return value < 1000 ? `${value.toFixed(0)}ms` : `${(value / 1000).toFixed(2)}s`;
    case "tokens": return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(0);
    default: return value.toFixed(3);
  }
}

export function getMetricColor(value: number, higherIsBetter: boolean): string {
  if (higherIsBetter) {
    if (value >= 0.9) return "text-success";
    if (value >= 0.7) return "text-brand";
    if (value >= 0.5) return "text-warning";
    return "text-error";
  }
  if (value <= 0.1) return "text-success";
  if (value <= 0.3) return "text-brand";
  if (value <= 0.5) return "text-warning";
  return "text-error";
}

export function getStatusColor(status: Experiment["status"]): string {
  switch (status) {
    case "completed": return "text-success";
    case "running": return "text-brand";
    case "failed": return "text-error";
    case "archived": return "text-text-tertiary";
    default: return "text-text-secondary";
  }
}

export function getStatusLabel(status: Experiment["status"]): string {
  switch (status) {
    case "draft": return "Draft";
    case "running": return "Running";
    case "completed": return "Completed";
    case "failed": return "Failed";
    case "archived": return "Archived";
    default: return status;
  }
}
