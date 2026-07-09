import type { FutureWorkItem, Finding, BenchmarkRunData } from "./types";
import { getBestConfigForMetric, getMetricValue } from "./evidence";

export function generateFutureWork(
  runs: BenchmarkRunData[],
  findings: Finding[],
): FutureWorkItem[] {
  const items: FutureWorkItem[] = [];

  items.push(...suggestMissingExperiments(runs));
  items.push(...suggestImprovements(runs, findings));
  items.push(...suggestExtensions(runs));

  return items.sort((a, b) => {
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

function suggestMissingExperiments(runs: BenchmarkRunData[]): FutureWorkItem[] {
  const items: FutureWorkItem[] = [];

  const hasReranking = runs.some((r) => {
    const config = r.config;
    return config.reranking === true || config.retrievalStrategy === "reranking";
  });

  if (!hasReranking) {
    items.push({
      title: "Evaluate Cross-Encoder Reranking",
      rationale: "No reranking experiments were conducted. Cross-encoder reranking typically improves nDCG by 10-15%.",
      expectedImpact: "Improved ranking quality (nDCG) with moderate latency increase.",
      priority: "high",
      missingEvidence: ["Reranking performance data", "Cross-encoder comparison"],
      parameters: ["rerankerModel", "rerankingTopK"],
    });
  }

  const hasQueryExpansion = runs.some((r) => {
    const config = r.config;
    return config.queryExpansion === true;
  });

  if (!hasQueryExpansion) {
    items.push({
      title: "Evaluate Query Expansion",
      rationale: "No query expansion experiments were conducted. Query expansion typically improves recall by 5-10%.",
      expectedImpact: "Improved recall for complex, multi-faceted queries.",
      priority: "medium",
      missingEvidence: ["Query expansion performance data"],
      parameters: ["queryExpansion", "expansionCount"],
    });
  }

  const hasMultiQuery = runs.some((r) => {
    const config = r.config;
    return config.multiQuery === true;
  });

  if (!hasMultiQuery) {
    items.push({
      title: "Evaluate Multi-Query Retrieval",
      rationale: "No multi-query experiments were conducted. Multi-query retrieval generates diverse interpretations of a query.",
      expectedImpact: "Improved recall for ambiguous or complex queries.",
      priority: "medium",
      missingEvidence: ["Multi-query performance data"],
      parameters: ["multiQuery", "queryCount"],
    });
  }

  const datasetNames = new Set(runs.map((r) => r.datasetName));
  if (datasetNames.size < 2) {
    items.push({
      title: "Test on Multiple Datasets",
      rationale: "Results are based on a single dataset. Generalizability requires evaluation on diverse datasets.",
      expectedImpact: "Improved external validity and generalizability of conclusions.",
      priority: "high",
      missingEvidence: ["Cross-dataset comparison", "Domain transfer analysis"],
      parameters: ["dataset"],
    });
  }

  return items;
}

function suggestImprovements(
  runs: BenchmarkRunData[],
  _findings: Finding[],
): FutureWorkItem[] {
  const items: FutureWorkItem[] = [];

  const bestRecall = getBestConfigForMetric(runs, "avgRecallAtK");
  if (bestRecall && bestRecall.value < 0.7) {
    items.push({
      title: "Improve Recall with Larger Top-K",
      rationale: `Best recall is ${(bestRecall.value * 100).toFixed(1)}%, suggesting relevant documents are being missed.`,
      expectedImpact: "Increased top-K should improve recall at the cost of precision.",
      priority: "high",
      missingEvidence: ["Top-K sensitivity analysis"],
      parameters: ["topK"],
    });
  }

  const latencyValues = runs
    .map((r) => getMetricValue(r, "avgLatencyMs"))
    .filter((v): v is number => v !== null);

  if (latencyValues.length > 0) {
    const avgLatency = latencyValues.reduce((s, v) => s + v, 0) / latencyValues.length;
    if (avgLatency > 2000) {
      items.push({
        title: "Investigate Latency Bottlenecks",
        rationale: `Average latency is ${avgLatency.toFixed(0)}ms, which may impact user experience.`,
        expectedImpact: "Reduced latency through pipeline optimization.",
        priority: "medium",
        missingEvidence: ["Latency profiling", "Component-level timing"],
        parameters: ["chunkSize", "embeddingModel"],
      });
    }
  }

  return items;
}

function suggestExtensions(_runs: BenchmarkRunData[]): FutureWorkItem[] {
  const items: FutureWorkItem[] = [];

  items.push({
    title: "Evaluate Semantic Chunking",
    rationale: "Semantic chunking groups text by meaning rather than fixed boundaries. It may improve retrieval quality for narrative documents.",
    expectedImpact: "Potentially improved recall for semantic queries.",
    priority: "medium",
    missingEvidence: ["Semantic chunking comparison"],
    parameters: ["chunkStrategy"],
  });

  items.push({
    title: "Add LLM-as-Judge Evaluation",
    rationale: "Retrieval metrics do not capture answer quality. LLM-as-judge evaluation provides faithfulness, relevancy, and correctness assessment.",
    expectedImpact: "Comprehensive evaluation covering both retrieval and generation quality.",
    priority: "high",
    missingEvidence: ["Faithfulness scores", "Answer relevancy", "Answer correctness"],
    parameters: ["judgeModel", "evaluationCriteria"],
  });

  return items;
}
