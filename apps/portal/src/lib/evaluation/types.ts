export interface RetrievalMetrics {
  recallAtK: number;
  precisionAtK: number;
  hitRate: number;
  meanReciprocalRank: number;
  ndcg: number;
  k: number;
}

export interface GenerationMetrics {
  faithfulness: number;
  contextPrecision: number;
  contextRecall: number;
  answerRelevancy: number;
}

export interface MetricDefinition {
  id: string;
  name: string;
  category: "retrieval" | "generation";
  description: string;
  formula: string;
  whyItMatters: string;
  interpretation: string;
  range: [number, number];
  higherIsBetter: boolean;
}

export interface BenchmarkQuestionInput {
  question: string;
  expectedAnswer?: string;
  expectedContext?: string;
  referenceDocId?: string;
  metadata?: Record<string, unknown>;
}

export interface BenchmarkDatasetInput {
  name: string;
  description?: string;
  source?: string;
  knowledgeBaseId?: string;
  questions: BenchmarkQuestionInput[];
}

export interface ComparisonResult {
  configA: { label: string; metrics: EvaluationMetrics };
  configB: { label: string; metrics: EvaluationMetrics };
  winner: "A" | "B" | "tie";
  differences: Record<string, { a: number; b: number; diff: number; better: "A" | "B" | "tie" }>;
}

export interface StatisticalComparison {
  metricName: string;
  labelA: string;
  labelB: string;
  meanA: number;
  meanB: number;
  meanDifference: number;
  testUsed: string;
  statistic: number;
  pValue: number;
  significant: boolean;
  effectSize: number;
  effectMagnitude: "negligible" | "small" | "medium" | "large";
  effectMethod: string;
  ciLower: number;
  ciUpper: number;
  interpretation: string;
}

export interface LeaderboardTier {
  tier: number;
  labels: string[];
}

export interface ScientificLeaderboardEntry {
  rank: number;
  label: string;
  overallScore: number;
  isBest: boolean;
  recallAtK: number;
  precisionAtK: number;
  hitRate: number;
  mrr: number;
  ndcg: number;
  faithfulness?: number;
  latencyMs: number;
  tier: number;
  adjacentComparison?: {
    significant: boolean;
    pValue: number;
    ciLower: number;
    ciUpper: number;
    effectSize: number;
    effectMagnitude: string;
  };
}

export interface EvaluationMetrics {
  retrieval: RetrievalMetrics;
  generation?: GenerationMetrics;
  latency: {
    totalMs: number;
    embeddingMs: number;
    searchMs: number;
    promptMs: number;
    generationMs: number;
  };
  tokenUsage: {
    total: number;
    prompt: number;
    completion: number;
  };
  estimatedCost: number;
  chunkCount: number;
}

export interface EvaluationReport {
  title: string;
  date: string;
  systemConfig: {
    chunkStrategy: string;
    chunkSize: number;
    chunkOverlap: number;
    topK: number;
    similarityThreshold: number;
    embeddingModel: string;
    retrievalMode: string;
    embeddingProvider: string;
  };
  dataset: {
    name: string;
    questionCount: number;
  };
  metrics: EvaluationMetrics;
  observations: string[];
  recommendations: string[];
}

export const METRIC_DEFINITIONS: MetricDefinition[] = [
  {
    id: "recallAtK",
    name: "Recall@K",
    category: "retrieval",
    description: "Proportion of relevant documents retrieved among the top-K results.",
    formula: "Recall@K = |Relevant ∩ Retrieved@K| / |Relevant|",
    whyItMatters: "Measures how many relevant documents the system can find. High recall means fewer missed relevant documents.",
    interpretation: "1.0 means all relevant documents were retrieved. Lower values indicate missed relevant content.",
    range: [0, 1],
    higherIsBetter: true,
  },
  {
    id: "precisionAtK",
    name: "Precision@K",
    category: "retrieval",
    description: "Proportion of retrieved documents that are relevant among the top-K.",
    formula: "Precision@K = |Relevant ∩ Retrieved@K| / K",
    whyItMatters: "Measures how much noise is in the results. High precision means fewer irrelevant documents retrieved.",
    interpretation: "1.0 means every retrieved document was relevant. Lower values indicate irrelevant content in results.",
    range: [0, 1],
    higherIsBetter: true,
  },
  {
    id: "hitRate",
    name: "Hit Rate",
    category: "retrieval",
    description: "Proportion of queries where at least one relevant document was retrieved.",
    formula: "Hit Rate = QueriesWithRelevantResults / TotalQueries",
    whyItMatters: "Indicates whether the system can find relevant content at all for each query.",
    interpretation: "1.0 means every query found relevant content. Lower values mean some queries failed entirely.",
    range: [0, 1],
    higherIsBetter: true,
  },
  {
    id: "meanReciprocalRank",
    name: "MRR",
    category: "retrieval",
    description: "Average of reciprocal ranks of the first relevant document for each query.",
    formula: "MRR = (1/N) * Σ(1 / rank_of_first_relevant)",
    whyItMatters: "Measures how quickly the system finds the first relevant result. Important for question answering.",
    interpretation: "1.0 means the first result was always relevant. Higher values mean relevant docs appear earlier.",
    range: [0, 1],
    higherIsBetter: true,
  },
  {
    id: "ndcg",
    name: "nDCG",
    category: "retrieval",
    description: "Normalized Discounted Cumulative Gain — measures ranking quality with graded relevance.",
    formula: "nDCG@K = DCG@K / IDCG@K",
    whyItMatters: "Accounts for multiple relevance levels and penalizes relevant documents ranked lower.",
    interpretation: "1.0 means perfect ranking. Considers both relevance and position in results.",
    range: [0, 1],
    higherIsBetter: true,
  },
  {
    id: "faithfulness",
    name: "Faithfulness",
    category: "generation",
    description: "Measures whether the generated answer is factually consistent with the retrieved context.",
    formula: "Faithfulness = ConsistentClaims / TotalClaims",
    whyItMatters: "Ensures the LLM does not hallucinate or invent information not present in the retrieved context.",
    interpretation: "1.0 means all claims are supported by context. Lower values indicate hallucination.",
    range: [0, 1],
    higherIsBetter: true,
  },
  {
    id: "contextPrecision",
    name: "Context Precision",
    category: "generation",
    description: "Measures whether the retrieved context contains only relevant information for the answer.",
    formula: "Context Precision = RelevantSentences / TotalSentencesInContext",
    whyItMatters: "High context precision means the retrieval system provides focused, useful context without noise.",
    interpretation: "1.0 means every sentence in the context was useful. Lower values indicate irrelevant context.",
    range: [0, 1],
    higherIsBetter: true,
  },
  {
    id: "contextRecall",
    name: "Context Recall",
    category: "generation",
    description: "Measures whether the retrieved context contains all needed information to answer the question.",
    formula: "Context Recall = InformationPresentInContext / InformationNeeded",
    whyItMatters: "Ensures the retrieval system captures all relevant information needed for a complete answer.",
    interpretation: "1.0 means all needed info was in context. Lower values mean missing critical information.",
    range: [0, 1],
    higherIsBetter: true,
  },
  {
    id: "answerRelevancy",
    name: "Answer Relevancy",
    category: "generation",
    description: "Measures how relevant the generated answer is to the original question.",
    formula: "AnswerRelevancy = 1 - (GeneratedQuestionsNotRelevant / TotalGeneratedQuestions)",
    whyItMatters: "Ensures the LLM stays on topic and addresses the user's actual query.",
    interpretation: "1.0 means the answer is perfectly relevant. Lower values indicate off-topic responses.",
    range: [0, 1],
    higherIsBetter: true,
  },
];
