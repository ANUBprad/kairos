import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.DATABASE_URL ??= "postgresql://localhost:5432/kairos_test";

const { buildQueryEmbedCacheKey } = await import("./query-embed-cache.js");

const GEMINI_512 = "gemini:gemini-embedding-001:512:query";

describe("query embedding cache key", () => {
    it("normalizes whitespace and case but preserves embedding identity", () => {
        assert.equal(
            buildQueryEmbedCacheKey("  What   is RAG? ", GEMINI_512),
            buildQueryEmbedCacheKey("what is rag?", GEMINI_512),
        );
    });

    it("changes when provider, model or dimensions change", () => {
        const key = buildQueryEmbedCacheKey("same query", GEMINI_512);
        assert.notEqual(
            key,
            buildQueryEmbedCacheKey(
                "same query",
                "openai:text-embedding-3-small:512:query",
            ),
        );
        assert.notEqual(
            key,
            buildQueryEmbedCacheKey(
                "same query",
                "gemini:gemini-embedding-001:768:query",
            ),
        );
        assert.notEqual(
            key,
            buildQueryEmbedCacheKey(
                "same query",
                "gemini:gemini-embedding-2:512:query",
            ),
        );
    });
});
