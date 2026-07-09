import type { RetrievalChunk } from "./types";

export interface ChunkInspection {
  chunk: RetrievalChunk;
  tokenEstimate: number;
  charCount: number;
  lineCount: number;
  hasCode: boolean;
  hasNumbers: boolean;
  language: "text" | "code" | "mixed";
}

export function inspectChunk(chunk: RetrievalChunk): ChunkInspection {
  const content = chunk.content;
  const charCount = content.length;
  const tokenEstimate = Math.ceil(charCount / 4);
  const lineCount = content.split("\n").length;

  const codePatterns = [
    /```[\s\S]*?```/,
    /function\s+\w+/,
    /const\s+\w+\s*=/,
    /import\s+/,
    /class\s+\w+/,
    /def\s+\w+/,
    /return\s+/,
    /if\s*\(/,
    /for\s*\(/,
  ];

  const hasCode = codePatterns.some((p) => p.test(content));
  const numberPattern = /\b\d+\.?\d*\b/g;
  const numbers = content.match(numberPattern) ?? [];
  const hasNumbers = numbers.length > 3;

  let language: ChunkInspection["language"] = "text";
  if (hasCode && !hasNumbers) language = "code";
  else if (hasCode && hasNumbers) language = "mixed";

  return {
    chunk,
    tokenEstimate,
    charCount,
    lineCount,
    hasCode,
    hasNumbers,
    language,
  };
}

export function inspectChunks(chunks: RetrievalChunk[]): ChunkInspection[] {
  return chunks.map(inspectChunk);
}

export function getChunkSummary(inspections: ChunkInspection[]): {
  totalChunks: number;
  totalChars: number;
  avgChars: number;
  totalTokens: number;
  codeChunks: number;
  textChunks: number;
  mixedChunks: number;
} {
  const totalChunks = inspections.length;
  const totalChars = inspections.reduce((s, i) => s + i.charCount, 0);
  const avgChars = totalChunks > 0 ? totalChars / totalChunks : 0;
  const totalTokens = inspections.reduce((s, i) => s + i.tokenEstimate, 0);
  const codeChunks = inspections.filter((i) => i.language === "code").length;
  const textChunks = inspections.filter((i) => i.language === "text").length;
  const mixedChunks = inspections.filter((i) => i.language === "mixed").length;

  return { totalChunks, totalChars, avgChars, totalTokens, codeChunks, textChunks, mixedChunks };
}

export function truncateContent(content: string, maxLength: number): string {
  if (content.length <= maxLength) return content;
  return content.slice(0, maxLength - 3) + "...";
}

export function highlightSimilarity(similarity: number): {
  label: string;
  color: string;
} {
  if (similarity >= 0.9) return { label: "Very High", color: "text-emerald-500" };
  if (similarity >= 0.8) return { label: "High", color: "text-green-500" };
  if (similarity >= 0.7) return { label: "Moderate", color: "text-yellow-500" };
  if (similarity >= 0.5) return { label: "Low", color: "text-orange-500" };
  return { label: "Very Low", color: "text-red-500" };
}
