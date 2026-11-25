import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

const WORKSPACE_ID = "workspace-1";
const originalOpenAiKey = process.env.OPENAI_API_KEY;
const originalGeminiKey = process.env.GEMINI_API_KEY;
delete process.env.OPENAI_API_KEY;
delete process.env.GEMINI_API_KEY;

type SourceRow = {
    id: string;
    workspaceId: string;
    title: string;
    type: string;
    content: string | null;
    status: "READY" | "FAILED";
};

type ChunkRow = {
    id: string;
    workspaceId: string;
    sourceId: string;
    index: number;
    content: string;
    metadata: Record<string, unknown>;
    source: {
        id: string;
        title: string;
        type: string;
        status: SourceRow["status"];
    };
};

type SourceFindManyArgs = {
    where?: {
        workspaceId?: string;
        status?: string;
        id?: { in?: string[] };
    };
};

type ChunkFindManyArgs = {
    where?: {
        source?: {
            workspaceId?: string;
            status?: string;
        };
    };
};

const sourceRows: SourceRow[] = [
    {
        id: "source-ready",
        workspaceId: WORKSPACE_ID,
        title: "Ready PDF",
        type: "PDF",
        content: "Revenue grew 12% after the launch.",
        status: "READY",
    },
    {
        id: "source-failed",
        workspaceId: WORKSPACE_ID,
        title: "Failed PDF",
        type: "PDF",
        content: "This content must never be retrieved.",
        status: "FAILED",
    },
];

const readyChunk: ChunkRow = {
    id: "chunk-ready",
    workspaceId: WORKSPACE_ID,
    sourceId: "source-ready",
    index: 0,
    content: "Revenue grew 12% after the launch.",
    metadata: { page: 2 },
    source: {
        id: "source-ready",
        title: "Ready PDF",
        type: "PDF",
        status: "READY",
    },
};

const failedChunk: ChunkRow = {
    id: "chunk-failed",
    workspaceId: WORKSPACE_ID,
    sourceId: "source-failed",
    index: 0,
    content: "Failed source content must never be retrieved.",
    metadata: { page: 1 },
    source: {
        id: "source-failed",
        title: "Failed PDF",
        type: "PDF",
        status: "FAILED",
    },
};

let chunkRows: ChunkRow[] = [readyChunk, failedChunk];
const sourceFindManyCalls: SourceFindManyArgs[] = [];
const chunkFindManyCalls: ChunkFindManyArgs[] = [];

/** Minimal in-memory stand-in for the Prisma filters used by retrieval. */
Object.assign(globalThis, {
    prisma: {
        queryEmbeddingCache: {
            findUnique: async () => null,
        },
        sourceChunk: {
            findMany: async (args: ChunkFindManyArgs) => {
                chunkFindManyCalls.push(args);
                const sourceWhere = args.where?.source;
                return chunkRows.filter((chunk) => {
                    if (
                        sourceWhere?.workspaceId &&
                        chunk.workspaceId !== sourceWhere.workspaceId
                    ) {
                        return false;
                    }
                    return (
                        !sourceWhere?.status ||
                        chunk.source.status === sourceWhere.status
                    );
                });
            },
        },
        source: {
            findMany: async (args: SourceFindManyArgs) => {
                sourceFindManyCalls.push(args);
                const where = args.where ?? {};
                return sourceRows.filter((source) => {
                    if (
                        where.workspaceId &&
                        source.workspaceId !== where.workspaceId
                    ) {
                        return false;
                    }
                    if (where.status && source.status !== where.status) {
                        return false;
                    }
                    return (
                        !where.id?.in || where.id.in.includes(source.id)
                    );
                });
            },
        },
    },
});

const {
    reconcileRetrievedChunksWithSources,
    reconcileWorkspaceCitations,
} = await import("./reconcile.js");
const { retrieveWorkspaceCandidates } = await import("./retrieve.js");

after(() => {
    if (originalOpenAiKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = originalOpenAiKey;
    if (originalGeminiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGeminiKey;
});

describe("READY-only retrieval", () => {
    it("drops non-READY chunks from database fallback and reconciliation", async () => {
        chunkRows = [readyChunk, failedChunk];
        sourceFindManyCalls.length = 0;
        chunkFindManyCalls.length = 0;

        const chunks = await retrieveWorkspaceCandidates(
            WORKSPACE_ID,
            "currency growth",
        );

        assert.deepEqual(
            chunks.map((chunk) => chunk.sourceId),
            ["source-ready"],
        );
        assert.equal(chunks[0]?.sourceTitle, "Ready PDF");
        assert.equal(chunks[0]?.page, 2);
        assert.ok(
            chunkFindManyCalls.some(
                (call) => call.where?.source?.status === "READY",
            ),
        );
        assert.ok(
            sourceFindManyCalls.some(
                (call) =>
                    call.where?.status === "READY" &&
                    call.where.id?.in?.includes("source-ready"),
            ),
        );
    });

    it("uses only READY sources for root-content fallback", async () => {
        chunkRows = [];
        sourceFindManyCalls.length = 0;
        chunkFindManyCalls.length = 0;

        const chunks = await retrieveWorkspaceCandidates(
            WORKSPACE_ID,
            "currency growth",
        );

        assert.deepEqual(
            chunks.map((chunk) => chunk.sourceId),
            ["source-ready"],
        );
        assert.equal(chunks[0]?.text, sourceRows[0]!.content);
        assert.ok(
            sourceFindManyCalls.some(
                (call) =>
                    call.where?.workspaceId === WORKSPACE_ID &&
                    call.where.status === "READY" &&
                    call.where.id === undefined,
            ),
        );
    });

    it("drops stale vector matches whose source is not READY", async () => {
        const chunks = await reconcileRetrievedChunksWithSources(
            WORKSPACE_ID,
            [
                {
                    sourceId: "source-ready",
                    sourceTitle: "Stale title",
                    sourceType: "PDF",
                    chunkId: "vector-ready",
                    chunkIndex: 0,
                    text: "ready",
                    score: 0.9,
                },
                {
                    sourceId: "source-failed",
                    sourceTitle: "Failed PDF",
                    sourceType: "PDF",
                    chunkId: "vector-failed",
                    chunkIndex: 0,
                    text: "failed",
                    score: 0.99,
                },
            ],
        );

        assert.deepEqual(
            chunks.map((chunk) => chunk.sourceId),
            ["source-ready"],
        );
        assert.equal(chunks[0]?.sourceTitle, "Ready PDF");
    });

    it("drops citations for non-READY sources but keeps web citations", async () => {
        const citations = await reconcileWorkspaceCitations(
            WORKSPACE_ID,
            [
                {
                    sourceId: "source-ready",
                    sourceTitle: "Stale title",
                    sourceType: "PDF",
                },
                {
                    sourceId: "source-failed",
                    sourceTitle: "Failed PDF",
                    sourceType: "PDF",
                },
                {
                    sourceTitle: "Web result",
                    sourceType: "WEB",
                    url: "https://example.com",
                },
            ],
        );

        assert.deepEqual(citations, [
            {
                sourceId: "source-ready",
                sourceTitle: "Ready PDF",
                sourceType: "PDF",
            },
            {
                sourceTitle: "Web result",
                sourceType: "WEB",
                url: "https://example.com",
            },
        ]);
    });
});
