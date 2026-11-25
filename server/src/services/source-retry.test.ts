import assert from "node:assert/strict";
import { describe, it } from "node:test";

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
    for (const [field, condition] of Object.entries(where)) {
        const actual = row[field];
        if (condition && typeof condition === "object" && !(condition instanceof Date)) {
            const range = condition as Row;
            if (range.in !== undefined && !(range.in as unknown[]).includes(actual)) {
                return false;
            }
            if (range.not !== undefined && actual === range.not) return false;
            continue;
        }
        if (actual !== condition) return false;
    }
    return true;
}

function createState() {
    return {
        sources: new Map<string, Row>(),
        jobs: new Map<string, Row>(),
        ledger: [] as Row[],
        workspaces: new Map<string, Row>([
            ["w1", { id: "w1", userId: "u1" }],
        ]),
    };
}

type State = ReturnType<typeof createState>;

function makeDb(state: State) {
    const durableJob = {
        createMany: async ({
            data,
            skipDuplicates,
        }: {
            data: Row[];
            skipDuplicates?: boolean;
        }) => {
            let count = 0;
            for (const row of data) {
                const key = String(row.key);
                if (state.jobs.has(key)) {
                    if (skipDuplicates) continue;
                    throw Object.assign(new Error("duplicate key"), { code: "P2002" });
                }
                state.jobs.set(key, {
                    deliveredAt: null,
                    lastError: null,
                    leaseToken: null,
                    leaseExpiresAt: null,
                    heartbeatAt: null,
                    updatedAt: new Date(),
                    ...row,
                });
                count += 1;
            }
            return { count };
        },
        findUnique: async ({ where }: { where: { key: string } }) =>
            state.jobs.get(where.key) ?? null,
        updateMany: async ({
            where,
            data,
        }: {
            where: Row;
            data: Row;
        }) => {
            let count = 0;
            for (const job of state.jobs.values()) {
                if (!matches(job, where)) continue;
                Object.assign(job, data, { updatedAt: new Date() });
                count += 1;
            }
            return { count };
        },
    };

    const source = {
        findFirst: async ({ where }: { where: Row }) =>
            [...state.sources.values()].find((row) => matches(row, where)) ?? null,
        findUnique: async ({ where }: { where: { id: string } }) =>
            state.sources.get(where.id) ?? null,
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
            let count = 0;
            for (const row of state.sources.values()) {
                if (!matches(row, where)) continue;
                Object.assign(row, data);
                count += 1;
            }
            return { count };
        },
    };

    const creditTransaction = {
        findUnique: async ({
            where,
        }: {
            where: { idempotencyKey?: string };
        }) =>
            state.ledger.find(
                (row) => row.idempotencyKey === where.idempotencyKey,
            ) ?? null,
        findMany: async ({
            where,
        }: {
            where?: { idempotencyKey?: { in?: string[] } };
        }) => {
            const keys = where?.idempotencyKey?.in;
            return state.ledger.filter(
                (row) => !keys || keys.includes(row.idempotencyKey),
            );
        },
    };

    const db = {
        durableJob,
        source,
        creditTransaction,
        workspace: {
            findFirst: async ({ where }: { where: { id: string; userId: string } }) =>
                state.workspaces.get(where.id) ?? null,
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    };
    return db;
}

const state = createState();
const db = makeDb(state);
Object.assign(globalThis, { prisma: db });

const { setOutboxStoreForTests } = await import("../lib/outbox.js");
setOutboxStoreForTests(db as any);
const {
    describeEmbeddingFailure,
} = await import("./source-processing.services.js");
const {
    applySourceRetryState,
    getSourceForWorkspace,
    reprocessSourceForWorkspace,
} = await import("./source.services.js");

function seed(options: {
    status?: string;
    jobStatus?: string;
    refunded?: boolean;
} = {}) {
    state.sources.clear();
    state.jobs.clear();
    state.ledger.length = 0;

    state.sources.set("s1", {
        id: "s1",
        workspaceId: "w1",
        type: "YOUTUBE",
        title: "YouTube source",
        content: "transcript text",
        url: "https://www.youtube.com/watch?v=0SWb97L8nI8",
        status: options.status ?? "FAILED",
        metadata: { processingError: "429 You have no credits remaining" },
        createdAt: new Date(),
        updatedAt: new Date(),
    });
    state.jobs.set("source.process:s1", {
        key: "source.process:s1",
        type: "source.process",
        payload: { sourceId: "s1", workspaceId: "w1" },
        status: options.jobStatus ?? "DEAD",
        attempts: 5,
        maxAttempts: 5,
        availableAt: new Date(),
    });
    if (options.refunded) {
        state.ledger.push({ id: "refund-1", idempotencyKey: "source-refund:s1" });
    }
}

describe("source retry lifecycle", () => {
    it("derives refund state from the credit ledger", async () => {
        seed({ refunded: true });

        const source = await getSourceForWorkspace("w1", "s1", "u1");
        assert.equal(source.refunded, true);
        assert.equal(source.canReprocess, false);
    });

    it("marks an unrefunded failed source as retryable", async () => {
        seed();

        const source = await getSourceForWorkspace("w1", "s1", "u1");
        assert.equal(source.refunded, false);
        assert.equal(source.canReprocess, true);
    });

    it("applies retry state in batches without mutating source rows", () => {
        const sources = [
            { id: "s1", status: "FAILED" as const },
            { id: "s2", status: "FAILED" as const },
        ] as any[];
        const result = applySourceRetryState(sources, new Set(["s2"]));

        assert.equal(result[0]?.refunded, false);
        assert.equal(result[0]?.canReprocess, true);
        assert.equal(result[1]?.refunded, true);
        assert.equal(result[1]?.canReprocess, false);
        assert.equal(sources[0]?.refunded, undefined);
    });

    it("rejects a refunded terminal source without dispatching work", async () => {
        seed({ refunded: true });
        let dispatchCalls = 0;

        await assert.rejects(
            () =>
                reprocessSourceForWorkspace("w1", "s1", "u1", async () => {
                    dispatchCalls += 1;
                    return true;
                }),
            /refunded after a terminal failure/,
        );

        assert.equal(dispatchCalls, 0);
        assert.equal(state.sources.get("s1")?.status, "FAILED");
    });

    it("does not rewind a failed source when its job cannot be requeued", async () => {
        seed({ jobStatus: "DELIVERED" });
        let dispatchCalls = 0;

        await assert.rejects(
            () =>
                reprocessSourceForWorkspace("w1", "s1", "u1", async () => {
                    dispatchCalls += 1;
                    return true;
                }),
            /live or already completed processing job/,
        );

        assert.equal(state.sources.get("s1")?.status, "FAILED");
        assert.equal(state.sources.get("s1")?.metadata.processingError, "429 You have no credits remaining");
        assert.equal(dispatchCalls, 0);
    });

    it("requeues then rewinds a failed source exactly once per accepted retry", async () => {
        seed();
        const dispatched: string[] = [];

        const result = await reprocessSourceForWorkspace(
            "w1",
            "s1",
            "u1",
            async (key) => {
                dispatched.push(key);
                return true;
            },
        );

        assert.deepEqual(result, { reprocessed: true });
        assert.deepEqual(dispatched, ["source.process:s1"]);
        assert.equal(state.jobs.size, 1);
        assert.equal(state.jobs.get("source.process:s1")?.status, "PENDING");
        assert.equal(state.jobs.get("source.process:s1")?.attempts, 0);
        assert.equal(state.sources.get("s1")?.status, "PENDING");
        assert.equal(
            state.sources.get("s1")?.metadata.processingError,
            undefined,
        );
        assert.ok(state.sources.get("s1")?.metadata.retriedAt);
    });
});

describe("embedding failure reporting", () => {
    it("keeps provider billing detail while naming the failed stage", () => {
        const message = describeEmbeddingFailure(
            new Error(
                "429 You have no credits remaining. Add credits to continue using the API.",
            ),
        );

        assert.match(
            message,
            /Embedding provider failed while indexing source: 429 You have no credits remaining/,
        );
    });
});
