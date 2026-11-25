import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
    embeddingIdentity,
    parseEmbeddingVector,
    parseGeminiEmbeddingResponse,
} from "./embeddings.js";

describe("embedding helpers", () => {
    it("builds a stable identity that separates providers, models, dimensions and tasks", () => {
        assert.equal(
            embeddingIdentity("gemini", "gemini-embedding-001", 512, "query"),
            "gemini:gemini-embedding-001:512:query",
        );
        assert.notEqual(
            embeddingIdentity("gemini", "gemini-embedding-001", 512, "query"),
            embeddingIdentity("openai", "gemini-embedding-001", 512, "query"),
        );
        assert.notEqual(
            embeddingIdentity("gemini", "gemini-embedding-001", 512),
            embeddingIdentity("gemini", "gemini-embedding-001", 768),
        );
    });

    it("rejects wrong dimensions with a reindex hint and invalid numbers", () => {
        assert.throws(
            () => parseEmbeddingVector([0.1, 0.2], 3),
            /dedicated Pinecone index/,
        );
        assert.throws(
            () => parseEmbeddingVector([0.1, Number.NaN], 2),
            /invalid value at index 1/,
        );
    });

    it("L2-normalizes vectors when requested", () => {
        const vector = parseEmbeddingVector([3, 4], 2, true);
        assert.ok(Math.abs(vector[0]! - 0.6) < 1e-9);
        assert.ok(Math.abs(vector[1]! - 0.8) < 1e-9);
        const norm = Math.sqrt(vector.reduce((sum, value) => sum + value ** 2, 0));
        assert.ok(Math.abs(norm - 1) < 1e-9);
    });

    it("parses Gemini batch responses and token usage", () => {
        const result = parseGeminiEmbeddingResponse(
            {
                embeddings: [
                    { values: [3, 4] },
                    { values: [0, 5] },
                ],
                usageMetadata: { promptTokenCount: 17 },
            },
            2,
            true,
        );

        assert.equal(result.embeddings.length, 2);
        assert.equal(result.promptTokens, 17);
        assert.ok(Math.abs(result.embeddings[0]![0]! - 0.6) < 1e-9);
        assert.deepEqual(result.embeddings[1], [0, 1]);
    });

    it("rejects malformed Gemini responses", () => {
        assert.throws(
            () => parseGeminiEmbeddingResponse({ embeddings: [{ values: [1] }] }, 2, false),
            /expected 2/,
        );
        assert.throws(
            () => parseGeminiEmbeddingResponse({}, 2, false),
            /did not include embeddings/,
        );
    });
});
