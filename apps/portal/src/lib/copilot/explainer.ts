import type { CopilotContext, CopilotEvidence } from "./types";

interface ExplanationInput {
  concept: string;
  context: CopilotContext;
  evidence: CopilotEvidence[];
}

interface ConceptExplanation {
  concept: string;
  definition: string;
  howItWorks: string;
  whyItMatters: string;
  inYourExperiments: string;
  relatedConcepts: string[];
}

const CONCEPT_DEFINITIONS: Record<string, { definition: string; howItWorks: string; whyItMatters: string }> = {
  recall: {
    definition: "Recall@K measures the proportion of relevant documents retrieved in the top K results.",
    howItWorks: "If there are 10 relevant documents and 8 appear in top K, Recall@K = 0.8.",
    whyItMatters: "Higher recall means fewer relevant documents are missed. Critical for comprehensive answers.",
  },
  precision: {
    definition: "Precision@K measures the proportion of retrieved documents that are actually relevant.",
    howItWorks: "If 5 of top 10 retrieved documents are relevant, Precision@10 = 0.5.",
    whyItMatters: "Higher precision means less noise. Important for concise, focused answers.",
  },
  mrr: {
    definition: "Mean Reciprocal Rank measures how early the first relevant result appears.",
    howItWorks: "If the first relevant result is at position 3, RR = 1/3. MRR averages this across queries.",
    whyItMatters: "Users rarely look past the first few results. MRR captures first-hit quality.",
  },
  ndcg: {
    definition: "Normalized Discounted Cumulative Gain measures ranking quality with graded relevance.",
    howItWorks: "Relevant documents higher in the ranking contribute more. Normalized by ideal ranking.",
    whyItMatters: "Considers both relevance and position. Gold standard for ranking evaluation.",
  },
  "hit rate": {
    definition: "Hit Rate@K is the fraction of queries where at least one relevant document appears in top K.",
    howItWorks: "If 80 of 100 queries have at least one relevant doc in top 5, Hit Rate@5 = 0.8.",
    whyItMatters: "Simple, interpretable metric. Measures whether the system finds anything useful.",
  },
  faithfulness: {
    definition: "Faithfulness measures how much the generated answer is grounded in the retrieved context.",
    howItWorks: "An LLM judges whether each claim in the answer is supported by the context.",
    whyItMatters: "Prevents hallucination. Ensures answers are based on actual documents.",
  },
  "answer relevancy": {
    definition: "Answer Relevancy measures how well the generated answer addresses the user's question.",
    howItWorks: "An LLM judges whether the answer is on-topic and complete.",
    whyItMatters: "Ensures the system answers the actual question, not a related one.",
  },
  latency: {
    definition: "Latency is the time taken to process a query and generate a response.",
    howItWorks: "Measured in milliseconds from query submission to response delivery.",
    whyItMatters: "User experience depends on fast responses. Critical for production deployment.",
  },
  hybrid: {
    definition: "Hybrid retrieval combines multiple retrieval methods (e.g., vector + BM25).",
    howItWorks: "Results from each method are merged using weighted scoring or reciprocal rank fusion.",
    whyItMatters: "Often outperforms single methods by leveraging complementary strengths.",
  },
  chunking: {
    definition: "Chunking is the process of splitting documents into smaller segments for indexing.",
    howItWorks: "Documents are split by size, semantic boundaries, or custom rules.",
    whyItMatters: "Chunk quality directly affects retrieval accuracy and answer quality.",
  },
  embedding: {
    definition: "Embeddings are dense vector representations of text that capture semantic meaning.",
    howItWorks: "Neural networks convert text to high-dimensional vectors where similar texts are close.",
    whyItMatters: "Embedding quality determines how well semantic similarity is captured.",
  },
  reranking: {
    definition: "Reranking re-orders retrieved documents using a more powerful model.",
    howItWorks: "A cross-encoder or learned model scores each document-query pair.",
    whyItMatters: "Can significantly improve precision by better distinguishing relevant documents.",
  },
  pareto: {
    definition: "Pareto optimality identifies solutions where no objective can be improved without degrading another.",
    howItWorks: "Points not dominated by any other point form the Pareto frontier.",
    whyItMatters: "Shows optimal trade-offs between competing objectives (e.g., accuracy vs. latency).",
  },
};

export function explainConcept(input: ExplanationInput): ConceptExplanation {
  const { concept, context, evidence } = input;
  const conceptLower = concept.toLowerCase();

  let definition = "";
  let howItWorks = "";
  let whyItMatters = "";

  for (const [key, value] of Object.entries(CONCEPT_DEFINITIONS)) {
    if (conceptLower.includes(key) || key.includes(conceptLower)) {
      definition = value.definition;
      howItWorks = value.howItWorks;
      whyItMatters = value.whyItMatters;
      break;
    }
  }

  if (!definition) {
    definition = `${concept} is a concept or metric used in RAG system evaluation and optimization.`;
    howItWorks = "Detailed explanation requires domain-specific context.";
    whyItMatters = "Understanding this concept helps improve your RAG system.";
  }

  const inYourExperiments = generatePersonalizedExplanation(concept, context, evidence);
  const relatedConcepts = findRelatedConcepts(conceptLower);

  return {
    concept,
    definition,
    howItWorks,
    whyItMatters,
    inYourExperiments,
    relatedConcepts,
  };
}

function generatePersonalizedExplanation(
  concept: string,
  context: CopilotContext,
  _evidence: CopilotEvidence[]
): string {
  const parts: string[] = [];
  const conceptLower = concept.toLowerCase();

  const relevantMetrics = context.benchmarkHistory
    .flatMap((b) => Object.entries(b.metrics))
    .filter(([k]) => k.toLowerCase().includes(conceptLower) || conceptLower.includes(k.toLowerCase()));

  if (relevantMetrics.length > 0) {
    const avg = relevantMetrics.reduce((sum, [_, v]) => sum + v, 0) / relevantMetrics.length;
    parts.push(`In your experiments, the average ${concept} is ${avg.toFixed(3)}.`);
  }

  const comparisons = context.statisticalComparisons.filter(
    (c) => c.metric.toLowerCase().includes(conceptLower)
  );

  if (comparisons.length > 0) {
    const best = comparisons.reduce((b, c) => (c.improvement > b.improvement ? c : b));
    parts.push(`The best improvement in ${concept} was ${best.improvement > 0 ? "+" : ""}${(best.improvement * 100).toFixed(1)}% (${best.configA} vs ${best.configB}).`);
  }

  if (parts.length === 0) {
    parts.push(`No specific ${concept} data found in your current experiments.`);
  }

  return parts.join(" ");
}

function findRelatedConcepts(concept: string): string[] {
  const relations: Record<string, string[]> = {
    recall: ["precision", "f1", "hit rate", "ndcg"],
    precision: ["recall", "f1", "false positive rate"],
    mrr: ["ndcg", "rank", "position"],
    ndcg: ["mrr", "dcg", "precision", "recall"],
    faithfulness: ["answer relevancy", "hallucination", "context utilization"],
    "answer relevancy": ["faithfulness", "completeness", "relevance"],
    latency: ["throughput", "efficiency", "performance"],
    hybrid: ["vector", "bm25", "ensemble"],
    chunking: ["embedding", "retrieval", "document processing"],
    embedding: ["vector", "similarity", "semantic search"],
    reranking: ["retrieval", "precision", "ranking"],
    pareto: ["multi-objective", "trade-off", "optimization"],
  };

  for (const [key, related] of Object.entries(relations)) {
    if (concept.includes(key) || key.includes(concept)) {
      return related;
    }
  }

  return ["evaluation", "metrics", "optimization"];
}

export function getAvailableConcepts(): string[] {
  return Object.keys(CONCEPT_DEFINITIONS);
}

export function explainMetricValue(
  metric: string,
  value: number,
  _context: CopilotContext
): string {
  const metricLower = metric.toLowerCase();

  if (metricLower.includes("recall")) {
    if (value >= 0.9) return `Excellent recall (${(value * 100).toFixed(1)}%). Almost all relevant documents are retrieved.`;
    if (value >= 0.7) return `Good recall (${(value * 100).toFixed(1)}%). Most relevant documents are found.`;
    if (value >= 0.5) return `Moderate recall (${(value * 100).toFixed(1)}%). Some relevant documents are missed.`;
    return `Low recall (${(value * 100).toFixed(1)}%). Many relevant documents are missed.`;
  }

  if (metricLower.includes("precision")) {
    if (value >= 0.8) return `High precision (${(value * 100).toFixed(1)}%). Most retrieved documents are relevant.`;
    if (value >= 0.6) return `Moderate precision (${(value * 100).toFixed(1)}%). Some noise in results.`;
    return `Low precision (${(value * 100).toFixed(1)}%). Many irrelevant documents retrieved.`;
  }

  if (metricLower.includes("mrr")) {
    if (value >= 0.8) return `Excellent MRR (${(value * 100).toFixed(1)}%). Relevant results appear very early.`;
    if (value >= 0.5) return `Good MRR (${(value * 100).toFixed(1)}%). Relevant results appear within first few positions.`;
    return `Low MRR (${(value * 100).toFixed(1)}%). Relevant results are buried deep.`;
  }

  return `The ${metric} value is ${value.toFixed(3)}.`;
}
