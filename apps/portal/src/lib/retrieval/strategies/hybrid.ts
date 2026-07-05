import type { RetrievalStrategy, RetrievalContext, RetrievalResult } from "./types";
import { VectorStrategy } from "./vector";
import { KeywordStrategy } from "./keyword";
import { reciprocalRankFusion, getFusionContributions } from "./rrf";

export interface HybridConfig {
  vectorWeight: number;
  keywordWeight: number;
  rrfK: number;
}

const DEFAULT_HYBRID_CONFIG: HybridConfig = {
  vectorWeight: 1.0,
  keywordWeight: 1.0,
  rrfK: 60,
};

export class HybridStrategy implements RetrievalStrategy {
  readonly name = "hybrid";
  readonly description = "Hybrid retrieval combining vector and BM25 keyword search with RRF fusion";

  private vectorStrategy = new VectorStrategy();
  private keywordStrategy = new KeywordStrategy();
  private config: HybridConfig;

  constructor(config: Partial<HybridConfig> = {}) {
    this.config = { ...DEFAULT_HYBRID_CONFIG, ...config };
  }

  async retrieve(ctx: RetrievalContext): Promise<RetrievalResult> {
    const [vectorResult, keywordResult] = await Promise.all([
      this.vectorStrategy.retrieve(ctx),
      this.keywordStrategy.retrieve(ctx),
    ]);

    const fused = reciprocalRankFusion(
      [
        { chunks: vectorResult.chunks, weight: this.config.vectorWeight, label: "vector" },
        { chunks: keywordResult.chunks, weight: this.config.keywordWeight, label: "keyword" },
      ],
      { k: this.config.rrfK },
    );

    const topK = fused.slice(0, ctx.topK);

    const contributions = getFusionContributions(topK, [
      { chunks: vectorResult.chunks, weight: this.config.vectorWeight, label: "vector" },
      { chunks: keywordResult.chunks, weight: this.config.keywordWeight, label: "keyword" },
    ]);

    return {
      chunks: topK,
      metadata: {
        vectorWeight: this.config.vectorWeight,
        keywordWeight: this.config.keywordWeight,
        rrfK: this.config.rrfK,
        vectorChunksReturned: vectorResult.chunks.length,
        keywordChunksReturned: keywordResult.chunks.length,
        fusionContributions: contributions,
      },
    };
  }
}
