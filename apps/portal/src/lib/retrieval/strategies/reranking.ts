import type { RetrievalStrategy, RetrievalContext, RetrievalResult, StrategyDocument } from "./types";
import { getAIProvider } from "@/lib/ai/providers";

export interface RerankingConfig {
  enabled: boolean;
  topKAfterRerank: number;
  model: string;
}

const DEFAULT_RERANKING_CONFIG: RerankingConfig = {
  enabled: true,
  topKAfterRerank: 5,
  model: "cross-encoder",
};

export interface Reranker {
  name: string;
  rerank(query: string, chunks: StrategyDocument[], topK: number): Promise<StrategyDocument[]>;
}

export class LLMReranker implements Reranker {
  readonly name = "llm-reranker";

  async rerank(query: string, chunks: StrategyDocument[], topK: number): Promise<StrategyDocument[]> {
    if (chunks.length <= 1) return chunks;

    const batchSize = 10;
    const scored: StrategyDocument[] = [];

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchScored = await this.scoreBatch(query, batch);
      scored.push(...batchScored);
    }

    scored.sort((a, b) => {
      const scoreA = (a.metadata as Record<string, unknown>)?.rerankScore as number || 0;
      const scoreB = (b.metadata as Record<string, unknown>)?.rerankScore as number || 0;
      return scoreB - scoreA;
    });

    return scored.slice(0, topK);
  }

  private async scoreBatch(
    query: string,
    chunks: StrategyDocument[],
  ): Promise<StrategyDocument[]> {
    const provider = getAIProvider();
    const prompt = `Given the query: "${query}"

Rate each of the following passages for relevance on a scale of 0.0 to 1.0 (1.0 = perfectly relevant).

Return ONLY a JSON array of scores, one per passage, in order.
Example: [0.9, 0.3, 0.7]

Passages:
${chunks.map((c, i) => `[${i + 1}] ${c.content.slice(0, 500)}`).join("\n\n")}`;

    try {
      const response = await provider.generateChat({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        maxTokens: 256,
      });

      const content = response.content.trim();
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      let scores: number[] = [];

      if (jsonMatch) {
        try {
          scores = JSON.parse(jsonMatch[0]);
        } catch {
          scores = [];
        }
      }

      if (!Array.isArray(scores) || scores.length === 0) {
        scores = chunks.map(() => 0.5);
      }

      return chunks.map((chunk, i) => ({
        ...chunk,
        similarity: scores[i] ?? 0.5,
        metadata: {
          ...(chunk.metadata as Record<string, unknown> || {}),
          rerankScore: scores[i] ?? 0.5,
          originalRank: (chunk.metadata as Record<string, unknown>)?.originalRank || 0,
        },
      }));
    } catch {
      return chunks.map((chunk) => ({
        ...chunk,
        metadata: {
          ...(chunk.metadata as Record<string, unknown> || {}),
          rerankScore: chunk.similarity,
        },
      }));
    }
  }
}

export class RerankingStrategy implements RetrievalStrategy {
  readonly name = "reranking";
  readonly description = "Rerank retrieved chunks using cross-encoder style relevance scoring";

  private reranker: Reranker;
  private config: RerankingConfig;

  constructor(
    private baseStrategy: RetrievalStrategy,
    reranker?: Reranker,
    config?: Partial<RerankingConfig>,
  ) {
    this.reranker = reranker || new LLMReranker();
    this.config = { ...DEFAULT_RERANKING_CONFIG, ...config };
  }

  async retrieve(ctx: RetrievalContext): Promise<RetrievalResult> {
    const baseResult = await this.baseStrategy.retrieve(ctx);

    if (!this.config.enabled || baseResult.chunks.length === 0) {
      return baseResult;
    }

    const chunksWithRank = baseResult.chunks.map((c, i) => ({
      ...c,
      metadata: {
        ...(c.metadata as Record<string, unknown> || {}),
        originalRank: i + 1,
      },
    }));

    const reranked = await this.reranker.rerank(ctx.query, chunksWithRank, this.config.topKAfterRerank);

    return {
      chunks: reranked,
      metadata: {
        ...baseResult.metadata,
        rerankingEnabled: true,
        rerankerName: this.reranker.name,
        originalChunkCount: baseResult.chunks.length,
      },
    };
  }
}
