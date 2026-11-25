export type AiProvider = "gemini" | "openai";

function providerFromEnv(
    value: string | undefined,
    fallback: AiProvider,
): AiProvider {
    const normalized = value?.trim().toLowerCase();
    return normalized === "gemini" || normalized === "openai"
        ? normalized
        : fallback;
}

function dimensionsFromEnv(): number {
    const parsed = Number(process.env.EMBEDDING_DIMENSIONS);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 512;
}

/** Provider used for chat streaming, artifacts, summaries and podcast turns. */
export const CHAT_PROVIDER: AiProvider = providerFromEnv(
    process.env.CHAT_PROVIDER,
    "gemini",
);

/** Provider used for RAG document and query embeddings. */
export const EMBEDDING_PROVIDER: AiProvider = providerFromEnv(
    process.env.EMBEDDING_PROVIDER,
    "gemini",
);

/** Provider used for image OCR. Defaults to the chat provider. */
export const OCR_PROVIDER: AiProvider = providerFromEnv(
    process.env.OCR_PROVIDER,
    CHAT_PROVIDER,
);

export const GEMINI_CHAT_MODEL =
    process.env.GEMINI_CHAT_MODEL?.trim() || "gemini-3.6-flash";
export const GEMINI_SECONDARY_CHAT_MODEL =
    process.env.GEMINI_SECONDARY_CHAT_MODEL?.trim() || "gemini-3.5-flash-lite";
export const GEMINI_OCR_MODEL =
    process.env.GEMINI_OCR_MODEL?.trim() || GEMINI_CHAT_MODEL;
export const GEMINI_EMBEDDING_MODEL =
    process.env.GEMINI_EMBEDDING_MODEL?.trim() || "gemini-embedding-001";

export const OPENAI_CHAT_MODEL =
    process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";
export const OPENAI_PRO_CHAT_MODEL =
    process.env.OPENAI_PRO_CHAT_MODEL?.trim() || "gpt-4o";
export const OPENAI_OCR_MODEL =
    process.env.OPENAI_OCR_MODEL?.trim() || "gpt-4o-mini";
export const OPENAI_EMBEDDING_MODEL =
    process.env.OPENAI_EMBEDDING_MODEL?.trim() || "text-embedding-3-small";

export const GEMINI_CHAT_MODELS = [
    GEMINI_CHAT_MODEL,
    GEMINI_SECONDARY_CHAT_MODEL,
] as const;
export const OPENAI_CHAT_MODELS = [
    OPENAI_CHAT_MODEL,
    OPENAI_PRO_CHAT_MODEL,
] as const;

/** All model ids accepted by request validators. The active provider maps them at runtime. */
export const CHAT_MODELS = [
    ...GEMINI_CHAT_MODELS,
    ...OPENAI_CHAT_MODELS,
] as const;

/** Effective default chat model for the configured provider. */
export const CHAT_MODEL =
    CHAT_PROVIDER === "gemini" ? GEMINI_CHAT_MODEL : OPENAI_CHAT_MODEL;

/** Effective vision model for image OCR. */
export const OCR_VISION_MODEL =
    OCR_PROVIDER === "gemini" ? GEMINI_OCR_MODEL : OPENAI_OCR_MODEL;

/** Effective embedding model for RAG indexing and queries. */
export const EMBEDDING_MODEL =
    EMBEDDING_PROVIDER === "gemini"
        ? GEMINI_EMBEDDING_MODEL
        : OPENAI_EMBEDDING_MODEL;

/** Vector dimension count — must match the Pinecone index configuration. */
export const EMBEDDING_DIMENSIONS = dimensionsFromEnv();

/**
 * Resolves a client/workspace model id against the active provider.
 * Legacy ids from the other provider fall back to the configured default so
 * existing workspace preferences keep working after a provider switch.
 */
export function resolveChatModelId(requested?: string): string {
    const allowed: readonly string[] =
        CHAT_PROVIDER === "gemini" ? GEMINI_CHAT_MODELS : OPENAI_CHAT_MODELS;
    return requested && allowed.includes(requested) ? requested : CHAT_MODEL;
}

/** Identity written to every vector so different embedding spaces never mix. */
export function getEmbeddingMetadata(): {
    embeddingProvider: AiProvider;
    embeddingModel: string;
    embeddingDimensions: number;
} {
    return {
        embeddingProvider: EMBEDDING_PROVIDER,
        embeddingModel: EMBEDDING_MODEL,
        embeddingDimensions: EMBEDDING_DIMENSIONS,
    };
}

/** Cache/query identity including the retrieval task type. */
export function getEmbeddingIdentity(
    taskType: "document" | "query" = "document",
): string {
    const { embeddingProvider, embeddingModel, embeddingDimensions } =
        getEmbeddingMetadata();
    return `${embeddingProvider}:${embeddingModel}:${embeddingDimensions}:${taskType}`;
}

/** Target max characters per text chunk during source processing. */
export const CHUNK_SIZE = 1000;

/** Character overlap between consecutive chunks at split boundaries. */
export const CHUNK_OVERLAP = 100;

/** Number of Pinecone candidates to fetch before reranking. */
export const RAG_RETRIEVE_K = Number(process.env.RAG_RETRIEVE_K) || 20;

/** Number of chunks included in chat context after rerank. */
export const RAG_TOP_K = Number(process.env.RAG_TOP_K) || 6;

/** Minimum similarity / rerank score for a retrieved chunk to be included in context. */
export const RAG_MIN_SCORE = Number(process.env.RAG_MIN_SCORE) || 0.20;

/** When true, rerank Pinecone candidates before building context. */
export const RERANK_ENABLED =
    process.env.RERANK_ENABLED !== "false" && process.env.RERANK_ENABLED !== "0";

/** Rerank model identifier (Cohere API). */
export const RERANK_MODEL =
    process.env.RERANK_MODEL?.trim() || "rerank-v3.5";

/** TTL for cached query embeddings (seconds). */
export const QUERY_EMBED_CACHE_TTL_SEC =
    Number(process.env.QUERY_EMBED_CACHE_TTL_SEC) || 86400;

/** If the model cites nothing, persist top-N retrieved chunks as citations. */
export const CITATION_FALLBACK_TOP_N =
    Number(process.env.CITATION_FALLBACK_TOP_N) || 1;

/** Enqueue a conversation summary job every N persisted messages. */
export const CONVERSATION_SUMMARY_INTERVAL = 8;

/** Max recent UI messages sent to the model when a rolling summary exists. */
export const RECENT_MESSAGE_WINDOW = 12;
