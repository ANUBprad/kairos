import type { RetrievalStrategy, RetrievalContext, RetrievalResult, StrategyDocument } from "./types";
import { getAIProvider } from "@/lib/ai/providers";
import { logError } from "@/lib/errors";

const MULTI_QUERY_PROMPT = `You are a retrieval specialist. Given a user question, generate 3 different versions of the question that capture different semantic angles or sub-topics. Each version should help retrieve different but relevant documents.

Original question: "{{query}}"

Return ONLY a JSON array of 3 strings.
Example: ["semantic variation 1", "semantic variation 2", "semantic variation 3"]`;

export async function generateMultiQueries(query: string, provider?: string): Promise<string[]> {
  const aiProvider = getAIProvider(provider as "openai" | "gemini" | undefined);
  const prompt = MULTI_QUERY_PROMPT.replace("{{query}}", query);

  try {
    const response = await aiProvider.generateChat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      maxTokens: 256,
    });

    const content = response.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);

    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) return parsed.slice(0, 3);
      } catch {
        logError("multi-query:parse", new Error("Failed to parse LLM response"), { raw: jsonMatch[0].slice(0, 200) });
      }
    }

    const lines: string[] = content
      .split("\n")
      .map((l: string) => l.replace(/^\d+[.)]\s*/, "").trim())
      .filter((l: string) => l.length > 5);
    return lines.slice(0, 3);
  } catch (error) {
    logError("multi-query:generate", error, { query: query.slice(0, 100) });
    return [];
  }
}

export class MultiQueryStrategy implements RetrievalStrategy {
  readonly name = "multi-query";
  readonly description = "Generate multiple semantic query variations and merge results";

  constructor(private baseStrategy: RetrievalStrategy) {}

  async retrieve(ctx: RetrievalContext): Promise<RetrievalResult> {
    const variations = ctx.multiQueryVariations && ctx.multiQueryVariations.length > 0
      ? ctx.multiQueryVariations
      : await generateMultiQueries(ctx.query, ctx.embeddingProvider);

    if (variations.length === 0) {
      return this.baseStrategy.retrieve(ctx);
    }

    const allQueries = [ctx.query, ...variations];
    const perQueryChunks: StrategyDocument[][] = [];

    const results = await Promise.all(
      allQueries.map((q) =>
        this.baseStrategy.retrieve({ ...ctx, query: q, topK: Math.ceil(ctx.topK / 2) }),
      ),
    );

    for (const result of results) {
      perQueryChunks.push(result.chunks);
    }

    const seen = new Map<string, { chunk: StrategyDocument; fromQueries: number[] }>();
    for (let qi = 0; qi < allQueries.length; qi++) {
      for (const chunk of perQueryChunks[qi]) {
        if (seen.has(chunk.chunkId)) {
          seen.get(chunk.chunkId)!.fromQueries.push(qi);
        } else {
          seen.set(chunk.chunkId, { chunk, fromQueries: [qi] });
        }
      }
    }

    const entries = Array.from(seen.values());
    entries.sort((a, b) => {
      if (a.fromQueries.length !== b.fromQueries.length) {
        return b.fromQueries.length - a.fromQueries.length;
      }
      return b.chunk.similarity - a.chunk.similarity;
    });

    const merged = entries.map((e) => ({
      ...e.chunk,
      similarity: Math.min(1, e.chunk.similarity * (1 + (e.fromQueries.length - 1) * 0.15)),
      metadata: {
        ...(e.chunk.metadata as Record<string, unknown> || {}),
        matchedQueryCount: e.fromQueries.length,
        matchedQueries: e.fromQueries.map((qi) => allQueries[qi]),
      },
    }));

    return {
      chunks: merged.slice(0, ctx.topK),
      metadata: {
        variations,
        queryCount: allQueries.length,
      },
    };
  }
}
