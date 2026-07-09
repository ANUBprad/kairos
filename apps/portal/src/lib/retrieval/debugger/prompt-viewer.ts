import type { PromptConstruction } from "./types";

export interface PromptAnalysis {
  prompt: PromptConstruction;
  systemPromptLength: number;
  userMessageLength: number;
  contextLength: number;
  totalLength: number;
  chunkCount: number;
  estimatedTokens: number;
  chunkPositions: Array<{
    chunkId: string;
    startIndex: number;
    endIndex: number;
    documentName: string;
  }>;
}

export function analyzePrompt(prompt: PromptConstruction): PromptAnalysis {
  const systemPromptLength = prompt.systemPrompt.length;
  const userMessageLength = prompt.userMessage.length;
  const contextLength = prompt.contextChunks.reduce((s, c) => s + c.content.length, 0);
  const totalLength = systemPromptLength + userMessageLength + contextLength;
  const estimatedTokens = Math.ceil(totalLength / 4);

  let currentIndex = prompt.systemPrompt.length + prompt.userMessage.length;
  const chunkPositions = prompt.contextChunks.map((chunk) => {
    const startIndex = currentIndex;
    const endIndex = currentIndex + chunk.content.length;
    currentIndex = endIndex;
    return {
      chunkId: chunk.chunkId,
      startIndex,
      endIndex,
      documentName: chunk.documentName,
    };
  });

  return {
    prompt,
    systemPromptLength,
    userMessageLength,
    contextLength,
    totalLength,
    chunkCount: prompt.contextChunks.length,
    estimatedTokens,
    chunkPositions,
  };
}

export function formatPromptForDisplay(prompt: PromptConstruction): string {
  const parts: string[] = [];

  parts.push("=== SYSTEM PROMPT ===");
  parts.push(prompt.systemPrompt);
  parts.push("");

  parts.push("=== USER MESSAGE ===");
  parts.push(prompt.userMessage);
  parts.push("");

  parts.push("=== CONTEXT CHUNKS ===");
  for (let i = 0; i < prompt.contextChunks.length; i++) {
    const chunk = prompt.contextChunks[i];
    parts.push(`[${i + 1}] ${chunk.documentName} (sim: ${chunk.similarity.toFixed(3)})`);
    parts.push(chunk.content);
    parts.push("");
  }

  return parts.join("\n");
}

export function extractCitationsFromPrompt(
  prompt: PromptConstruction,
  answerText: string,
): Array<{
  chunkId: string;
  documentName: string;
  similarity: number;
  citedInAnswer: boolean;
}> {
  return prompt.contextChunks.map((chunk) => {
    const isCited = answerText.includes(`[${chunk.chunkId}]`) ||
      answerText.includes(chunk.documentName) ||
      answerText.includes(chunk.content.slice(0, 50));
    return {
      chunkId: chunk.chunkId,
      documentName: chunk.documentName,
      similarity: chunk.similarity,
      citedInAnswer: isCited,
    };
  });
}

export function getPromptTokenBreakdown(prompt: PromptConstruction): {
  systemTokens: number;
  userTokens: number;
  contextTokens: number;
  totalTokens: number;
} {
  const systemTokens = Math.ceil(prompt.systemPrompt.length / 4);
  const userTokens = Math.ceil(prompt.userMessage.length / 4);
  const contextTokens = prompt.contextChunks.reduce((s, c) => s + Math.ceil(c.content.length / 4), 0);
  return {
    systemTokens,
    userTokens,
    contextTokens,
    totalTokens: systemTokens + userTokens + contextTokens,
  };
}
