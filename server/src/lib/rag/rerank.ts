import { RAG_TOP_K, RERANK_MODEL } from "../ai-config.js";
import { logger } from "../logger.js";
import { providerFetch } from "../provider-http.js";
import type { RetrievedChunk } from "./reconcile.js";

type CohereRerankResponse = {
    results: { index: number; relevance_score: number }[];
};

/**
 * Reranks retrieved chunks with Cohere. Falls back to vector score order when API key is missing.
 */
export async function rerankChunks(
    query: string,
    candidates: RetrievedChunk[],
    topK: number = RAG_TOP_K,
): Promise<RetrievedChunk[]> {
    if (candidates.length === 0) {
        return candidates;
    }

    const apiKey = process.env.COHERE_API_KEY?.trim();
    if (!apiKey) {
        return candidates
            .slice()
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }

    try {
        const response = await providerFetch("https://api.cohere.com/v2/rerank", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: RERANK_MODEL,
                query,
                documents: candidates.map((chunk) => chunk.text),
                top_n: Math.min(topK, candidates.length),
            }),
        });

        if (!response.ok) {
            logger.warn("Cohere rerank failed; using vector order", {
                status: response.status,
            });
            return candidates
                .slice()
                .sort((a, b) => b.score - a.score)
                .slice(0, topK);
        }

        const data = (await response.json()) as CohereRerankResponse;
        const reranked: RetrievedChunk[] = [];

        for (const item of data.results) {
            const chunk = candidates[item.index];
            if (!chunk) {
                continue;
            }
            reranked.push({
                ...chunk,
                vectorScore: chunk.vectorScore ?? chunk.score,
                score: item.relevance_score,
            });
        }

        return reranked;
    } catch (error) {
        logger.warn("Cohere rerank request failed; using vector order", {
            error: error instanceof Error ? error.name : "UnknownError",
        });
        return candidates
            .slice()
            .sort((a, b) => b.score - a.score)
            .slice(0, topK);
    }
}
