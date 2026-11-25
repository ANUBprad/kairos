import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

type LeaseRow = {
    status: "PROCESSING" | "DELIVERED";
    leaseToken: string | null;
    leaseExpiresAt: Date | null;
};

const JOB_KEY = "source.process:s1";
const OLD_TOKEN = "old-worker-token";
const NEW_TOKEN = "new-worker-token";

let leaseRow: LeaseRow;
let sourceUpdateManyCalls: number;
let sourceUpdateCalls: number;
let chunkDeleteCalls: number;
let transactionCalls: number;

const source = {
    id: "s1",
    workspaceId: "w1",
    type: "TEXT" as const,
    title: "Lease test source",
    content: "Text that is safe to chunk.",
    url: null,
    status: "PROCESSING" as const,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
};

const prismaMock = {
    durableJob: {
        findUnique: async () => leaseRow,
    },
    source: {
        findUnique: async () => source,
        findUniqueOrThrow: async () => source,
        updateMany: async () => {
            sourceUpdateManyCalls += 1;
            return { count: 1 };
        },
        update: async () => {
            sourceUpdateCalls += 1;
            return source;
        },
    },
    sourceChunk: {
        deleteMany: async () => {
            chunkDeleteCalls += 1;
            return { count: 0 };
        },
    },
    workspace: {
        findUnique: async () => ({ userId: "u1" }),
    },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => {
        transactionCalls += 1;
        return fn(prismaMock);
    },
};

Object.assign(globalThis, { prisma: prismaMock });

const { DurableJobLeaseLostError } = await import("../lib/outbox.js");
const {
    chunkSourceContent,
    embedAndIndexSource,
    extractSourceContent,
    markSourceFailed,
    markSourceProcessing,
} = await import("./source-processing.services.js");

const staleLease = { jobKey: JOB_KEY, leaseToken: OLD_TOKEN };
const activeLease = { jobKey: JOB_KEY, leaseToken: NEW_TOKEN };

describe("source processing lease guards", () => {
    beforeEach(() => {
        leaseRow = {
            status: "PROCESSING",
            leaseToken: NEW_TOKEN,
            leaseExpiresAt: new Date(Date.now() + 60_000),
        };
        sourceUpdateManyCalls = 0;
        sourceUpdateCalls = 0;
        chunkDeleteCalls = 0;
        transactionCalls = 0;
    });

    it("refuses to claim a source with a reissued job lease", async () => {
        await assert.rejects(
            () => markSourceProcessing(source.id, staleLease),
            DurableJobLeaseLostError,
        );
        assert.equal(sourceUpdateManyCalls, 0);
    });

    it("refuses to persist extracted content with a stale lease", async () => {
        await assert.rejects(
            () => extractSourceContent(source.id, staleLease),
            DurableJobLeaseLostError,
        );
        assert.equal(sourceUpdateCalls, 0);
    });

    it("refuses to rebuild chunks with a stale lease", async () => {
        await assert.rejects(
            () =>
                chunkSourceContent(
                    source.id,
                    source.content!,
                    undefined,
                    {},
                    staleLease,
                ),
            DurableJobLeaseLostError,
        );
        assert.equal(chunkDeleteCalls, 0);
    });

    it("refuses to delete vectors or mark READY with a stale lease", async () => {
        await assert.rejects(
            () => embedAndIndexSource(source, [], staleLease),
            DurableJobLeaseLostError,
        );
        assert.equal(sourceUpdateManyCalls, 0);
    });

    it("refuses to fail or refund a source with a stale lease", async () => {
        await assert.rejects(
            () =>
                markSourceFailed(
                    source.id,
                    new Error("late failure"),
                    source.metadata,
                    staleLease,
                ),
            DurableJobLeaseLostError,
        );
        assert.equal(sourceUpdateManyCalls, 0);
        assert.equal(transactionCalls, 0);
    });

    it("allows a live lease holder to claim the source", async () => {
        const claimed = await markSourceProcessing(source.id, activeLease);

        assert.equal(claimed?.id, source.id);
        assert.equal(sourceUpdateManyCalls, 1);
    });
});
