import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import { ForbiddenError } from "../types/app-error.js";
import {
    claimArtifactForProcessing,
    completeArtifactProcessing,
    markArtifactFailedIfEligible,
} from "../repository/artifact.repository.js";
import { refundChargeInTransaction } from "./credit.services.js";
import { assertQuotaInTransaction } from "./usage.services.js";
import { insertArtifactCreationInTransaction } from "./artifact.services.js";
import { insertSourceCreationInTransaction } from "./source.services.js";
import { compensateChatFailure } from "./chat.services.js";

type Row = Record<string, any>;

function toComparable(value: unknown): number | string {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return new Date(value as string).getTime();
}

function lessThan(actual: unknown, expected: unknown): boolean {
    return toComparable(actual) < toComparable(expected);
}

function equalValue(actual: unknown, expected: unknown): boolean {
    if (typeof actual === "number" && typeof expected === "number") {
        return actual === expected;
    }
    return new Date(actual as string).getTime() === new Date(expected as string).getTime();
}

function matches(row: Row, where: Row = {}): boolean {
    if (Array.isArray(where.OR)) {
        if (!where.OR.some((alternative: Row) => matches(row, alternative))) return false;
    }
    for (const [field, condition] of Object.entries(where)) {
        if (field === "OR") continue;
        const actual = row[field];
        if (condition instanceof Date) {
            if (new Date(actual).getTime() !== condition.getTime()) return false;
            continue;
        }
        if (condition && typeof condition === "object") {
            const range = condition as Row;
            if (range.in !== undefined && !(range.in as unknown[]).includes(actual)) return false;
            if (range.not !== undefined && actual === range.not) return false;
            if (range.lt !== undefined && !lessThan(actual, range.lt)) return false;
            if (range.lte !== undefined && !(lessThan(actual, range.lte) || equalValue(actual, range.lte))) return false;
            continue;
        }
        if (actual !== condition) return false;
    }
    return true;
}

function createState() {
    return {
        users: new Map<string, Row>(),
        artifacts: new Map<string, Row>(),
        sources: new Map<string, Row>(),
        workspaces: new Map<string, Row>([["w1", { id: "w1", userId: "u1" }]]),
        jobs: new Map<string, Row>(),
        ledger: [] as Row[],
        nextId: 0,
    };
}
type State = ReturnType<typeof createState>;

type FakeTransactionClient = Prisma.TransactionClient & {
    $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
};

function cloneMap(map: Map<string, Row>): Map<string, Row> {
    return new Map([...map].map(([key, row]) => [key, { ...row }]));
}

function snapshot(state: State): State {
    return {
        users: cloneMap(state.users),
        artifacts: cloneMap(state.artifacts),
        sources: cloneMap(state.sources),
        workspaces: cloneMap(state.workspaces),
        jobs: cloneMap(state.jobs),
        ledger: state.ledger.map((row) => ({ ...row })),
        nextId: state.nextId,
    };
}

function restore(state: State, saved: State): void {
    state.users = cloneMap(saved.users);
    state.artifacts = cloneMap(saved.artifacts);
    state.sources = cloneMap(saved.sources);
    state.workspaces = cloneMap(saved.workspaces);
    state.jobs = cloneMap(saved.jobs);
    state.ledger = saved.ledger.map((row) => ({ ...row }));
    state.nextId = saved.nextId;
}

function createUser(state: State, overrides: Row = {}) {
    const user = {
        id: "u1",
        credits: 50,
        plan: "FREE",
        planExpiresAt: null,
        totalArtifactsCreated: 0,
        ...overrides,
    };
    state.users.set(user.id, user);
    return user;
}

function makeTx(
    state: State,
    failures: { at?: string; onUpdateManyCall?: number } = {},
): Prisma.TransactionClient {
    let updateManyCalls = 0;

    const user = {
        findUnique: async ({ where }: { where: { id: string } }) =>
            state.users.get(where.id) ?? null,
        findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
            const found = state.users.get(where.id);
            if (!found) throw new Error("user missing");
            return found;
        },
        update: async ({ where, data }: { where: { id: string }; data: Row }) => {
            const found = state.users.get(where.id);
            if (found) Object.assign(found, applyNumeric(data, found));
            return found;
        },
        updateMany: async ({ where, data }: { where: Row; data: Row }) => {
            updateManyCalls += 1;
            if (
                failures.onUpdateManyCall !== undefined &&
                updateManyCalls === failures.onUpdateManyCall
            ) {
                throw new Error("counter update failed");
            }
            let count = 0;
            for (const found of state.users.values()) {
                if (!matches(found, where)) continue;
                const next = applyNumeric(data, found);
                if (data.totalArtifactsCreated?.increment !== undefined) {
                    const max = (where.totalArtifactsCreated as Row)?.lt;
                    if (max !== undefined && found.totalArtifactsCreated >= max) continue;
                }
                Object.assign(found, next);
                count += 1;
            }
            return { count };
        },
    };

    const creditTransaction = {
        findUnique: async ({ where }: { where: { idempotencyKey?: string } }) =>
            (where.idempotencyKey
                ? state.ledger.find((row) => row.idempotencyKey === where.idempotencyKey)
                : null) ?? null,
        create: async ({ data }: { data: Row }) => {
            if (state.ledger.some((row) => row.idempotencyKey === data.idempotencyKey)) {
                throw Object.assign(new Error("duplicate ledger key"), { code: "P2002" });
            }
            state.ledger.push({ ...data, id: `ledger-${++state.nextId}` });
            return data;
        },
    };

    const durableJob = {
        createMany: async ({ data }: { data: Row[] }) => {
            if (failures.at === "durableJob") throw new Error("enqueue failed");
            let count = 0;
            for (const row of data) {
                if (state.jobs.has(String(row.key))) continue;
                state.jobs.set(String(row.key), { ...row });
                count += 1;
            }
            return { count };
        },
    };

    const tx = {
        user,
        creditTransaction,
        durableJob,
        learningArtifact: {
            create: async ({ data }: { data: Row }) => {
                const row = {
                    id: data.id ?? `artifact-${++state.nextId}`,
                    status: "PENDING",
                    leaseToken: null,
                    leaseExpiresAt: null,
                    ...data,
                };
                state.artifacts.set(row.id, row);
                return row;
            },
            findUnique: async ({ where }: { where: { id: string } }) =>
                state.artifacts.get(where.id) ?? null,
            updateMany: async ({ where, data }: { where: Row; data: Row }) => {
                let count = 0;
                for (const row of state.artifacts.values()) {
                    if (!matches(row, where)) continue;
                    Object.assign(row, data);
                    count += 1;
                }
                return { count };
            },
        },
        source: {
            create: async ({ data }: { data: Row }) => {
                const row = { id: `source-${++state.nextId}`, status: "PENDING", ...data };
                state.sources.set(row.id, row);
                return row;
            },
            count: async ({ where }: { where: Row }) => {
                const owner = (where.workspace as Row)?.userId;
                return [...state.sources.values()].filter(
                    (source) => state.workspaces.get(source.workspaceId)?.userId === owner,
                ).length;
            },
            findUnique: async () => null,
            updateMany: async () => ({ count: 0 }),
        },
        workspace: {
            findUnique: async () => ({ userId: "u1" }),
        },
        $queryRaw: undefined,
        $transaction: async (fn: (inner: unknown) => Promise<unknown>) => {
            const saved = snapshot(state);
            try {
                return await fn(tx);
            } catch (error) {
                restore(state, saved);
                throw error;
            }
        },
    };

    return tx as unknown as FakeTransactionClient;
}

function applyNumeric(data: Row, current: Row): Row {
    const next: Row = { ...data };
    for (const [field, operation] of Object.entries(data)) {
        if (!operation || typeof operation !== "object") continue;
        const delta = (operation as Row).increment;
        if (typeof delta === "number") next[field] = (current[field] ?? 0) + delta;
        const decrement = (operation as Row).decrement;
        if (typeof decrement === "number") next[field] = (current[field] ?? 0) - decrement;
    }
    return next;
}

const artifactInput = {
    artifactId: "a1",
    workspaceId: "w1",
    userId: "u1",
    type: "SUMMARY" as const,
    title: "Test",
    sourceIds: [],
    chargeIdempotencyKey: "artifact-charge:a1",
    jobKey: "artifact-generate:a1",
};

describe("reliability failure windows", () => {
    it("artifact enqueue failure rolls back the charge and row", async () => {
        const state = createState();
        createUser(state);
        const tx = makeTx(state, { at: "durableJob" });

        await assert.rejects(
            tx.$transaction((inner) =>
                insertArtifactCreationInTransaction(inner as Prisma.TransactionClient, artifactInput),
            ),
            /enqueue failed/,
        );

        assert.equal(state.ledger.length, 0, "no debit ledger row should survive");
        assert.equal(state.artifacts.size, 0);
        assert.equal(state.users.get("u1")?.credits, 50);
        assert.equal(state.users.get("u1")?.totalArtifactsCreated, 0);
    });

    it("source enqueue failure rolls back the charge and row", async () => {
        const state = createState();
        createUser(state);
        const tx = makeTx(state, { at: "durableJob" });

        await assert.rejects(
            tx.$transaction((inner) =>
                insertSourceCreationInTransaction(inner as Prisma.TransactionClient, {
                    sourceId: "s1",
                    userId: "u1",
                    data: { workspaceId: "w1", title: "Doc", type: "TEXT", content: "hello" },
                    chargeIdempotencyKey: "source-charge:s1",
                    jobKey: "source.process:s1",
                }),
            ),
            /enqueue failed/,
        );

        assert.equal(state.ledger.length, 0);
        assert.equal(state.sources.size, 0);
        assert.equal(state.users.get("u1")?.credits, 50);
    });

    it("counter-update failure rolls back the whole artifact transaction", async () => {
        const state = createState();
        createUser(state);
        // Call 1 is the credit decrement; call 2 is the artifact counter.
        const tx = makeTx(state, { onUpdateManyCall: 2 });

        await assert.rejects(
            tx.$transaction((inner) =>
                insertArtifactCreationInTransaction(inner as Prisma.TransactionClient, artifactInput),
            ),
            /counter update failed/,
        );

        assert.equal(state.ledger.length, 0);
        assert.equal(state.artifacts.size, 0);
        assert.equal(state.jobs.size, 0);
        assert.equal(state.users.get("u1")?.credits, 50);
    });

    it("chat retrieval failure refunds once and cleans up the message", async () => {
        const refunds: Row[] = [];
        const deleted: string[] = [];

        await compensateChatFailure({
            messageId: "m1",
            userId: "u1",
            reason: "retrieval failed",
            refund: async (input) => {
                if (refunds.some((row) => row.refundIdempotencyKey === input.refundIdempotencyKey)) {
                    return true;
                }
                refunds.push({ ...input });
                return true;
            },
            deleteMessage: async (messageId) => {
                deleted.push(messageId);
            },
        });
        // A duplicate report (e.g. stream error plus outer catch) is harmless.
        await compensateChatFailure({
            messageId: "m1",
            userId: "u1",
            reason: "duplicate",
            refund: async (input) => {
                if (refunds.some((row) => row.refundIdempotencyKey === input.refundIdempotencyKey)) {
                    return true;
                }
                refunds.push({ ...input });
                return true;
            },
            deleteMessage: async (messageId) => {
                deleted.push(messageId);
            },
        });

        assert.equal(refunds.length, 1);
        assert.equal(refunds[0]?.chargeIdempotencyKey, "chat-charge:m1");
        assert.deepEqual(deleted, ["m1", "m1"]);
    });

    it("duplicate refund attempts produce a single refund row", async () => {
        const state = createState();
        createUser(state);
        state.ledger.push({
            id: "charge-a1",
            idempotencyKey: "artifact-charge:a1",
            userId: "u1",
            amount: -10,
            type: "ARTIFACT_GENERATE",
        });
        const tx = makeTx(state);

        const first = await refundChargeInTransaction(tx, {
            chargeIdempotencyKey: "artifact-charge:a1",
            refundIdempotencyKey: "artifact-refund:a1",
            expectedUserId: "u1",
            reason: "failed",
        });
        const second = await refundChargeInTransaction(tx, {
            chargeIdempotencyKey: "artifact-charge:a1",
            refundIdempotencyKey: "artifact-refund:a1",
            expectedUserId: "u1",
            reason: "duplicate",
        });

        assert.equal(first, true);
        assert.equal(second, true);
        assert.equal(state.ledger.filter((row) => row.type === "REFUND").length, 1);
    });

    it("duplicate source refund reports produce one refund row", async () => {
        const state = createState();
        createUser(state);
        state.ledger.push({
            id: "charge-s1",
            idempotencyKey: "source-charge:s1",
            userId: "u1",
            amount: -1,
            type: "SOURCE_UPLOAD",
            bucket: "DAILY",
            dailyAmount: 1,
            paidAmount: 0,
            metadata: { dailyCreditDay: new Date().toISOString().slice(0, 10) },
        });
        const tx = makeTx(state);

        const first = await refundChargeInTransaction(tx, {
            chargeIdempotencyKey: "source-charge:s1",
            refundIdempotencyKey: "source-refund:s1",
            expectedUserId: "u1",
            reason: "website extraction failed",
        });
        const second = await refundChargeInTransaction(tx, {
            chargeIdempotencyKey: "source-charge:s1",
            refundIdempotencyKey: "source-refund:s1",
            expectedUserId: "u1",
            reason: "duplicate report",
        });

        assert.equal(first, true);
        assert.equal(second, true);
        assert.equal(
            state.ledger.filter((row) => row.type === "REFUND").length,
            1,
        );
    });

    it("READY artifacts are never failed by the conditional transition", async () => {
        const state = createState();
        state.artifacts.set("ready-1", {
            id: "ready-1",
            status: "READY",
            leaseToken: null,
            leaseExpiresAt: null,
        });
        const tx = makeTx(state);

        const failed = await markArtifactFailedIfEligible(
            "ready-1",
            null,
            "should not happen",
            { tx },
        );

        assert.equal(failed, false);
        assert.equal(state.artifacts.get("ready-1")?.status, "READY");
    });

    it("stale sweep cannot fail an artifact with a live lease", async () => {
        const state = createState();
        state.artifacts.set("leased-1", {
            id: "leased-1",
            status: "PROCESSING",
            leaseToken: "live-token",
            leaseExpiresAt: new Date(Date.now() + 60_000),
        });
        const tx = makeTx(state);

        const failed = await markArtifactFailedIfEligible(
            "leased-1",
            null,
            "stale sweep",
            { tx },
        );

        assert.equal(failed, false);
        assert.equal(state.artifacts.get("leased-1")?.status, "PROCESSING");
    });

    it("completion with a stale/wrong lease token fails", async () => {
        const state = createState();
        state.artifacts.set("leased-2", {
            id: "leased-2",
            status: "PROCESSING",
            leaseToken: "live-token",
            leaseExpiresAt: new Date(Date.now() + 60_000),
        });
        const tx = makeTx(state);

        const completed = await completeArtifactProcessing(
            "leased-2",
            "wrong-token",
            { content: {} },
            tx,
        );

        assert.equal(completed, false);
        assert.equal(state.artifacts.get("leased-2")?.status, "PROCESSING");
    });

    it("duplicate worker claims yield exactly one winner", async () => {
        const state = createState();
        state.artifacts.set("claim-1", {
            id: "claim-1",
            status: "PENDING",
            leaseToken: null,
            leaseExpiresAt: null,
        });
        const tx = makeTx(state);

        const results = await Promise.all([
            claimArtifactForProcessing("claim-1", "token-a", 600_000, tx),
            claimArtifactForProcessing("claim-1", "token-b", 600_000, tx),
        ]);

        assert.equal(results.filter(Boolean).length, 1);
        const row = state.artifacts.get("claim-1")!;
        assert.equal(row.status, "PROCESSING");
        assert.ok(row.leaseToken === "token-a" || row.leaseToken === "token-b");
    });

    it("quota at the plan limit throws with LIMIT_REACHED details", async () => {
        const state = createState();
        createUser(state, { totalArtifactsCreated: 3 });
        const tx = makeTx(state);

        await assert.rejects(
            assertQuotaInTransaction(tx, "u1", "artifacts"),
            (error: unknown) => {
                assert.ok(error instanceof ForbiddenError);
                const details = error.details as Record<string, unknown>;
                assert.equal(details.code, "LIMIT_REACHED");
                assert.equal(details.limitType, "artifacts");
                assert.equal(details.current, 3);
                assert.equal(details.max, 3);
                assert.equal(details.plan, "FREE");
                return true;
            },
        );
    });

    it("quota below the plan limit succeeds", async () => {
        const state = createState();
        createUser(state, { totalArtifactsCreated: 2 });
        const tx = makeTx(state);

        await assertQuotaInTransaction(tx, "u1", "artifacts");
    });
});
