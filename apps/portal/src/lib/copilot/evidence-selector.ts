import type {
  CopilotEvidence,
  CopilotContext,
  IntentDetectionResult,
  EvidenceType,
} from "./types";

interface EvidenceSelectorInput {
  intent: IntentDetectionResult;
  context: CopilotContext;
  query: string;
}

interface EvidenceCandidate {
  evidence: CopilotEvidence;
  relevance: number;
}

export function selectEvidence(input: EvidenceSelectorInput): CopilotEvidence[] {
  const { intent, context, query } = input;
  const candidates: EvidenceCandidate[] = [];

  candidates.push(...selectBenchmarkEvidence(context, intent));
  candidates.push(...selectStatisticalEvidence(context, intent));
  candidates.push(...selectConfigurationEvidence(context, intent));
  candidates.push(...selectResearchEvidence(context, intent));
  candidates.push(...selectPlannerEvidence(context, intent));
  candidates.push(...selectReproducibilityEvidence(context, intent));

  const queryLower = query.toLowerCase();
  for (const candidate of candidates) {
    candidate.relevance *= computeQueryRelevance(candidate.evidence, queryLower);
  }

  candidates.sort((a, b) => b.relevance - a.relevance);

  const selected = candidates
    .filter((c) => c.relevance > 0.1)
    .slice(0, 10)
    .map((c) => c.evidence);

  return selected;
}

function selectBenchmarkEvidence(
  context: CopilotContext,
  intent: IntentDetectionResult
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  for (const benchmark of context.benchmarkHistory) {
    let relevance = 0.5;

    if (intent.intent === "compare" || intent.intent === "explore") {
      relevance += 0.3;
    }

    if (intent.intent === "debug" || intent.intent === "interpret") {
      relevance += 0.2;
    }

    for (const entity of intent.entities) {
      if (entity.type === "metric" && benchmark.metrics[entity.value] !== undefined) {
        relevance += 0.2;
      }
      if (entity.type === "experiment" && benchmark.name.includes(entity.value)) {
        relevance += 0.3;
      }
    }

    candidates.push({
      evidence: {
        type: "benchmark",
        source: `Benchmark ${benchmark.id}`,
        data: benchmark,
        relevance,
        timestamp: benchmark.createdAt,
      },
      relevance,
    });
  }

  return candidates;
}

function selectStatisticalEvidence(
  context: CopilotContext,
  intent: IntentDetectionResult
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  for (const comparison of context.statisticalComparisons) {
    let relevance = 0.4;

    if (intent.intent === "compare" || intent.intent === "validate") {
      relevance += 0.4;
    }

    if (intent.intent === "interpret") {
      relevance += 0.3;
    }

    for (const entity of intent.entities) {
      if (entity.type === "metric" && comparison.metric.includes(entity.value)) {
        relevance += 0.3;
      }
      if (entity.type === "comparison") {
        if (comparison.configA.includes(entity.value) || comparison.configB.includes(entity.value)) {
          relevance += 0.3;
        }
      }
    }

    candidates.push({
      evidence: {
        type: "statistical",
        source: `Statistical comparison: ${comparison.configA} vs ${comparison.configB}`,
        data: comparison,
        relevance,
        timestamp: new Date().toISOString(),
      },
      relevance,
    });
  }

  return candidates;
}

function selectConfigurationEvidence(
  context: CopilotContext,
  intent: IntentDetectionResult
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  let relevance = 0.3;

  if (intent.intent === "explain" || intent.intent === "learn") {
    relevance += 0.3;
  }

  if (intent.intent === "optimize" || intent.intent === "recommend") {
    relevance += 0.2;
  }

  for (const entity of intent.entities) {
    if (entity.type === "config") {
      relevance += 0.2;
    }
  }

  candidates.push({
    evidence: {
      type: "config",
      source: "Current configuration",
      data: context.currentConfiguration,
      relevance,
      timestamp: new Date().toISOString(),
    },
    relevance,
  });

  return candidates;
}

function selectResearchEvidence(
  context: CopilotContext,
  intent: IntentDetectionResult
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  if (context.researchScientist) {
    const rs = context.researchScientist;

    for (const finding of rs.findings) {
      let relevance = 0.4;

      if (intent.intent === "interpret" || intent.intent === "summarize") {
        relevance += 0.3;
      }

      candidates.push({
        evidence: {
          type: "finding",
          source: `Research finding: ${finding.title}`,
          data: finding,
          relevance,
          timestamp: new Date().toISOString(),
        },
        relevance,
      });
    }

    for (const threat of rs.threats) {
      let relevance = 0.3;

      if (intent.intent === "review" || intent.intent === "validate") {
        relevance += 0.4;
      }

      candidates.push({
        evidence: {
          type: "threat",
          source: `Threat: ${threat.title}`,
          data: threat,
          relevance,
          timestamp: new Date().toISOString(),
        },
        relevance,
      });
    }

    for (const rec of rs.recommendations) {
      let relevance = 0.4;

      if (intent.intent === "recommend" || intent.intent === "plan") {
        relevance += 0.4;
      }

      candidates.push({
        evidence: {
          type: "recommendation",
          source: `Recommendation: ${rec.title}`,
          data: rec,
          relevance,
          timestamp: new Date().toISOString(),
        },
        relevance,
      });
    }
  }

  return candidates;
}

function selectPlannerEvidence(
  context: CopilotContext,
  intent: IntentDetectionResult
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  if (context.experimentPlanner) {
    const planner = context.experimentPlanner;

    let relevance = 0.3;

    if (intent.intent === "plan" || intent.intent === "recommend") {
      relevance += 0.5;
    }

    candidates.push({
      evidence: {
        type: "planner",
        source: "Experiment planner",
        data: {
          coverage: planner.coverageScore,
          recommendations: planner.topRecommendations,
        },
        relevance,
        timestamp: new Date().toISOString(),
      },
      relevance,
    });
  }

  return candidates;
}

function selectReproducibilityEvidence(
  context: CopilotContext,
  intent: IntentDetectionResult
): EvidenceCandidate[] {
  const candidates: EvidenceCandidate[] = [];

  if (context.reproducibility) {
    let relevance = 0.2;

    if (intent.intent === "review" || intent.intent === "validate") {
      relevance += 0.4;
    }

    candidates.push({
      evidence: {
        type: "provenance",
        source: "Reproducibility data",
        data: context.reproducibility,
        relevance,
        timestamp: new Date().toISOString(),
      },
      relevance,
    });
  }

  return candidates;
}

function computeQueryRelevance(evidence: CopilotEvidence, queryLower: string): number {
  const dataStr = JSON.stringify(evidence.data).toLowerCase();
  const sourceStr = evidence.source.toLowerCase();

  let relevance = 1.0;

  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);
  for (const word of queryWords) {
    if (dataStr.includes(word) || sourceStr.includes(word)) {
      relevance += 0.1;
    }
  }

  return Math.min(2, relevance);
}

export function getEvidenceSummary(evidence: CopilotEvidence[]): {
  totalCount: number;
  byType: Record<EvidenceType, number>;
  averageRelevance: number;
  mostRecent: string | null;
} {
  const byType = {} as Record<EvidenceType, number>;
  let totalRelevance = 0;
  let mostRecent: string | null = null;

  for (const e of evidence) {
    byType[e.type] = (byType[e.type] || 0) + 1;
    totalRelevance += e.relevance;

    if (!mostRecent || e.timestamp > mostRecent) {
      mostRecent = e.timestamp;
    }
  }

  return {
    totalCount: evidence.length,
    byType,
    averageRelevance: evidence.length > 0 ? totalRelevance / evidence.length : 0,
    mostRecent,
  };
}
