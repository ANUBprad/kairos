import type {
  CopilotRequest,
  CopilotResponse,
  CopilotContext,
  CopilotEvidence,
  MemorySnapshot,
  DailyBrief,
  SuggestedQuestion,
  ResearchTimelineEvent,
  ResearchPlan,
  AdvisorRecommendation,
  IntentDetectionResult,
} from "./types";
import { detectIntent } from "./intent";
import { buildCopilotContext, enrichContextWithResults, getContextSummary } from "./context-builder";
import { selectEvidence } from "./evidence-selector";
import { computeConfidence } from "./confidence";
import { loadMemory, addQuestionToMemory, detectConstraintsFromQuery, setConstraint } from "./memory";
import { groundResponse } from "./grounding";
import { generateSuggestions } from "./suggestions";
import { generateTimeline } from "./timeline";
import { buildCopilotResponse } from "./response";
import { buildPrompt } from "./prompt-builder";
import { explainConcept, getAvailableConcepts } from "./explainer";
import { generateAdvisorRecommendations, prioritizeForConstraints } from "./advisor";
import { generateResearchPlan, adaptPlanToConstraints } from "./planner";

export interface CopilotOrchestratorResult {
  response: CopilotResponse;
  context: CopilotContext;
  prompt: string;
  memory: MemorySnapshot;
  suggestions: SuggestedQuestion[];
  timeline: ResearchTimelineEvent[];
  grounding: ReturnType<typeof groundResponse>;
  dailyBrief: DailyBrief;
  conceptExplanation?: ReturnType<typeof explainConcept>;
  advisorRecommendations?: AdvisorRecommendation[];
  researchPlan?: ResearchPlan;
}

interface OrchestratorInput {
  request: CopilotRequest;
  benchmarkRuns?: Array<{
    id: string;
    name: string | null;
    configSnapshot: Record<string, unknown>;
    aggregatedMetrics: Record<string, number> | null;
    createdAt: string;
    dataset: { name: string; _count: { questions: number } };
  }>;
}

export async function runCopilot(input: OrchestratorInput): Promise<CopilotOrchestratorResult> {
  const { request, benchmarkRuns } = input;
  const memory = loadMemory();

  const intent = detectIntent(request.query);

  let context = buildCopilotContext({ memory });

  if (benchmarkRuns && benchmarkRuns.length > 0) {
    context = enrichContextWithResults(context, benchmarkRuns);
  }

  const newConstraints = detectConstraintsFromQuery(request.query);
  if (Object.keys(newConstraints).length > 0) {
    setConstraint(memory, newConstraints);
  }

  const evidence = selectEvidence({ intent, context, query: request.query });

  const prompt = buildPrompt({ intent, context, evidence, query: request.query });

  const responseText = generateResponse(intent, context, evidence, request.query);

  const grounding = groundResponse(responseText, evidence, context);

  const confidence = computeConfidence({
    evidence,
    context,
    intentConfidence: intent.confidence,
  });

  const relatedExperiments = evidence
    .filter((e) => e.type === "benchmark")
    .slice(0, 3)
    .map((e) => {
      const data = e.data as { id?: string; name?: string };
      return data.name || data.id || "Unknown";
    });

  const relatedBenchmarks = context.benchmarkHistory.slice(0, 3).map((b) => b.name);

  const suggestedFollowUp = generateSmartFollowUp(intent, context);

  const response = buildCopilotResponse({
    answer: responseText,
    evidence,
    confidence,
    intent: intent.intent,
    relatedExperiments,
    relatedBenchmarks,
    relatedReports: [],
    suggestedFollowUp,
  });

  const updatedMemory = addQuestionToMemory(memory, request.query, intent.intent);

  const suggestions = generateSuggestions({
    context,
    lastIntent: intent,
    conversationHistory: updatedMemory.previousQuestions,
  });

  const timeline = generateTimeline({ context });

  const dailyBrief = generateDailyBrief(context);

  let conceptExplanation: ReturnType<typeof explainConcept> | undefined;
  if (intent.intent === "learn" || intent.intent === "explain") {
    const concepts = getAvailableConcepts();
    const matchedConcept = concepts.find((c) =>
      request.query.toLowerCase().includes(c.toLowerCase())
    );
    if (matchedConcept) {
      conceptExplanation = explainConcept({ concept: matchedConcept, context, evidence });
    }
  }

  let advisorRecommendations: AdvisorRecommendation[] | undefined;
  if (intent.intent === "recommend" || intent.intent === "plan") {
    const recs = generateAdvisorRecommendations({
      context,
      evidence,
      objective: request.query,
      constraints: {
        budgetMs: memory.constraints.budgetMs ?? undefined,
        maxExperiments: memory.constraints.maxExperiments ?? undefined,
        priorityMetric: memory.constraints.priorityMetric ?? undefined,
      },
    });
    advisorRecommendations = prioritizeForConstraints(recs, {
      priorityMetric: memory.constraints.priorityMetric ?? undefined,
      maxExperiments: memory.constraints.maxExperiments ?? undefined,
    });
  }

  let researchPlan: ResearchPlan | undefined;
  if (intent.intent === "plan") {
    const rawPlan = generateResearchPlan({
      context,
      budgetMs: memory.constraints.budgetMs ?? undefined,
      maxExperiments: memory.constraints.maxExperiments ?? undefined,
      priorityMetric: memory.constraints.priorityMetric ?? undefined,
      targetMetric: memory.constraints.priorityMetric ?? undefined,
    });
    researchPlan = adaptPlanToConstraints(rawPlan, {
      budgetMs: memory.constraints.budgetMs ?? undefined,
      maxExperiments: memory.constraints.maxExperiments ?? undefined,
    });
  }

  return {
    response,
    context,
    prompt,
    memory: updatedMemory,
    suggestions,
    timeline,
    grounding,
    dailyBrief,
    conceptExplanation,
    advisorRecommendations,
    researchPlan,
  };
}

function generateResponse(
  intent: IntentDetectionResult,
  context: CopilotContext,
  evidence: CopilotEvidence[],
  query: string
): string {
  switch (intent.intent) {
    case "explain":
      return generateExplanatoryResponse(context, evidence, query);
    case "debug":
      return generateDebugResponse(context, evidence, query);
    case "compare":
      return generateComparisonResponse(context, evidence, query);
    case "recommend":
      return generateRecommendationResponse(context, evidence);
    case "plan":
      return generatePlanningResponse(context, evidence);
    case "optimize":
      return generateOptimizationResponse(context, evidence, query);
    case "interpret":
      return generateInterpretationResponse(context, evidence, query);
    case "summarize":
      return generateSummaryResponse(context);
    case "explore":
      return generateExplorationResponse(context);
    case "review":
      return generateReviewResponse(context, evidence);
    case "validate":
      return generateValidationResponse(context, evidence, query);
    case "learn":
      return generateEducationalResponse(context, evidence, query);
    default:
      return generateGeneralResponse(context, query);
  }
}

function generateExplanatoryResponse(
  context: CopilotContext,
  evidence: CopilotEvidence[],
  query: string
): string {
  const parts: string[] = [];
  parts.push(`Based on your query about "${query}":`);

  if (evidence.length > 0) {
    const benchmarkEvidence = evidence.filter((e) => e.type === "benchmark");
    if (benchmarkEvidence.length > 0) {
      const data = benchmarkEvidence[0].data as { metrics?: Record<string, number> };
      if (data.metrics) {
        const metricEntries = Object.entries(data.metrics).slice(0, 3);
        parts.push(`Your current metrics show: ${metricEntries.map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed(3) : v}`).join(", ")}.`);
      }
    }

    const statisticalEvidence = evidence.filter((e) => e.type === "statistical");
    if (statisticalEvidence.length > 0) {
      const data = statisticalEvidence[0].data as { improvement?: number; significant?: boolean };
      parts.push(`Statistical analysis shows ${data.significant ? "significant" : "non-significant"} results with ${(data.improvement ?? 0) > 0 ? "+" : ""}${((data.improvement ?? 0) * 100).toFixed(1)}% improvement.`);
    }
  } else {
    parts.push("Limited evidence is available for this specific topic.");
  }

  return parts.join(" ");
}

function generateDebugResponse(
  context: CopilotContext,
  evidence: CopilotEvidence[],
  query: string
): string {
  const parts: string[] = [];
  parts.push(`Debugging: "${query}"`);

  const config = context.currentConfiguration;
  parts.push(`Current configuration: ${config.retrievalMode} retrieval, ${config.embeddingModel} embeddings, chunkSize=${config.chunkSize}, topK=${config.topK}.`);

  if (context.benchmarkHistory.length > 0) {
    const latest = context.benchmarkHistory[0];
    const metrics = Object.entries(latest.metrics)
      .map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed(3) : v}`)
      .join(", ");
    parts.push(`Latest benchmark (${latest.name}): ${metrics}.`);
  }

  const statisticalEvidence = evidence.filter((e) => e.type === "statistical");
  if (statisticalEvidence.length > 0) {
    parts.push(`Found ${statisticalEvidence.length} statistical comparisons to analyze.`);
  }

  parts.push("Check the Retrieval Debugger for detailed trace analysis.");
  return parts.join(" ");
}

function generateComparisonResponse(
  context: CopilotContext,
  evidence: CopilotEvidence[],
  query: string
): string {
  const parts: string[] = [];
  parts.push(`Comparing configurations based on "${query}":`);

  const statisticalEvidence = evidence.filter((e) => e.type === "statistical");

  if (statisticalEvidence.length > 0) {
    for (const e of statisticalEvidence.slice(0, 2)) {
      const data = e.data as { configA: string; configB: string; improvement: number; significant: boolean; pValue: number };
      const direction = data.improvement > 0 ? "outperforms" : "underperforms";
      parts.push(`${data.configA} ${direction} ${data.configB} by ${(Math.abs(data.improvement) * 100).toFixed(1)}% (p=${data.pValue.toFixed(3)}, ${data.significant ? "significant" : "not significant"}).`);
    }
  } else {
    parts.push("Direct comparison requires experiments with both configurations.");
  }

  return parts.join(" ");
}

function generateRecommendationResponse(
  context: CopilotContext,
  _evidence: CopilotEvidence[]
): string {
  const parts: string[] = [];

  if (context.experimentPlanner && context.experimentPlanner.topRecommendations.length > 0) {
    const topRec = context.experimentPlanner.topRecommendations[0];
    parts.push(`Based on the Experiment Planner, I recommend: ${topRec.rationale}`);
    parts.push(`Expected improvement: ${(topRec.expectedImprovement * 100).toFixed(1)}%.`);
  } else {
    parts.push("Recommendations require completed experiments and planner analysis.");
  }

  if (context.researchScientist && context.researchScientist.recommendations.length > 0) {
    const topResearch = context.researchScientist.recommendations[0];
    parts.push(`Research finding: ${topResearch.title} (priority: ${topResearch.priority}).`);
  }

  return parts.join(" ");
}

function generatePlanningResponse(
  context: CopilotContext,
  _evidence: CopilotEvidence[]
): string {
  const parts: string[] = [];
  parts.push("Research Plan:");

  if (context.experimentPlanner) {
    const planner = context.experimentPlanner;
    parts.push(`Configuration coverage: ${(planner.coverageScore * 100).toFixed(0)}% (${planner.exploredCombinations}/${planner.totalCombinations} combinations explored).`);

    if (planner.topRecommendations.length > 0) {
      parts.push("Top experiments to run:");
      for (const rec of planner.topRecommendations.slice(0, 3)) {
        parts.push(`- ${rec.rationale} (expected +${(rec.expectedImprovement * 100).toFixed(1)}%)`);
      }
    }
  } else {
    parts.push("Planning requires experiment history and coverage analysis.");
  }

  return parts.join(" ");
}

function generateOptimizationResponse(
  context: CopilotContext,
  evidence: CopilotEvidence[],
  query: string
): string {
  const parts: string[] = [];
  parts.push(`Optimization suggestions for "${query}":`);

  if (context.benchmarkHistory.length > 0) {
    const latest = context.benchmarkHistory[0];
    const latencyMetric = latest.metrics.latencySearchMs || latest.metrics.totalLatencyMs;
    if (latencyMetric) {
      parts.push(`Current latency: ${latencyMetric.toFixed(0)}ms.`);
    }
  }

  const config = context.currentConfiguration;
  if (config.reranker === "none") {
    parts.push("Consider adding a reranker to improve precision.");
  }
  if (config.topK < 10) {
    parts.push("Increasing topK may improve recall but will increase latency.");
  }

  parts.push("Check the Pareto Frontier for optimal accuracy-latency trade-offs.");
  return parts.join(" ");
}

function generateInterpretationResponse(
  context: CopilotContext,
  evidence: CopilotEvidence[],
  query: string
): string {
  const parts: string[] = [];
  parts.push(`Interpreting results for "${query}":`);

  if (context.researchScientist && context.researchScientist.findings.length > 0) {
    const finding = context.researchScientist.findings[0];
    parts.push(`Key finding: ${finding.title} (confidence: ${(finding.confidence * 100).toFixed(0)}%).`);
  }

  if (context.statisticalComparisons.length > 0) {
    const comp = context.statisticalComparisons[0];
    parts.push(`Statistical significance: p=${comp.pValue.toFixed(3)}, effect size=${comp.effectSize.toFixed(2)}.`);
  }

  return parts.join(" ");
}

function generateSummaryResponse(context: CopilotContext): string {
  const parts: string[] = [];
  parts.push("Research Summary:");
  parts.push(`- Knowledge Base: ${context.knowledgeBase?.name || "Not configured"}`);
  parts.push(`- Benchmarks Completed: ${context.benchmarkHistory.length}`);
  parts.push(`- Top Configuration: ${context.leaderboard.topConfig}`);

  if (context.experimentPlanner) {
    parts.push(`- Coverage: ${(context.experimentPlanner.coverageScore * 100).toFixed(0)}%`);
  }

  if (context.researchScientist) {
    parts.push(`- Findings: ${context.researchScientist.findings.length}`);
    parts.push(`- Threats: ${context.researchScientist.threats.length}`);
  }

  if (context.reproducibility) {
    parts.push(`- Reproducibility: ${(context.reproducibility.overallScore * 100).toFixed(0)}%`);
  }

  return parts.join("\n");
}

function generateExplorationResponse(context: CopilotContext): string {
  const parts: string[] = [];
  parts.push("Available exploration options:");
  parts.push(`- ${context.benchmarkHistory.length} benchmarks to analyze`);
  parts.push(`- ${context.leaderboard.entries.length} configurations in leaderboard`);
  parts.push(`- ${context.statisticalComparisons.length} statistical comparisons`);

  if (context.experimentPlanner) {
    const unexplored = context.experimentPlanner.totalCombinations - context.experimentPlanner.exploredCombinations;
    parts.push(`- ${unexplored} unexplored configuration combinations`);
  }

  return parts.join("\n");
}

function generateReviewResponse(
  context: CopilotContext,
  _evidence: CopilotEvidence[]
): string {
  const parts: string[] = [];
  parts.push("Research Review:");

  if (context.reproducibility) {
    parts.push(`Reproducibility Score: ${(context.reproducibility.overallScore * 100).toFixed(0)}%`);
  }

  if (context.researchScientist && context.researchScientist.threats.length > 0) {
    parts.push(`Threats to Validity: ${context.researchScientist.threats.length}`);
    for (const threat of context.researchScientist.threats.slice(0, 2)) {
      parts.push(`- ${threat.title} (impact: ${threat.impact})`);
    }
  }

  if (context.experimentPlanner) {
    parts.push(`Configuration Coverage: ${(context.experimentPlanner.coverageScore * 100).toFixed(0)}%`);
  }

  return parts.join("\n");
}

function generateValidationResponse(
  context: CopilotContext,
  evidence: CopilotEvidence[],
  query: string
): string {
  const parts: string[] = [];
  parts.push(`Validating: "${query}"`);

  const statisticalEvidence = evidence.filter((e) => e.type === "statistical");
  if (statisticalEvidence.length > 0) {
    for (const e of statisticalEvidence.slice(0, 2)) {
      const data = e.data as { metric: string; significant: boolean; pValue: number; effectSize: number };
      parts.push(`${data.metric}: p=${data.pValue.toFixed(3)}, significant=${data.significant}, effect=${data.effectSize.toFixed(2)}`);
    }
  } else {
    parts.push("No statistical validation data available for this query.");
  }

  return parts.join("\n");
}

function generateEducationalResponse(
  context: CopilotContext,
  evidence: CopilotEvidence[],
  query: string
): string {
  const parts: string[] = [];
  parts.push(`Learning about "${query}":`);

  if (context.benchmarkHistory.length > 0) {
    const latest = context.benchmarkHistory[0];
    const relevantMetrics = Object.entries(latest.metrics)
      .filter(([k]) => query.toLowerCase().includes(k.toLowerCase()))
      .slice(0, 2);

    if (relevantMetrics.length > 0) {
      parts.push(`In your last experiment (${latest.name}):`);
      for (const [k, v] of relevantMetrics) {
        parts.push(`- ${k}: ${typeof v === "number" ? v.toFixed(3) : v}`);
      }
    }
  }

  parts.push("See the Educational Mode section for detailed explanations with your data.");
  return parts.join("\n");
}

function generateGeneralResponse(context: CopilotContext, query: string): string {
  const parts: string[] = [];
  parts.push(`I understand you're asking about "${query}".`);

  const summary = getContextSummary(context);
  parts.push(`Current context: ${summary}`);

  parts.push("Please specify if you'd like me to explain, debug, compare, or recommend something specific.");
  return parts.join(" ");
}

function generateSmartFollowUp(
  intent: IntentDetectionResult,
  _context: CopilotContext
): string[] {
  const followUps: string[] = [];

  switch (intent.intent) {
    case "explain":
      followUps.push("How does this relate to my other metrics?");
      followUps.push("What configuration changes would affect this?");
      break;
    case "debug":
      followUps.push("What are potential root causes?");
      followUps.push("How can I verify this hypothesis?");
      break;
    case "compare":
      followUps.push("Which configuration should I deploy?");
      followUps.push("What is the confidence in this comparison?");
      break;
    case "recommend":
      followUps.push("Show me the evidence for this recommendation");
      followUps.push("What are the risks of this approach?");
      break;
    default:
      followUps.push("What should I focus on next?");
      break;
  }

  return followUps.slice(0, 2);
}

function generateDailyBrief(context: CopilotContext): DailyBrief {
  const totalExperiments = context.benchmarkHistory.length;
  const today = new Date().toISOString().split("T")[0];
  const todayExperiments = context.benchmarkHistory.filter(
    (b) => b.createdAt.startsWith(today)
  ).length;

  const confidenceChange = context.researchScientist
    ? context.researchScientist.findings.reduce((sum, f) => sum + f.confidence, 0) / context.researchScientist.findings.length - 0.5
    : 0;

  const topFinding = context.researchScientist && context.researchScientist.findings.length > 0
    ? context.researchScientist.findings[0].title
    : "No findings yet";

  const weakestBenchmark = context.benchmarkHistory.length > 0
    ? context.benchmarkHistory.reduce((w, b) => {
      const avgMetric = Object.values(b.metrics).reduce((s, v) => s + v, 0) / Object.values(b.metrics).length;
      const wAvg = Object.values(w.metrics).reduce((s, v) => s + v, 0) / Object.values(w.metrics).length;
      return avgMetric < wAvg ? b : w;
    }).name
    : "No benchmarks";

  const recommendedExperiment = context.experimentPlanner && context.experimentPlanner.topRecommendations.length > 0
    ? context.experimentPlanner.topRecommendations[0].rationale
    : "Run more experiments to get recommendations";

  const researchDirection = context.experimentPlanner && context.experimentPlanner.coverageScore < 0.3
    ? "Focus on exploring configuration space"
    : context.experimentPlanner && context.experimentPlanner.coverageScore < 0.7
    ? "Balance exploration and exploitation"
    : "Fine-tune around Pareto frontier";

  return {
    date: today,
    totalExperiments,
    experimentsToday: todayExperiments,
    confidenceChange,
    topFinding,
    weakestBenchmark,
    recommendedExperiment,
    researchDirection,
  };
}
