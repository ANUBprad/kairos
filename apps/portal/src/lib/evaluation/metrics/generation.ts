import type { GenerationMetrics } from "../types";

export interface GenerationEvalInput {
  question: string;
  generatedAnswer: string;
  retrievedContexts: string[];
  expectedAnswer?: string;
}

function extractSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);
}

function calculateFaithfulness(
  answer: string,
  contexts: string[],
): number {
  const answerSentences = extractSentences(answer);
  if (answerSentences.length === 0) return 1;

  const contextText = contexts.join(" ").toLowerCase();

  let supportedCount = 0;
  for (const sentence of answerSentences) {
    const keywords = sentence
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);
    const matchCount = keywords.filter((kw) => contextText.includes(kw)).length;
    if (keywords.length > 0 && matchCount / keywords.length >= 0.5) {
      supportedCount++;
    }
  }

  return supportedCount / answerSentences.length;
}

function calculateContextPrecision(contexts: string[]): number {
  const allSentences = contexts.flatMap(extractSentences);
  if (allSentences.length === 0) return 1;

  const meaningfulSentences = allSentences.filter((s) => {
    const words = s.split(/\s+/).filter((w) => w.length > 2);
    return words.length >= 3;
  });

  return meaningfulSentences.length / allSentences.length;
}

function calculateContextRecall(
  contexts: string[],
  expectedAnswer?: string,
): number {
  if (!expectedAnswer) return 0.5;

  const contextText = contexts.join(" ").toLowerCase();
  const expectedWords = expectedAnswer
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  if (expectedWords.length === 0) return 1;

  const foundWords = expectedWords.filter((w) => contextText.includes(w));
  return foundWords.length / expectedWords.length;
}

function calculateAnswerRelevancy(
  question: string,
  answer: string,
): number {
  const questionWords = new Set(
    question.toLowerCase().split(/\s+/).filter((w) => w.length > 2),
  );
  if (questionWords.size === 0) return 1;

  const answerLower = answer.toLowerCase();
  const matchedWords = [...questionWords].filter((w) => answerLower.includes(w));
  return matchedWords.length / questionWords.size;
}

export function calculateGenerationMetrics(
  input: GenerationEvalInput,
): GenerationMetrics {
  const faithfulness = calculateFaithfulness(input.generatedAnswer, input.retrievedContexts);
  const contextPrecision = calculateContextPrecision(input.retrievedContexts);
  const contextRecall = calculateContextRecall(input.retrievedContexts, input.expectedAnswer);
  const answerRelevancy = calculateAnswerRelevancy(input.question, input.generatedAnswer);

  return {
    faithfulness: round(faithfulness),
    contextPrecision: round(contextPrecision),
    contextRecall: round(contextRecall),
    answerRelevancy: round(answerRelevancy),
  };
}

export function calculateAverageGenerationMetrics(
  allMetrics: GenerationMetrics[],
): GenerationMetrics {
  const n = allMetrics.length;
  if (n === 0) {
    return { faithfulness: 0, contextPrecision: 0, contextRecall: 0, answerRelevancy: 0 };
  }

  return {
    faithfulness: round(allMetrics.reduce((s, m) => s + m.faithfulness, 0) / n),
    contextPrecision: round(allMetrics.reduce((s, m) => s + m.contextPrecision, 0) / n),
    contextRecall: round(allMetrics.reduce((s, m) => s + m.contextRecall, 0) / n),
    answerRelevancy: round(allMetrics.reduce((s, m) => s + m.answerRelevancy, 0) / n),
  };
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
