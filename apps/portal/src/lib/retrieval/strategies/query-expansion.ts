import type { RetrievalStrategy, RetrievalContext, RetrievalResult, StrategyDocument, ExpansionResult } from "./types";
import { getAIProvider } from "@/lib/ai/providers";

const EXPANSION_PROMPT = `You are a query expansion specialist. Given a user's search query, generate up to 5 alternative phrasings or related search terms that would help retrieve relevant documents.

Original query: "{{query}}"

Return ONLY a JSON array of strings. Each string is one expanded query variation.
Example: ["expanded query 1", "expanded query 2", "expanded query 3"]`;

export async function expandQuery(
  query: string,
  provider?: string,
): Promise<ExpansionResult> {
  const aiProvider = getAIProvider(provider as never);
  const prompt = EXPANSION_PROMPT.replace("{{query}}", query);

  try {
    const response = await aiProvider.generateChat({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      maxTokens: 256,
    });

    const content = response.content.trim();
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    let expanded: string[] = [];

    if (jsonMatch) {
      try {
        expanded = JSON.parse(jsonMatch[0]);
      } catch {
        expanded = [];
      }
    }

    if (!Array.isArray(expanded) || expanded.length === 0) {
      const lines = content
        .split("\n")
        .map((l: string) => l.replace(/^\d+[.)]\s*/, "").trim())
        .filter((l: string) => l.length > 5 && l.length < 200);
      expanded = lines;
    }

    return {
      originalQuery: query,
      expandedQueries: expanded.slice(0, 5),
    };
  } catch {
    return { originalQuery: query, expandedQueries: [] };
  }
}

export class QueryExpansionStrategy implements RetrievalStrategy {
  readonly name = "query-expansion";
  readonly description = "Expand query using LLM before vector search";

  constructor(private baseStrategy: RetrievalStrategy) {}

  async retrieve(ctx: RetrievalContext): Promise<RetrievalResult> {
    const expansion = await expandQuery(ctx.query, ctx.embeddingProvider);

    if (expansion.expandedQueries.length === 0) {
      return this.baseStrategy.retrieve(ctx);
    }

    const allQueries = [ctx.query, ...expansion.expandedQueries];
    const allResults = await Promise.all(
      allQueries.map((q) =>
        this.baseStrategy.retrieve({ ...ctx, query: q }),
      ),
    );

    const seen = new Set<string>();
    const merged: StrategyDocument[] = [];

    for (const result of allResults) {
      for (const chunk of result.chunks) {
        if (!seen.has(chunk.chunkId)) {
          seen.add(chunk.chunkId);
          merged.push(chunk);
        }
      }
    }

    merged.sort((a, b) => b.similarity - a.similarity);

    return {
      chunks: merged.slice(0, ctx.topK),
      metadata: {
        expandedQueries: expansion.expandedQueries,
        originalQuery: ctx.query,
        queryCount: allQueries.length,
      },
    };
  }
}
