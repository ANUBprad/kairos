import type { CompressionResult, StrategyDocument } from "./types";
import { getAIProvider } from "@/lib/ai/providers";

export interface CompressionConfig {
  enabled: boolean;
  maxTokens: number;
  mergeOverlapping: boolean;
  removeDuplicates: boolean;
  trimRedundant: boolean;
}

const DEFAULT_COMPRESSION_CONFIG: CompressionConfig = {
  enabled: true,
  maxTokens: 4000,
  mergeOverlapping: true,
  removeDuplicates: true,
  trimRedundant: true,
};

function extractSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(a.toLowerCase().split(/\s+/));
  const setB = new Set(b.toLowerCase().split(/\s+/));
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return union.size > 0 ? intersection.size / union.size : 0;
}

export function compressContext(
  chunks: StrategyDocument[],
  config: Partial<CompressionConfig> = {},
): CompressionResult {
  const cfg = { ...DEFAULT_COMPRESSION_CONFIG, ...config };
  let processed = [...chunks];

  const originalTokens = processed.reduce((sum, c) => sum + estimateTokens(c.content), 0);

  if (cfg.removeDuplicates) {
    const seen = new Set<string>();
    const deduped: StrategyDocument[] = [];
    for (const chunk of processed) {
      const normalized = chunk.content.toLowerCase().replace(/\s+/g, " ").trim();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        deduped.push(chunk);
      }
    }
    processed = deduped;
  }

  if (cfg.mergeOverlapping) {
    const merged: StrategyDocument[] = [];
    let i = 0;
    while (i < processed.length) {
      let current = processed[i];
      let j = i + 1;
      while (j < processed.length) {
        const sim = jaccardSimilarity(current.content, processed[j].content);
        if (sim > 0.6) {
          const longer = current.content.length >= processed[j].content.length ? current : processed[j];
          current = {
            ...current,
            content: longer.content,
            metadata: {
              ...(current.metadata as Record<string, unknown> || {}),
              mergedChunks: ((current.metadata as Record<string, unknown>)?.mergedChunks as number || 0) + 1,
            },
          };
          j++;
        } else {
          break;
        }
      }
      merged.push(current);
      i = j;
    }
    processed = merged;
  }

  if (cfg.trimRedundant) {
    processed = processed.map((chunk) => {
      const sentences = extractSentences(chunk.content);
      if (sentences.length <= 2) return chunk;

      const sentenceScores = sentences.map((s, idx) => {
        let score = 0;
        for (let otherIdx = 0; otherIdx < sentences.length; otherIdx++) {
          if (idx !== otherIdx) {
            score += jaccardSimilarity(s, sentences[otherIdx]);
          }
        }
        return { sentence: s, score: score / Math.max(sentences.length - 1, 1), index: idx };
      });

      sentenceScores.sort((a, b) => b.score - a.score);

      const redundant = sentenceScores
        .filter((s) => s.score > 0.7)
        .slice(1);

      const keepIndices = new Set(sentences.map((_, i) => i));
      for (const r of redundant) {
        keepIndices.delete(r.index);
      }

      const kept = sentences.filter((_, i) => keepIndices.has(i));
      return {
        ...chunk,
        content: kept.join(". ") + (kept.length > 0 ? "." : ""),
      };
    });
  }

  if (cfg.maxTokens > 0) {
    let totalTokens = 0;
    const truncated: StrategyDocument[] = [];
    for (const chunk of processed) {
      const tokens = estimateTokens(chunk.content);
      if (totalTokens + tokens <= cfg.maxTokens) {
        totalTokens += tokens;
        truncated.push(chunk);
      } else {
        break;
      }
    }
    processed = truncated;
  }

  const compressedTokens = processed.reduce((sum, c) => sum + estimateTokens(c.content), 0);
  const reductionPercent = originalTokens > 0
    ? Math.round(((originalTokens - compressedTokens) / originalTokens) * 10000) / 100
    : 0;

  return {
    chunks: processed,
    originalTokens,
    compressedTokens,
    reductionPercent,
  };
}

export async function compressContextWithLLM(
  chunks: StrategyDocument[],
  query: string,
  config?: Partial<CompressionConfig>,
): Promise<CompressionResult> {
  const basic = compressContext(chunks, config);
  if (basic.chunks.length <= 1) return basic;

  const provider = getAIProvider();
  const contextText = basic.chunks.map((c, i) => `[${i + 1}] ${c.content}`).join("\n\n");
  const prompt = `Given the query: "${query}"

Compress the following context by keeping only the most relevant information. Remove any information not directly relevant to the query.

Context:
${contextText}

Return the compressed version preserving key facts. Do not add information not present in the original.`;

  try {
    const response = await provider.generateChat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      maxTokens: 1024,
    });

    const compressedContent = response.content.trim();
    const compressedTokens = estimateTokens(compressedContent);

    return {
      chunks: [{
        chunkId: "compressed",
        documentId: basic.chunks[0]?.documentId || "",
        content: compressedContent,
        index: 0,
        tokenCount: compressedTokens,
        metadata: null,
        similarity: 1,
      }],
      originalTokens: basic.originalTokens,
      compressedTokens,
      reductionPercent: basic.originalTokens > 0
        ? Math.round(((basic.originalTokens - compressedTokens) / basic.originalTokens) * 10000) / 100
        : 0,
    };
  } catch {
    return basic;
  }
}
