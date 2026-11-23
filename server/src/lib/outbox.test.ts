import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import {
    claimDurableJob,
    dispatchDurableJob,
    insertDurableJob,
    markDurableJobDelivered,
    releaseDurableJob,
    setOutboxStoreForTests,
    type DurableJobInput,
    type DurableJobStatus,
} from "./outbox.js";

type JobRow = {
    id: string;
    key: string;
    type: string;
    payload: unknown;
    status: DurableJobStatus;
    attempts: number;
    maxAttempts: number;
    availableAt: Date;
    updatedAt: Date;
    deliveredAt: Date | null;
    lastError: string | null;
};

type Charge = {
    id: string;
    userId: string;
    amount: number;
    type: string;
};

function comparable(value: unknown): number {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return value;
    return new Date(value as string).getTime();
}

function matches(row: Record<string, unknown>, where: Record<string, unknown> = {}): boolean {
    if (Array.isArray(where.OR)) {
        const alternatives = where.OR as Record<string, unknown>[];
        if (!alternatives.some((alternative) => matches(row, alternative))) return false;
    }

    for (const [field, condition] of Object.entries(where)) {
        if (field === "OR") continue;
        const actual = row[field];
        if (condition instanceof Date) {
            if (new Date(actual as string).getTime() !== condition.getTime()) return false;
            continue;
        }
        if (condition && typeof condition === "object") {
            const range = condition as Record<string, unknown>;
            if (range.in !== undefined && !(range.in as unknown[]).includes(actual)) return false;
            if (range.not !== undefined && actual === range.not) return false;
            if (range.lt !== undefined && !(comparable(actual) < comparable(range.lt))) return false;
            if (range.lte !== undefined && !(comparable(actual) <= comparable(range.lte))) return false;
            if (range.gte !== undefined && !(comparable(actual) >= comparable(range.gte))) return false;
            continue;
        }
        if (actual !== condition) return false;
    }
    return true;
}

function fakeStore(options: { charge?: Charge | null } = {}) {
    const jobs = new Map<string, JobRow>();
    const ledger: Array<Record<string, unknown>> = [];
    const users = new Map<string, { credits: number }>([["u1", { credits: 20 }]]);
    const artifacts = new Map<string, Record<string, unknown>>();
    let sequence = 0;

    const durableJob = {
        createMany: async ({ data, skipDuplicates }: {
            data: Array<Record<string, unknown>>;
            skipDuplicates?: boolean;
        }) => {
            let count = 0;
            for (const dataRow of data) {
                const key = String(dataRow.key);
                if (jobs.has(key)) {
                    if (skipDuplicates) continue;
                    throw Object.assign(new Error("duplicate key"), { code: "P2002" });
                }
                jobs.set(key, {
                    id: `job-${++sequence}`,
                    key,
                    type: String(dataRow.type),
                    payload: dataRow.payload,
                    status: (dataRow.status as DurableJobStatus) ?? "PENDING",
                    attempts: Number(dataRow.attempts ?? 0),
                    maxAttempts: Number(dataRow.maxAttempts ?? 5),
                    availableAt: (dataRow.availableAt as Date) ?? new Date(),
                    updatedAt: new Date(),
                    deliveredAt: null,
                    lastError: null,
                });
                count += 1;
            }
            return { count };
        },
        findUnique: async ({ where }: { where: { key: string } }) =>
            jobs.get(where.key) ?? null,
        findMany: async ({ where, take }: {
            where?: Record<string, unknown>;
            take?: number;
        }) => {
            const rows = [...jobs.values()].filter((job) =>
                matches(job as unknown as Record<string, unknown>, where),
            );
            return take ? rows.slice(0, take) : rows;
        },
        updateMany: async ({ where, data }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
        }) => {
            let count = 0;
            for (const job of jobs.values()) {
                if (!matches(job as unknown as Record<string, unknown>, where)) continue;
                Object.assign(job, data, { updatedAt: new Date() });
                count += 1;
            }
            return { count };
        },
    };

    const creditTransaction = {
        findUnique: async ({ where }: { where: { idempotencyKey?: string } }) => {
            if (!where.idempotencyKey) return null;
            if (where.idempotencyKey.includes("-refund:")) {
                return ledger.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null;
            }
            return options.charge ?? null;
        },
        create: async ({ data }: { data: Record<string, unknown> }) => {
            ledger.push(data);
            return data;
        },
    };

    const user = {
        update: async () => {
            const balance = users.get("u1");
            if (balance) balance.credits += 10;
        },
        findUniqueOrThrow: async () => ({ credits: users.get("u1")?.credits ?? 0 }),
    };

    const learningArtifact = {
        findUnique: async ({ where }: { where: { id: string } }) =>
            artifacts.get(where.id) ?? null,
        updateMany: async ({ where, data }: {
            where: Record<string, unknown>;
            data: Record<string, unknown>;
        }) => {
            let count = 0;
            for (const artifact of artifacts.values()) {
                if (!matches(artifact, where)) continue;
                Object.assign(artifact, data);
                count += 1;
            }
            return { count };
        },
    };

    const db = {
        durableJob,
        creditTransaction,
        user,
        learningArtifact,
        source: { findUnique: async () => null },
        workspace: {
            findUnique: async () => ({ userId: "u1" }),
        },
        $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(db),
    };

    return {
        db: db as unknown as Prisma.TransactionClient,
        jobs,
        ledger,
        artifacts,
        users,
    };
}

const baseInput: DurableJobInput = {
    key: "artifact-generate:a1",
    type: "artifact.generate",
    payload: { artifactId: "a1", workspaceId: "w1" },
};

describe("transactional outbox", () => {
    it("inserts idempotently on a unique key", async () => {
        const { db, jobs } = fakeStore();
        const tx = db as Prisma.TransactionClient;

        await insertDurableJob(tx, baseInput);
        await insertDurableJob(tx, baseInput);

        assert.equal(jobs.size, 1);
        assert.equal(jobs.get(baseInput.key)?.status, "PENDING");
    });

    it("claims a due job exactly once", async () => {
        const { db } = fakeStore();
        setOutboxStoreForTests(db);
        await insertDurableJob(db as Prisma.TransactionClient, baseInput);

        const results = await Promise.all([
            claimDurableJob(baseInput.key),
            claimDurableJob(baseInput.key),
        ]);

        assert.equal(results.filter(Boolean).length, 1);
        assert.equal([...await (db as any).durableJob.findMany({})][0]?.status, "PROCESSING");
    });

    it("does not claim a job before availableAt", async () => {
        const { db } = fakeStore();
        setOutboxStoreForTests(db);
        await insertDurableJob(db as Prisma.TransactionClient, {
            ...baseInput,
            key: "later",
            availableAt: new Date(Date.now() + 60_000),
        });

        assert.equal(await claimDurableJob("later"), false);
        assert.equal(await dispatchDurableJob("later"), false);
    });

    it("moves PROCESSING to DELIVERED exactly once", async () => {
        const { db } = fakeStore();
        setOutboxStoreForTests(db);
        await insertDurableJob(db as Prisma.TransactionClient, baseInput);
        assert.equal(await claimDurableJob(baseInput.key), true);

        await markDurableJobDelivered(baseInput.key);
        await markDurableJobDelivered(baseInput.key);

        const job = await (db as any).durableJob.findUnique({ where: { key: baseInput.key } });
        assert.equal(job.status, "DELIVERED");
        assert.ok(job.deliveredAt instanceof Date);
        assert.equal(await dispatchDurableJob(baseInput.key), true);
    });

    it("releases with attempts and exponential backoff", async () => {
        const { db } = fakeStore();
        setOutboxStoreForTests(db);
        await insertDurableJob(db as Prisma.TransactionClient, baseInput);
        await claimDurableJob(baseInput.key);
        const before = Date.now();

        await releaseDurableJob(baseInput.key, new Error("temporary"));

        const job = await (db as any).durableJob.findUnique({ where: { key: baseInput.key } });
        assert.equal(job.status, "PENDING");
        assert.equal(job.attempts, 1);
        assert.ok(new Date(job.availableAt).getTime() >= before + 500);
        assert.match(job.lastError, /temporary/);
    });

    it("marks a maxed-out job DEAD and compensates with one refund", async () => {
        const { db, jobs, ledger, artifacts } = fakeStore({
            charge: { id: "charge-a1", userId: "u1", amount: -10, type: "ARTIFACT_GENERATE" },
        });
        artifacts.set("a1", {
            id: "a1",
            workspaceId: "w1",
            status: "PROCESSING",
            refundedAt: null,
            leaseToken: null,
            leaseExpiresAt: null,
            metadata: { previous: true },
        });
        setOutboxStoreForTests(db);
        await insertDurableJob(db as Prisma.TransactionClient, baseInput);
        await claimDurableJob(baseInput.key);
        const job = jobs.get(baseInput.key)!;
        job.attempts = 4;

        await releaseDurableJob(baseInput.key, new Error("permanent"));
        await releaseDurableJob(baseInput.key, new Error("duplicate"));

        assert.equal(jobs.get(baseInput.key)?.status, "DEAD");
        assert.equal(artifacts.get("a1")?.status, "FAILED");
        const refunds = ledger.filter((row) => row.type === "REFUND");
        assert.equal(refunds.length, 1);
        assert.equal(refunds[0]?.idempotencyKey, "artifact-refund:a1");
        assert.equal(refunds[0]?.amount, 10);
    });

    it("does not refund on DEAD when no debit exists", async () => {
        const { db, jobs, ledger, artifacts } = fakeStore({ charge: null });
        artifacts.set("a2", {
            id: "a2",
            workspaceId: "w1",
            status: "PENDING",
            refundedAt: null,
            leaseToken: null,
            leaseExpiresAt: null,
        });
        setOutboxStoreForTests(db);
        await insertDurableJob(db as Prisma.TransactionClient, {
            ...baseInput,
            key: "artifact-generate:a2",
            payload: { artifactId: "a2", workspaceId: "w1" },
        });
        await claimDurableJob("artifact-generate:a2");
        jobs.get("artifact-generate:a2")!.attempts = 4;

        await releaseDurableJob("artifact-generate:a2", new Error("permanent"));

        assert.equal(jobs.get("artifact-generate:a2")?.status, "DEAD");
        assert.equal(artifacts.get("a2")?.status, "FAILED");
        assert.equal(ledger.filter((row) => row.type === "REFUND").length, 0);
    });

    it("never fails or refunds a READY artifact on DEAD", async () => {
        const { db, jobs, ledger, artifacts } = fakeStore({
            charge: { id: "charge-a3", userId: "u1", amount: -10, type: "ARTIFACT_GENERATE" },
        });
        artifacts.set("a3", {
            id: "a3",
            workspaceId: "w1",
            status: "READY",
            refundedAt: null,
            leaseToken: null,
            leaseExpiresAt: null,
        });
        setOutboxStoreForTests(db);
        await insertDurableJob(db as Prisma.TransactionClient, {
            ...baseInput,
            key: "artifact-generate:a3",
            payload: { artifactId: "a3" },
        });
        await claimDurableJob("artifact-generate:a3");
        jobs.get("artifact-generate:a3")!.attempts = 4;

        await releaseDurableJob("artifact-generate:a3", new Error("late"));

        assert.equal(jobs.get("artifact-generate:a3")?.status, "DEAD");
        assert.equal(artifacts.get("a3")?.status, "READY");
        assert.equal(ledger.filter((row) => row.type === "REFUND").length, 0);
    });
});
