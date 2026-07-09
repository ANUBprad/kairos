import type {
  SuggestedQuestion,
  CopilotContext,
  IntentDetectionResult,
} from "./types";

interface SuggestionInput {
  context: CopilotContext;
  lastIntent: IntentDetectionResult | null;
  conversationHistory: string[];
}

export function generateSuggestions(input: SuggestionInput): SuggestedQuestion[] {
  const { context, lastIntent, conversationHistory } = input;
  const suggestions: SuggestedQuestion[] = [];

  suggestions.push(...generateContextualSuggestions(context));
  suggestions.push(...generateIntentBasedSuggestions(lastIntent, context));
  suggestions.push(...generateProactiveSuggestions(context));
  suggestions.push(...generateFollowUpSuggestions(conversationHistory));

  const uniqueSuggestions = deduplicateSuggestions(suggestions);

  return uniqueSuggestions
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 8);
}

function generateContextualSuggestions(context: CopilotContext): SuggestedQuestion[] {
  const suggestions: SuggestedQuestion[] = [];

  if (context.benchmarkHistory.length > 0) {
    const latest = context.benchmarkHistory[0];
    suggestions.push({
      id: "ctx-1",
      question: `Explain the results of ${latest.name}`,
      intent: "explain",
      relevance: 0.7,
      reasoning: "Based on latest benchmark",
    });
  }

  if (context.leaderboard.entries.length > 1) {
    const top = context.leaderboard.entries[0];
    suggestions.push({
      id: "ctx-2",
      question: `Why is ${top.configName} the best performing configuration?`,
      intent: "interpret",
      relevance: 0.75,
      reasoning: "Based on leaderboard",
    });
  }

  if (context.experimentPlanner && context.experimentPlanner.topRecommendations.length > 0) {
    suggestions.push({
      id: "ctx-3",
      question: "What should I experiment with next?",
      intent: "plan",
      relevance: 0.8,
      reasoning: "Based on planner recommendations",
    });
  }

  if (context.researchScientist && context.researchScientist.threats.length > 0) {
    suggestions.push({
      id: "ctx-4",
      question: "What are the main threats to validity?",
      intent: "review",
      relevance: 0.65,
      reasoning: "Based on research scientist findings",
    });
  }

  return suggestions;
}

function generateIntentBasedSuggestions(
  lastIntent: IntentDetectionResult | null,
  _context: CopilotContext
): SuggestedQuestion[] {
  const suggestions: SuggestedQuestion[] = [];

  if (!lastIntent) return suggestions;

  switch (lastIntent.intent) {
    case "explain":
      suggestions.push({
        id: "int-1",
        question: "How does this metric relate to my other experiments?",
        intent: "explore",
        relevance: 0.6,
        reasoning: "Follow-up to explanation",
      });
      break;

    case "compare":
      suggestions.push({
        id: "int-2",
        question: "Which configuration should I deploy?",
        intent: "recommend",
        relevance: 0.7,
        reasoning: "Natural follow-up to comparison",
      });
      break;

    case "debug":
      suggestions.push({
        id: "int-3",
        question: "How can I fix this issue?",
        intent: "optimize",
        relevance: 0.75,
        reasoning: "Problem-solving follow-up",
      });
      break;

    case "recommend":
      suggestions.push({
        id: "int-4",
        question: "Show me the evidence for this recommendation",
        intent: "interpret",
        relevance: 0.65,
        reasoning: "Evidence-seeking follow-up",
      });
      break;
  }

  return suggestions;
}

function generateProactiveSuggestions(context: CopilotContext): SuggestedQuestion[] {
  const suggestions: SuggestedQuestion[] = [];

  if (context.benchmarkHistory.length < 5) {
    suggestions.push({
      id: "pro-1",
      question: "I need more benchmarks for statistical power",
      intent: "plan",
      relevance: 0.5,
      reasoning: "Low experiment count",
    });
  }

  if (context.experimentPlanner && context.experimentPlanner.coverageScore < 0.2) {
    suggestions.push({
      id: "pro-2",
      question: "Show me unexplored configuration combinations",
      intent: "explore",
      relevance: 0.6,
      reasoning: "Low coverage score",
    });
  }

  if (context.reproducibility && context.reproducibility.overallScore < 0.5) {
    suggestions.push({
      id: "pro-3",
      question: "How can I improve reproducibility?",
      intent: "optimize",
      relevance: 0.55,
      reasoning: "Low reproducibility score",
    });
  }

  const hasStatisticalIssues = context.statisticalComparisons.some(
    (c) => !c.significant && Math.abs(c.improvement) > 0.05
  );

  if (hasStatisticalIssues) {
    suggestions.push({
      id: "pro-4",
      question: "Which experiments lack statistical significance?",
      intent: "validate",
      relevance: 0.65,
      reasoning: "Statistical issues detected",
    });
  }

  return suggestions;
}

function generateFollowUpSuggestions(conversationHistory: string[]): SuggestedQuestion[] {
  const suggestions: SuggestedQuestion[] = [];

  if (conversationHistory.length === 0) {
    suggestions.push({
      id: "fu-1",
      question: "What is the current status of my research?",
      intent: "summarize",
      relevance: 0.6,
      reasoning: "Initial exploration",
    });
  }

  const lastQuestion = conversationHistory[conversationHistory.length - 1]?.toLowerCase() || "";

  if (lastQuestion.includes("recall") || lastQuestion.includes("precision")) {
    suggestions.push({
      id: "fu-2",
      question: "How does this compare to the state of the art?",
      intent: "compare",
      relevance: 0.65,
      reasoning: "Metric-focused follow-up",
    });
  }

  if (lastQuestion.includes("latency") || lastQuestion.includes("speed")) {
    suggestions.push({
      id: "fu-3",
      question: "What is the accuracy-latency tradeoff?",
      intent: "interpret",
      relevance: 0.6,
      reasoning: "Performance trade-off follow-up",
    });
  }

  return suggestions;
}

function deduplicateSuggestions(suggestions: SuggestedQuestion[]): SuggestedQuestion[] {
  const seen = new Set<string>();
  const unique: SuggestedQuestion[] = [];

  for (const s of suggestions) {
    const key = s.question.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  return unique;
}

export function getSmartSuggestions(context: CopilotContext): string[] {
  const suggestions: string[] = [];

  if (context.benchmarkHistory.length > 0) {
    suggestions.push("Why is latency increasing?");
    suggestions.push("What should I optimize next?");
  }

  if (context.leaderboard.entries.length > 1) {
    suggestions.push("Compare today's benchmark");
  }

  if (context.researchScientist) {
    suggestions.push("Show statistically weak experiments");
    suggestions.push("Find reproducibility issues");
  }

  if (context.experimentPlanner) {
    suggestions.push("Inspect Retrieval Debugger");
  }

  return suggestions.slice(0, 5);
}
