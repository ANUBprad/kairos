import OpenAI from "openai";
import {
    EMBEDDING_DIMENSIONS,
    EMBEDDING_MODEL,
    EMBEDDING_PROVIDER,
    GEMINI_EMBEDDING_MODEL,
    getEmbeddingMetadata,
    type AiProvider,
} from "./ai-config.js";
import { providerFetch } from "./provider-http.js";
import {
    buildQueryEmbedCacheKey,
    getCachedQueryEmbedding,
    setCachedQueryEmbedding,
} from "./rag/query-embed-cache.js";

export type EmbeddingTaskType = "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY";

export type EmbedTextsResult = {
    embeddings: number[][];
    promptTokens: number;
};

const GEMINI_EMBEDDING_PATH = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_EMBEDDING_MODEL)}:batchEmbedContents`;
const EMBED_BATCH_SIZE = 50;
const MAX_TEXT_CHARS = 20_000;

let openAiClient: OpenAI | null = null;

/** Stable identity for logs and tests; never includes credentials. */
export function embeddingIdentity(
    provider: AiProvider,
    model: string,
    dimensions: number,
    taskType: "document" | "query" = "document",
): string {
    return `${provider}:${model}:${dimensions}:${taskType}`;
}

/**
 * Validates and optionally L2-normalizes a provider vector.
 * Gemini `gemini-embedding-001` returns unnormalized vectors below 3072 dims;
 * Pinecone cosine search is consistent only when document and query vectors
 * follow the same convention.
 */
export function parseEmbeddingVector(
    raw: unknown,
    expectedDimensions: number,
    normalize = false,
): number[] {
    if (!Array.isArray(raw) || raw.length !== expectedDimensions) {
        const actual = Array.isArray(raw) ? raw.length : "non-array";
        throw new Error(
            `Embedding vector has ${actual} dimensions; expected ${expectedDimensions}. Use a dedicated Pinecone index for this embedding model.`,
        );
    }

    const values = raw.map((value, index) => {
        if (typeof value !== "number" || !Number.isFinite(value)) {
            throw new Error(`Embedding vector contains an invalid value at index ${index}`);
        }
        return value;
    });

    if (!normalize) return values;

    const norm = Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
    if (!Number.isFinite(norm) || norm === 0) {
        throw new Error("Embedding vector cannot be normalized (zero or invalid magnitude)");
    }
    return values.map((value) => value / norm);
}

/** Parses Gemini's batchEmbedContents response without trusting provider shape. */
export function parseGeminiEmbeddingResponse(
    payload: unknown,
    expectedDimensions: number,
    normalize: boolean,
): EmbedTextsResult {
    if (!payload || typeof payload !== "object") {
        throw new Error("Gemini embedding response was not an object");
    }

    const body = payload as {
        embeddings?: unknown;
        usageMetadata?: { promptTokenCount?: unknown };
    };
    if (!Array.isArray(body.embeddings)) {
        throw new Error("Gemini embedding response did not include embeddings");
    }

    const embeddings = body.embeddings.map((item) => {
        if (!item || typeof item !== "object") {
            throw new Error("Gemini embedding response contained an invalid embedding");
        }
        const values = (item as { values?: unknown }).values;
        return parseEmbeddingVector(values, expectedDimensions, normalize);
    });

    const promptTokenCount =
        typeof body.usageMetadata?.promptTokenCount === "number"
            ? Math.max(0, Math.floor(body.usageMetadata.promptTokenCount))
            : 0;

    return { embeddings, promptTokens: promptTokenCount };
}

function sanitizeTexts(texts: string[]): string[] {
    return texts.map((text) =>
        text && text.length > MAX_TEXT_CHARS
            ? text.slice(0, MAX_TEXT_CHARS)
            : text || " ",
    );
}

function summarizeProviderError(body: string): string {
    const compact = body.replace(/\s+/g, " ").trim();
    if (!compact) return "no response body";
    return compact.length > 400 ? `${compact.slice(0, 400)}…` : compact;
}

function geminiEmbeddingErrorMessage(status: number, body: string): Error {
    const detail = summarizeProviderError(body);
    if (status === 429 || /quota|rate limit/i.test(detail)) {
        return new Error(
            `Gemini embedding quota or rate limit reached (${status}): ${detail}. Check the Gemini API quota or set EMBEDDING_PROVIDER=openai with a dedicated index.`,
        );
    }
    if (status === 400) {
        return new Error(
            `Gemini embedding configuration was rejected (${status}): ${detail}. Verify EMBEDDING_MODEL and EMBEDDING_DIMENSIONS.`,
        );
    }
    return new Error(`Gemini embedding request failed (${status}): ${detail}`);
}

function needsNormalization(): boolean {
    return (
        EMBEDDING_PROVIDER === "gemini" &&
        GEMINI_EMBEDDING_MODEL === "gemini-embedding-001" &&
        EMBEDDING_DIMENSIONS < 3072
    );
}

async function embedWithGemini(
    texts: string[],
    taskType: EmbeddingTaskType,
): Promise<EmbedTextsResult> {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error(
            "GEMINI_API_KEY is not configured. Set it to use Gemini embeddings, or set EMBEDDING_PROVIDER=openai with OPENAI_API_KEY and a dedicated Pinecone index.",
        );
    }

    const normalize = needsNormalization();
    const embeddings: number[][] = [];
    let promptTokens = 0;

    for (let i = 0; i < texts.length; i += EMBED_BATCH_SIZE) {
        const batch = sanitizeTexts(texts.slice(i, i + EMBED_BATCH_SIZE));
        const body = JSON.stringify({
            requests: batch.map((text) => ({
                model: `models/${GEMINI_EMBEDDING_MODEL}`,
                content: { parts: [{ text }] },
                taskType,
                outputDimensionality: EMBEDDING_DIMENSIONS,
            })),
        });

        const response = await providerFetch(GEMINI_EMBEDDING_PATH, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": apiKey,
            },
            body,
        });

        if (!response.ok) {
            throw geminiEmbeddingErrorMessage(
                response.status,
                await response.text(),
            );
        }

        const payload: unknown = await response.json();
        const parsed = parseGeminiEmbeddingResponse(
            payload,
            EMBEDDING_DIMENSIONS,
            normalize,
        );
        if (parsed.embeddings.length !== batch.length) {
            throw new Error(
                `Gemini returned ${parsed.embeddings.length} embeddings for ${batch.length} inputs`,
            );
        }
        embeddings.push(...parsed.embeddings);
        promptTokens += parsed.promptTokens;
    }

    return { embeddings, promptTokens };
}

function getOpenAiClient(): OpenAI {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error(
            "OPENAI_API_KEY is not configured. Set it to use OpenAI embeddings, or set EMBEDDING_PROVIDER=gemini with GEMINI_API_KEY and a dedicated Pinecone index.",
        );
    }
    if (!openAiClient) {
        openAiClient = new OpenAI({ apiKey });
    }
    return openAiClient;
}

async function embedWithOpenAi(texts: string[]): Promise<EmbedTextsResult> {
    const response = await getOpenAiClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: sanitizeTexts(texts),
        dimensions: EMBEDDING_DIMENSIONS,
    });

    const embeddings = response.data
        .sort((a, b) => a.index - b.index)
        .map((item) =>
            parseEmbeddingVector(item.embedding, EMBEDDING_DIMENSIONS),
        );

    return {
        embeddings,
        promptTokens: response.usage?.prompt_tokens ?? 0,
    };
}

/** Generates embeddings with the configured provider and retrieval task type. */
export async function embedTextsWithUsage(
    texts: string[],
    taskType: EmbeddingTaskType = "RETRIEVAL_DOCUMENT",
): Promise<EmbedTextsResult> {
    if (texts.length === 0) {
        return { embeddings: [], promptTokens: 0 };
    }

    const identity = embeddingIdentity(
        EMBEDDING_PROVIDER,
        EMBEDDING_MODEL,
        EMBEDDING_DIMENSIONS,
        taskType === "RETRIEVAL_QUERY" ? "query" : "document",
    );

    try {
        return EMBEDDING_PROVIDER === "gemini"
            ? await embedWithGemini(texts, taskType)
            : await embedWithOpenAi(texts);
    } catch (error) {
        throw new Error(`Embedding provider ${identity} failed: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
    const { embeddings } = await embedTextsWithUsage(
        texts,
        "RETRIEVAL_DOCUMENT",
    );
    return embeddings;
}

export async function embedQueryText(query: string): Promise<{
    embedding: number[] | null;
    cacheHit: boolean;
    promptTokens: number;
}> {
    const cacheKey = buildQueryEmbedCacheKey(query);
    const cached = await getCachedQueryEmbedding(cacheKey);
    if (cached) {
        const embedding = parseEmbeddingVector(cached, EMBEDDING_DIMENSIONS);
        return { embedding, cacheHit: true, promptTokens: 0 };
    }

    const { embeddings, promptTokens } = await embedTextsWithUsage(
        [query],
        "RETRIEVAL_QUERY",
    );
    const embedding = embeddings[0] ?? null;

    if (embedding) {
        await setCachedQueryEmbedding(cacheKey, embedding);
    }

    return { embedding, cacheHit: false, promptTokens };
}

/** Metadata identity for Pinecone writes and query filters. */
export function embeddingMetadata() {
    return getEmbeddingMetadata();
}
