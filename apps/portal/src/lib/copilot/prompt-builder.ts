import type {
  PromptBuilderInput,
  CopilotIntent,
  CopilotEvidence,
  CopilotContext,
} from "./types";

const SYSTEM_PROMPT = `You are Kairos Copilot, an AI Research Mentor specialized in RAG (Retrieval-Augmented Generation) systems.

Your role is to guide users through research, experimentation, debugging, optimization, and deployment of RAG systems.

Core principles:
1. Every response MUST be evidence-backed using the provided context
2. Never hallucinate results or make unsupported recommendations
3. Always cite specific experiments, metrics, and statistical evidence
4. Be concise, technical, and actionable
5. When uncertain, acknowledge the limitation

You have access to:
- Benchmark results and metrics
- Statistical comparisons
- Research findings and threats
- Experiment planner recommendations
- Configuration details
- Reproducibility data

Always ground your responses in this data.`;

const INTENT_INSTRUCTIONS: Record<CopilotIntent, string> = {
  explain: `Provide a clear, technical explanation. Use analogies when helpful. Reference specific metrics from the context.`,

  learn: `Teach using the user's own experiments. Reference their data. Make concepts concrete with examples from their benchmarks.`,

  debug: `Systematically identify the issue. Check metrics, configurations, and statistical evidence. Provide actionable debugging steps.`,

  compare: `Use statistical evidence (p-values, effect sizes, confidence intervals) to compare. Declare a winner only if statistically significant.`,

  recommend: `Base recommendations on planner output, research findings, and coverage gaps. Include expected improvement and confidence.`,

  plan: `Create an actionable experiment plan. Consider budget constraints. Prioritize by expected information gain.`,

  optimize: `Identify bottlenecks using metrics. Suggest specific configuration changes. Quantify expected improvement.`,

  interpret: `Explain what results mean in context. Connect to broader research goals. Highlight implications.`,

  summarize: `Provide a concise overview. Highlight key findings, threats, and next steps.`,

  explore: `Guide discovery of available data. Show relevant benchmarks, experiments, and configurations.`,

  review: `Evaluate completeness and quality. Identify gaps in coverage, reproducibility, or statistical rigor.`,

  validate: `Verify claims against evidence. Check statistical significance. Confirm metric calculations.`,
};

export function buildPrompt(input: PromptBuilderInput): string {
  const { intent, context, evidence, query } = input;

  const parts: string[] = [];

  parts.push(SYSTEM_PROMPT);
  parts.push("");

  parts.push("## Current Context");
  parts.push(buildContextSection(context));
  parts.push("");

  parts.push("## Task Instructions");
  parts.push(INTENT_INSTRUCTIONS[intent.intent]);
  parts.push("");

  if (evidence.length > 0) {
    parts.push("## Available Evidence");
    parts.push(buildEvidenceSection(evidence));
    parts.push("");
  }

  parts.push("## User Query");
  parts.push(query);
  parts.push("");

  parts.push("## Response Format");
  parts.push("Provide a direct, evidence-backed answer.");
  parts.push("Cite specific experiments and metrics.");
  parts.push("Include confidence assessment.");
  parts.push("Suggest relevant follow-up questions.");
  parts.push("");

  return parts.join("\n");
}

function buildContextSection(context: CopilotContext): string {
  const parts: string[] = [];

  if (context.knowledgeBase) {
    parts.push(`- Knowledge Base: ${context.knowledgeBase.name} (${context.knowledgeBase.documentCount} documents, ${context.knowledgeBase.chunkCount} chunks)`);
  }

  if (context.currentExperiment) {
    parts.push(`- Current Experiment: ${context.currentExperiment.name} (${context.currentExperiment.status})`);
    const metrics = Object.entries(context.currentExperiment.metrics)
      .map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed(3) : v}`)
      .join(", ");
    if (metrics) parts.push(`  Metrics: ${metrics}`);
  }

  parts.push(`- Benchmarks: ${context.benchmarkHistory.length} completed`);

  if (context.leaderboard.entries.length > 0) {
    parts.push(`- Top Configuration: ${context.leaderboard.topConfig}`);
  }

  if (context.statisticalComparisons.length > 0) {
    parts.push(`- Statistical Comparisons: ${context.statisticalComparisons.length} available`);
  }

  if (context.experimentPlanner) {
    parts.push(`- Coverage: ${(context.experimentPlanner.coverageScore * 100).toFixed(0)}%`);
    parts.push(`- Planner Recommendations: ${context.experimentPlanner.topRecommendations.length}`);
  }

  if (context.researchScientist) {
    parts.push(`- Research Findings: ${context.researchScientist.findings.length}`);
    parts.push(`- Threats: ${context.researchScientist.threats.length}`);
  }

  if (context.reproducibility) {
    parts.push(`- Reproducibility Score: ${(context.reproducibility.overallScore * 100).toFixed(0)}%`);
  }

  const config = context.currentConfiguration;
  parts.push(`- Configuration: retrieval=${config.retrievalMode}, embedding=${config.embeddingModel}, chunkSize=${config.chunkSize}, topK=${config.topK}`);

  if (context.conversationContext.constraints.budgetMs) {
    parts.push(`- Time Budget: ${context.conversationContext.constraints.budgetMs / 60000} minutes`);
  }

  if (context.conversationContext.constraints.budgetTokens) {
    parts.push(`- Token Budget: ${context.conversationContext.constraints.budgetTokens}`);
  }

  return parts.join("\n");
}

function buildEvidenceSection(evidence: CopilotEvidence[]): string {
  const parts: string[] = [];

  for (const e of evidence.slice(0, 8)) {
    const dataStr = typeof e.data === "object"
      ? JSON.stringify(e.data).slice(0, 200)
      : String(e.data).slice(0, 200);

    parts.push(`- [${e.type}] ${e.source}`);
    parts.push(`  Data: ${dataStr}`);
    parts.push(`  Relevance: ${(e.relevance * 100).toFixed(0)}%`);
  }

  return parts.join("\n");
}

export function buildFollowUpPrompt(
  originalQuery: string,
  originalResponse: string,
  followUpQuery: string
): string {
  return `Previous conversation:
User: ${originalQuery}
Assistant: ${originalResponse.slice(0, 500)}

Follow-up question: ${followUpQuery}

Provide a concise, evidence-backed response that builds on the previous context.`;
}

export function buildDailyBriefPrompt(context: CopilotContext): string {
  return `Generate a daily research brief based on the following context:

${buildContextSection(context)}

Include:
1. Total experiments completed
2. Confidence change
3. Top finding
4. Weakest benchmark
5. Recommended experiment
6. Research direction

Format as a concise daily briefing.`;
}
