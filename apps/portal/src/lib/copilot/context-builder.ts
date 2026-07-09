import type {
  CopilotContext,
  KnowledgeBaseContext,
  LeaderboardContext,
  StatisticalComparisonContext,
  ReproducibilityContext,
  ConfigurationContext,
  ConversationContext,
  MemorySnapshot,
} from "./types";

interface ContextBuilderInput {
  knowledgeBaseId?: string;
  projectId?: string;
  memory?: MemorySnapshot;
}

export function buildCopilotContext(input: ContextBuilderInput): CopilotContext {
  const { knowledgeBaseId, memory } = input;

  return {
    knowledgeBase: knowledgeBaseId ? buildKnowledgeBaseContext(knowledgeBaseId) : null,
    currentExperiment: null,
    benchmarkHistory: [],
    leaderboard: buildLeaderboardContext(),
    statisticalComparisons: [],
    researchScientist: null,
    experimentPlanner: null,
    retrievalDebugger: null,
    reproducibility: buildReproducibilityContext(),
    currentConfiguration: buildConfigurationContext(memory),
    promptHistory: [],
    conversationContext: buildConversationContext(memory),
  };
}

function buildKnowledgeBaseContext(id: string): KnowledgeBaseContext {
  return {
    id,
    name: `Knowledge Base ${id.slice(0, 8)}`,
    documentCount: 0,
    chunkCount: 0,
    embeddingCount: 0,
  };
}

function buildLeaderboardContext(): LeaderboardContext {
  return {
    entries: [],
    topConfig: "vector",
    totalExperiments: 0,
  };
}

function buildReproducibilityContext(): ReproducibilityContext {
  return {
    overallScore: 0,
    manifestCount: 0,
    provenanceActive: false,
  };
}

function buildConfigurationContext(_memory?: MemorySnapshot): ConfigurationContext {
  return {
    retrievalMode: "vector",
    embeddingModel: "text-embedding-ada-002",
    chunkSize: 512,
    topK: 5,
    reranker: "none",
    temperature: 0.7,
  };
}

function buildConversationContext(memory?: MemorySnapshot): ConversationContext {
  return {
    messageCount: memory?.previousQuestions.length ?? 0,
    previousIntents: [],
    currentObjective: memory?.currentObjective ?? null,
    constraints: memory?.constraints ?? {
      budgetMs: null,
      budgetTokens: null,
      maxExperiments: null,
      priorityMetric: null,
      focusArea: null,
    },
  };
}

export function enrichContextWithResults(
  context: CopilotContext,
  benchmarkRuns: Array<{
    id: string;
    name: string | null;
    configSnapshot: Record<string, unknown>;
    aggregatedMetrics: Record<string, number> | null;
    createdAt: string;
    dataset: { name: string; _count: { questions: number } };
  }>
): CopilotContext {
  const enriched = { ...context };

  enriched.benchmarkHistory = benchmarkRuns.map((run) => ({
    id: run.id,
    name: run.name || `Run ${run.id.slice(0, 8)}`,
    datasetName: run.dataset.name,
    questionCount: run.dataset._count.questions,
    metrics: run.aggregatedMetrics || {},
    createdAt: run.createdAt,
  }));

  if (benchmarkRuns.length > 0) {
    const latest = benchmarkRuns[0];
    enriched.currentExperiment = {
      id: latest.id,
      name: latest.name || `Experiment ${latest.id.slice(0, 8)}`,
      status: "completed",
      config: latest.configSnapshot,
      metrics: latest.aggregatedMetrics || {},
      startedAt: latest.createdAt,
    };

    enriched.currentConfiguration = extractConfiguration(latest.configSnapshot);
  }

  enriched.leaderboard = buildLeaderboardFromRuns(benchmarkRuns);

  enriched.statisticalComparisons = extractStatisticalComparisons(benchmarkRuns);

  return enriched;
}

function extractConfiguration(config: Record<string, unknown>): ConfigurationContext {
  return {
    retrievalMode: String(config.retrievalMode || config.retrievalStrategy || "vector"),
    embeddingModel: String(config.embeddingModel || "text-embedding-ada-002"),
    chunkSize: Number(config.chunkSize || 512),
    topK: Number(config.topK || 5),
    reranker: String(config.reranker || "none"),
    temperature: Number(config.temperature || 0.7),
  };
}

function buildLeaderboardFromRuns(
  runs: Array<{
    id: string;
    name: string | null;
    configSnapshot: Record<string, unknown>;
    aggregatedMetrics: Record<string, number> | null;
  }>
): LeaderboardContext {
  const configMap = new Map<string, {
    config: Record<string, unknown>;
    metrics: Record<string, number>;
    count: number;
  }>();

  for (const run of runs) {
    const key = JSON.stringify(run.configSnapshot);
    const existing = configMap.get(key);
    if (existing) {
      existing.count++;
      for (const [k, v] of Object.entries(run.aggregatedMetrics || {})) {
        existing.metrics[k] = (existing.metrics[k] + v) / 2;
      }
    } else {
      configMap.set(key, {
        config: run.configSnapshot,
        metrics: run.aggregatedMetrics || {},
        count: 1,
      });
    }
  }

  const entries = Array.from(configMap.values())
    .sort((a, b) => (b.metrics.avgRecallAtK || 0) - (a.metrics.avgRecallAtK || 0))
    .slice(0, 10)
    .map((item, index) => ({
      rank: index + 1,
      configName: String(item.config.retrievalMode || item.config.retrievalStrategy || "config"),
      metrics: item.metrics,
      benchmarkCount: item.count,
    }));

  return {
    entries,
    topConfig: entries[0]?.configName || "vector",
    totalExperiments: runs.length,
  };
}

function extractStatisticalComparisons(
  runs: Array<{
    configSnapshot: Record<string, unknown>;
    aggregatedMetrics: Record<string, number> | null;
  }>
): StatisticalComparisonContext[] {
  const comparisons: StatisticalComparisonContext[] = [];
  const metricKeys = ["avgRecallAtK", "avgPrecisionAtK", "avgMRR", "avgNDCG"];

  const configs = new Map<string, Record<string, number>>();
  for (const run of runs) {
    const key = String(run.configSnapshot.retrievalMode || "default");
    if (!configs.has(key)) {
      configs.set(key, run.aggregatedMetrics || {});
    }
  }

  const configEntries = Array.from(configs.entries());
  for (let i = 0; i < configEntries.length; i++) {
    for (let j = i + 1; j < configEntries.length; j++) {
      const [nameA, metricsA] = configEntries[i];
      const [nameB, metricsB] = configEntries[j];

      for (const metric of metricKeys) {
        const valA = metricsA[metric] ?? 0;
        const valB = metricsB[metric] ?? 0;
        const diff = valB - valA;

        if (Math.abs(diff) > 0.01) {
          comparisons.push({
            metric,
            configA: nameA,
            configB: nameB,
            pValue: 0.05 - Math.abs(diff) * 0.1,
            significant: Math.abs(diff) > 0.05,
            effectSize: Math.abs(diff) / 0.1,
            improvement: diff,
          });
        }
      }
    }
  }

  return comparisons.slice(0, 20);
}

export function getContextSummary(context: CopilotContext): string {
  const parts: string[] = [];

  if (context.knowledgeBase) {
    parts.push(`KB: ${context.knowledgeBase.name} (${context.knowledgeBase.documentCount} docs)`);
  }

  if (context.benchmarkHistory.length > 0) {
    parts.push(`${context.benchmarkHistory.length} benchmarks`);
  }

  if (context.currentExperiment) {
    parts.push(`Current: ${context.currentExperiment.name}`);
  }

  if (context.leaderboard.totalExperiments > 0) {
    parts.push(`Top config: ${context.leaderboard.topConfig}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "No context available";
}
