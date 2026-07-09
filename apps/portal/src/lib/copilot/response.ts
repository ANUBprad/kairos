import type {
  CopilotResponse,
  CopilotEvidence,
  CopilotConfidence,
  CopilotIntent,
} from "./types";

interface ResponseBuilderInput {
  answer: string;
  evidence: CopilotEvidence[];
  confidence: CopilotConfidence;
  intent: CopilotIntent;
  relatedExperiments: string[];
  relatedBenchmarks: string[];
  relatedReports: string[];
  suggestedFollowUp: string[];
}

export function buildCopilotResponse(input: ResponseBuilderInput): CopilotResponse {
  return {
    answer: formatAnswer(input.answer),
    evidence: input.evidence,
    confidence: input.confidence,
    relatedExperiments: input.relatedExperiments,
    relatedBenchmarks: input.relatedBenchmarks,
    relatedReports: input.relatedReports,
    suggestedFollowUp: input.suggestedFollowUp,
    intent: input.intent,
  };
}

function formatAnswer(answer: string): string {
  let formatted = answer.trim();

  formatted = formatted.replace(/\*\*(.+?)\*\*/g, "$1");

  if (!formatted.endsWith(".") && !formatted.endsWith("!") && !formatted.endsWith("?")) {
    formatted += ".";
  }

  return formatted;
}

export function responseToMarkdown(response: CopilotResponse): string {
  const lines: string[] = [];

  lines.push("## Answer");
  lines.push("");
  lines.push(response.answer);
  lines.push("");

  lines.push("## Evidence");
  lines.push("");
  for (const e of response.evidence.slice(0, 5)) {
    lines.push(`- **${e.type}**: ${e.source} (relevance: ${(e.relevance * 100).toFixed(0)}%)`);
  }
  lines.push("");

  lines.push("## Confidence");
  lines.push("");
  lines.push(`**${(response.confidence.score * 100).toFixed(0)}%** (${response.confidence.label.replace("_", " ")})`);
  lines.push("");
  for (const factor of response.confidence.factors.slice(0, 5)) {
    lines.push(`- ${factor.name}: ${(factor.score * 100).toFixed(0)}% - ${factor.description}`);
  }
  lines.push("");

  if (response.relatedExperiments.length > 0) {
    lines.push("## Related Experiments");
    lines.push("");
    for (const exp of response.relatedExperiments.slice(0, 3)) {
      lines.push(`- ${exp}`);
    }
    lines.push("");
  }

  if (response.relatedBenchmarks.length > 0) {
    lines.push("## Related Benchmarks");
    lines.push("");
    for (const bench of response.relatedBenchmarks.slice(0, 3)) {
      lines.push(`- ${bench}`);
    }
    lines.push("");
  }

  if (response.suggestedFollowUp.length > 0) {
    lines.push("## Suggested Next Questions");
    lines.push("");
    for (const q of response.suggestedFollowUp.slice(0, 3)) {
      lines.push(`- ${q}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function responseToJSON(response: CopilotResponse): string {
  return JSON.stringify(response, null, 2);
}

export function getResponseSummary(response: CopilotResponse): string {
  const wordCount = response.answer.split(/\s+/).length;
  const evidenceCount = response.evidence.length;
  const confidence = (response.confidence.score * 100).toFixed(0);

  return `${wordCount} words, ${evidenceCount} evidence items, ${confidence}% confidence`;
}

export function formatEvidenceForDisplay(evidence: CopilotEvidence): string {
  const data = evidence.data;
  if (typeof data === "object" && data !== null) {
    const preview = JSON.stringify(data).slice(0, 100);
    return `${evidence.source}: ${preview}...`;
  }
  return `${evidence.source}: ${String(data).slice(0, 100)}`;
}

export function getConfidenceColor(confidence: CopilotConfidence): string {
  const colors: Record<string, string> = {
    very_high: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    high: "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400",
    medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    low: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    very_low: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return colors[confidence.label] || colors.medium;
}

export function getIntentIcon(intent: CopilotIntent): string {
  const icons: Record<CopilotIntent, string> = {
    explain: "📖",
    learn: "🎓",
    debug: "🔍",
    compare: "⚖️",
    recommend: "💡",
    plan: "📋",
    optimize: "⚡",
    interpret: "🔎",
    summarize: "📝",
    explore: "🧭",
    review: "✅",
    validate: "✔️",
  };
  return icons[intent];
}
