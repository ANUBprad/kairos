import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import type { CreditMutationInput } from "./credit.services.js";
import {
    CREDIT_WINDOW_MS,
    CREDIT_WINDOWS_PER_DAY,
    DAILY_ALLOWANCE_CREDITS,
    WINDOW_ALLOWANCE_CREDITS,
    debitCreditsInTransaction,
    ensureDailyCreditsInTransaction,
    getNextUtcCreditReset,
    getUtcCreditDay,
    getUtcCreditWindowStart,
    normalizeCreditWindow,
    refundChargeInTransaction,
} from "./credit.services.js";
import { InsufficientCreditsError } from "../types/app-error.js";

type UserState = {
    id?: string;
    credits: number;
    dailyCredits: number;
    dailyCreditDay: string;
    email?: string;
    totalArtifactsCreated?: number;
};

type LedgerRow = Record<string, any>;

async function withDeveloperEmails<T>(
    value: string | undefined,
    fn: () => T | Promise<T>,
): Promise<T> {
    const previous = process.env.DEVELOPER_EMAILS;
    if (value === undefined) delete process.env.DEVELOPER_EMAILS;
    else process.env.DEVELOPER_EMAILS = value;
    try {
        return await fn();
    } finally {
        if (previous === undefined) delete process.env.DEVELOPER_EMAILS;
        else process.env.DEVELOPER_EMAILS = previous;
    }
}

function fakeTx(initial: UserState, seedLedger: LedgerRow[] = []) {
    const state = {
        id: initial.id ?? "user-1",
        credits: initial.credits,
        dailyCredits: initial.dailyCredits,
        dailyCreditDay: initial.dailyCreditDay,
        email: initial.email ?? "user@example.test",
        totalArtifactsCreated: initial.totalArtifactsCreated ?? 0,
    };
    const ledger: LedgerRow[] = [...seedLedger];

    function currentUser() {
        return {
            credits: state.credits,
            dailyCredits: state.dailyCredits,
            dailyCreditDay: state.dailyCreditDay,
            totalArtifactsCreated: state.totalArtifactsCreated,
        };
    }

    function applyNumeric(data: Record<string, unknown>) {
        for (const [key, value] of Object.entries(data)) {
            if (key === "dailyCreditDay") {
                state.dailyCreditDay = String(value);
                continue;
            }
            if (key !== "credits" && key !== "dailyCredits" && key !== "totalArtifactsCreated") {
                continue;
            }
            const current = state[key];
            if (typeof value === "number") state[key] = value;
            else if (typeof value === "object" && value !== null) {
                const change = value as { increment?: number; decrement?: number };
                state[key] = current + (change.increment ?? 0) - (change.decrement ?? 0);
            }
        }
    }

    const client = {
        creditTransaction: {
            findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
                ledger.find((row) => row.idempotencyKey === where.idempotencyKey) ?? null,
            create: async ({ data }: { data: LedgerRow }) => {
                if (ledger.some((row) => row.idempotencyKey === data.idempotencyKey)) {
                    throw Object.assign(new Error("duplicate ledger key"), { code: "P2002" });
                }
                ledger.push(data);
                return data;
            },
        },
        user: {
            findUnique: async ({
                where,
                select,
            }: {
                where: { id: string };
                select?: Record<string, unknown>;
            }) => {
                if (where.id !== state.id) return null;
                if (select && Object.keys(select).length === 1 && "email" in select) {
                    return { email: state.email };
                }
                return currentUser();
            },
            findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
                if (where.id !== state.id) throw new Error("user missing");
                return currentUser();
            },
            update: async ({
                where,
                data,
            }: {
                where: { id: string };
                data: Record<string, unknown>;
            }) => {
                if (where.id !== state.id) throw new Error("user missing");
                applyNumeric(data);
                return currentUser();
            },
            updateMany: async ({
                where,
                data,
            }: {
                where: {
                    id: string;
                    dailyCreditDay?: { lt?: string };
                    dailyCredits?: { gte?: number };
                    credits?: { gte?: number };
                };
                data: Record<string, unknown>;
            }) => {
                if (where.id !== state.id) return { count: 0 };
                const lt = where.dailyCreditDay?.lt;
                if (lt !== undefined && !(state.dailyCreditDay < lt)) return { count: 0 };
                const dailyMin = where.dailyCredits?.gte;
                if (dailyMin !== undefined && state.dailyCredits < dailyMin) return { count: 0 };
                const paidMin = where.credits?.gte;
                if (paidMin !== undefined && state.credits < paidMin) return { count: 0 };
                applyNumeric(data);
                return { count: 1 };
            },
        },
    };

    return { tx: client as unknown as Prisma.TransactionClient, state, ledger };
}

const ORIGINAL_DEVELOPER_EMAILS = process.env.DEVELOPER_EMAILS;
after(() => {
    if (ORIGINAL_DEVELOPER_EMAILS === undefined) delete process.env.DEVELOPER_EMAILS;
    else process.env.DEVELOPER_EMAILS = ORIGINAL_DEVELOPER_EMAILS;
});

describe("six-hour UTC credit windows", () => {
    const boundaries = [
        "2026-11-28T00:00:00.000Z",
        "2026-11-28T06:00:00.000Z",
        "2026-11-28T12:00:00.000Z",
        "2026-11-28T18:00:00.000Z",
    ];

    it("derives window starts and next resets at 00/06/12/18 UTC from an explicit server clock", () => {
        assert.equal(CREDIT_WINDOW_MS, 6 * 60 * 60 * 1000);
        assert.equal(CREDIT_WINDOWS_PER_DAY, 4);
        assert.equal(WINDOW_ALLOWANCE_CREDITS, 100);
        assert.equal(DAILY_ALLOWANCE_CREDITS, 100);

        boundaries.forEach((boundary, index) => {
            const now = new Date(boundary);
            assert.equal(getUtcCreditWindowStart(now), boundary);
            const expectedNext =
                index === boundaries.length - 1
                    ? "2026-11-29T00:00:00.000Z"
                    : boundaries[index + 1]!;
            assert.equal(getNextUtcCreditReset(now), expectedNext);
            assert.equal(normalizeCreditWindow(boundary), boundary);
        });

        const midWindow = new Date("2026-11-28T08:45:12.000Z");
        assert.equal(getUtcCreditWindowStart(midWindow), "2026-11-28T06:00:00.000Z");
        assert.equal(getNextUtcCreditReset(midWindow), "2026-11-28T12:00:00.000Z");
        // Legacy compatibility helper remains calendar-day based only.
        assert.equal(getUtcCreditDay(midWindow), "2026-11-28");
        assert.equal(normalizeCreditWindow("2026-11-28"), "2026-11-28T00:00:00.000Z");
        assert.equal(normalizeCreditWindow("not-a-date"), null);
    });

    for (const boundary of boundaries) {
        it(`claims a fresh allowance and preserves paid credits at ${boundary}`, async () => {
            const now = new Date(boundary);
            const { tx, state, ledger } = fakeTx({
                credits: 250,
                dailyCredits: 17,
                dailyCreditDay: "1970-01-01",
            });

            const snapshot = await ensureDailyCreditsInTransaction(tx, "user-1", now);

            assert.equal(snapshot.dailyCredits, 100);
            assert.equal(snapshot.paidCredits, 250);
            assert.equal(snapshot.credits, 350);
            assert.equal(snapshot.dailyCreditDay, boundary);
            assert.equal(snapshot.creditWindowStart, boundary);
            assert.equal(snapshot.nextCreditResetAt, getNextUtcCreditReset(now));
            assert.equal(snapshot.nextDailyResetAt, snapshot.nextCreditResetAt);
            assert.equal(snapshot.windowAllowance, 100);
            assert.equal(snapshot.windowsPerDay, 4);
            assert.equal(state.credits, 250);
            assert.equal(state.dailyCreditDay, boundary);
            assert.equal(ledger.length, 1);
            assert.equal(ledger[0]!.type, "DAILY_ALLOWANCE");
            assert.equal(ledger[0]!.amount, 83);
            assert.equal(ledger[0]!.paidAmount, 0);
            assert.equal(ledger[0]!.idempotencyKey, `daily-reset:user-1:${boundary}`);
            const metadata = ledger[0]!.metadata as Record<string, unknown>;
            assert.equal(metadata.creditWindowStart, boundary);
            assert.equal(metadata.nextCreditResetAt, snapshot.nextCreditResetAt);
            assert.equal(metadata.windowAllowance, 100);
            assert.equal(metadata.dailyCreditDay, boundary);
        });
    }

    it("does not grant again inside the same six-hour window", async () => {
        const now = new Date("2026-11-28T08:00:00.000Z");
        const { tx, state, ledger } = fakeTx({
            credits: 250,
            dailyCredits: 37,
            dailyCreditDay: "2026-11-28T06:00:00.000Z",
        });

        const snapshot = await ensureDailyCreditsInTransaction(tx, "user-1", now);

        assert.equal(snapshot.dailyCredits, 37);
        assert.equal(state.dailyCredits, 37);
        assert.equal(ledger.length, 0);
    });

    it("treats a legacy day as midnight UTC and rolls it forward exactly once", async () => {
        // A legacy day already names the 00:00 window, so it is not renewed
        // until a later window starts.
        const sameWindow = fakeTx({
            credits: 90,
            dailyCredits: 64,
            dailyCreditDay: "2026-11-28",
        });
        await ensureDailyCreditsInTransaction(
            sameWindow.tx,
            "user-1",
            new Date("2026-11-28T00:30:00.000Z"),
        );
        assert.equal(sameWindow.state.dailyCredits, 64);
        assert.equal(sameWindow.ledger.length, 0);

        const now = new Date("2026-11-28T06:30:00.000Z");
        const legacy = fakeTx({
            credits: 90,
            dailyCredits: 64,
            dailyCreditDay: "2026-11-28",
        });
        const snapshot = await ensureDailyCreditsInTransaction(legacy.tx, "user-1", now);
        assert.equal(snapshot.dailyCredits, 100);
        assert.equal(snapshot.credits, 190);
        assert.equal(legacy.state.dailyCreditDay, "2026-11-28T06:00:00.000Z");
        assert.equal(legacy.ledger.length, 1);
        assert.equal(legacy.ledger[0]!.amount, 36);

        const alreadyCurrent = fakeTx({
            credits: 90,
            dailyCredits: 64,
            dailyCreditDay: "2026-11-28T06:00:00.000Z",
        });
        await ensureDailyCreditsInTransaction(alreadyCurrent.tx, "user-1", now);
        assert.equal(alreadyCurrent.ledger.length, 0);
        assert.equal(alreadyCurrent.state.dailyCredits, 64);
    });

    it("expires unused credits after six hours and grants a new window", async () => {
        const { tx, state, ledger } = fakeTx({
            credits: 40,
            dailyCredits: 91,
            dailyCreditDay: "2026-11-28T12:00:00.000Z",
        });

        const snapshot = await ensureDailyCreditsInTransaction(
            tx,
            "user-1",
            new Date("2026-11-28T18:00:01.000Z"),
        );

        assert.equal(snapshot.dailyCredits, 100);
        assert.equal(snapshot.paidCredits, 40);
        assert.equal(snapshot.creditWindowStart, "2026-11-28T18:00:00.000Z");
        assert.equal(ledger[0]!.amount, 9);
        assert.equal(state.credits, 40);
    });

    it("concurrent boundary requests produce exactly one grant", async () => {
        const shared = fakeTx({
            credits: 40,
            dailyCredits: 3,
            dailyCreditDay: "2026-11-28T05:59:59.000Z",
        });
        const now = new Date("2026-11-28T06:00:00.000Z");

        const snapshots = await Promise.all([
            ensureDailyCreditsInTransaction(shared.tx, "user-1", now),
            ensureDailyCreditsInTransaction(shared.tx, "user-1", now),
            ensureDailyCreditsInTransaction(shared.tx, "user-1", now),
        ]);

        for (const snapshot of snapshots) {
            assert.equal(snapshot.dailyCredits, 100);
            assert.equal(snapshot.paidCredits, 40);
        }
        assert.equal(shared.state.dailyCredits, 100);
        assert.equal(shared.state.credits, 40);
        assert.equal(shared.ledger.length, 1);
    });

    it("spends daily credits before paid credits and records the split", async () => {
        const { tx, state, ledger } = fakeTx({
            credits: 40,
            dailyCredits: 2,
            dailyCreditDay: "2099-01-01",
        });

        const result = await debitCreditsInTransaction(
            tx,
            {
                userId: "user-1",
                amount: 5,
                type: "ARTIFACT_GENERATE",
                description: "test mixed charge",
                idempotencyKey: "artifact-charge:mixed-unit",
            },
            new Date("2026-11-28T13:00:00.000Z"),
        );

        assert.equal(state.dailyCredits, 0);
        assert.equal(state.credits, 37);
        assert.equal(result.snapshot.credits, 37);
        assert.equal(ledger[0]!.bucket, "MIXED");
        assert.equal(ledger[0]!.dailyAmount, 2);
        assert.equal(ledger[0]!.paidAmount, 3);
        assert.equal(
            (ledger[0]!.metadata as Record<string, unknown>).creditWindowStart,
            "2026-11-28T12:00:00.000Z",
        );
    });

    it("does not charge twice for an idempotent retry", async () => {
        const { tx, state, ledger } = fakeTx({
            credits: 10,
            dailyCredits: 100,
            dailyCreditDay: "2099-01-01",
        });
        const input = {
            userId: "user-1",
            amount: 1,
            type: "SOURCE_UPLOAD" as const,
            description: "source charge",
            idempotencyKey: "source-charge:retry-unit",
        };
        const now = new Date("2026-11-28T13:00:00.000Z");

        await debitCreditsInTransaction(tx, input, now);
        await debitCreditsInTransaction(tx, input, now);

        assert.equal(ledger.length, 1);
        assert.equal(state.dailyCredits, 99);
        assert.equal(state.credits, 10);
    });

    it("includes window fields in insufficient-credit error details", async () => {
        const { tx } = fakeTx({
            credits: 1,
            dailyCredits: 0,
            dailyCreditDay: "2099-01-01",
        });
        const now = new Date("2026-11-28T18:30:00.000Z");

        await assert.rejects(
            debitCreditsInTransaction(
                tx,
                {
                    userId: "user-1",
                    amount: 5,
                    type: "ARTIFACT_GENERATE",
                    description: "too expensive",
                },
                now,
            ),
            (error: unknown) => {
                assert.ok(error instanceof InsufficientCreditsError);
                const details = error.details as Record<string, unknown>;
                assert.equal(details.dailyCredits, 0);
                assert.equal(details.paidCredits, 1);
                assert.equal(details.creditWindowStart, "2026-11-28T18:00:00.000Z");
                assert.equal(details.nextCreditResetAt, "2026-11-29T00:00:00.000Z");
                assert.equal(details.windowAllowance, 100);
                assert.equal(details.windowsPerDay, 4);
                assert.ok(typeof details.nextDailyResetAt === "string");
                return true;
            },
        );
    });

    it("moves an expired daily refund into paid credits exactly once", async () => {
        const now = new Date("2026-11-28T12:10:00.000Z");
        const previousWindow = "2026-11-28T06:00:00.000Z";
        const { tx, state, ledger } = fakeTx(
            {
                credits: 20,
                dailyCredits: 0,
                dailyCreditDay: "2026-11-28T12:00:00.000Z",
            },
            [
                {
                    id: "charge-1",
                    idempotencyKey: "artifact-charge:boundary",
                    userId: "user-1",
                    amount: -5,
                    type: "ARTIFACT_GENERATE",
                    bucket: "MIXED",
                    dailyAmount: 3,
                    paidAmount: 2,
                    metadata: {
                        creditWindowStart: previousWindow,
                        dailyCreditDay: previousWindow,
                    },
                },
            ],
        );
        const input = {
            chargeIdempotencyKey: "artifact-charge:boundary",
            refundIdempotencyKey: "artifact-refund:boundary",
            expectedUserId: "user-1",
            reason: "generation failed",
        };

        assert.equal(await refundChargeInTransaction(tx, input, now), true);
        assert.equal(state.credits, 25);
        assert.equal(state.dailyCredits, 0);
        const refund = ledger.find((row) => row.idempotencyKey === input.refundIdempotencyKey)!;
        assert.equal(refund.dailyAmount, 0);
        assert.equal(refund.paidAmount, 5);
        assert.equal((refund.metadata as Record<string, unknown>).expiredDailyRefund, 3);

        assert.equal(await refundChargeInTransaction(tx, input, now), true);
        assert.equal(state.credits, 25);
        assert.equal(
            ledger.filter((row) => row.idempotencyKey === input.refundIdempotencyKey).length,
            1,
        );
    });

    it("lets allowlisted developers bypass charges without ledger entries or client flags", async () => {
        await withDeveloperEmails("Developer@Example.test", async () => {
            const { tx, state, ledger } = fakeTx({
                credits: 1,
                dailyCredits: 0,
                dailyCreditDay: "1970-01-01",
                email: "DEVELOPER@example.test",
            });
            const input = {
                userId: "user-1",
                amount: 500,
                type: "ARTIFACT_GENERATE" as const,
                description: "developer work",
                idempotencyKey: "artifact-charge:developer-unit",
                // A client-provided flag must never participate in the decision.
                isDeveloper: false,
            } as CreditMutationInput;
            const now = new Date("2026-11-28T18:00:00.000Z");

            const first = await debitCreditsInTransaction(tx, input, now);
            const retry = await debitCreditsInTransaction(tx, input, now);

            assert.equal(first.success, true);
            assert.equal(retry.success, true);
            assert.equal(first.balance, 1);
            assert.equal(first.snapshot.credits, 1);
            assert.equal(state.credits, 1);
            assert.equal(state.dailyCredits, 0);
            assert.equal(ledger.length, 0);
        });
    });

    it("still charges non-allowlisted users even when a client claims developer status", async () => {
        await withDeveloperEmails("developer@example.test", async () => {
            const { tx, state, ledger } = fakeTx({
                credits: 10,
                dailyCredits: 0,
                dailyCreditDay: "2099-01-01",
                email: "regular@example.test",
            });
            const input = {
                userId: "user-1",
                amount: 5,
                type: "ARTIFACT_GENERATE" as const,
                description: "regular user work",
                idempotencyKey: "artifact-charge:regular-unit",
                isDeveloper: true,
            } as CreditMutationInput;

            const result = await debitCreditsInTransaction(
                tx,
                input,
                new Date("2026-11-28T18:00:00.000Z"),
            );

            assert.equal(result.success, true);
            assert.equal(state.credits, 5);
            assert.equal(ledger.length, 1);
            assert.equal(ledger[0]!.amount, -5);
        });
    });

    it("never creates a refund for a developer charge that does not exist", async () => {
        await withDeveloperEmails("developer@example.test", async () => {
            const { tx, ledger } = fakeTx(
                {
                    credits: 10,
                    dailyCredits: 100,
                    dailyCreditDay: "2099-01-01",
                    email: "developer@example.test",
                },
                [
                    {
                        id: "legacy-charge",
                        idempotencyKey: "artifact-charge:legacy",
                        userId: "user-1",
                        amount: -5,
                        type: "ARTIFACT_GENERATE",
                        bucket: "PAID",
                        paidAmount: 5,
                        metadata: {},
                    },
                ],
            );

            const refunded = await refundChargeInTransaction(
                tx,
                {
                    chargeIdempotencyKey: "artifact-charge:legacy",
                    refundIdempotencyKey: "artifact-refund:legacy",
                    expectedUserId: "user-1",
                    reason: "developer no-charge",
                },
                new Date("2026-11-28T18:00:00.000Z"),
            );

            assert.equal(refunded, false);
            assert.equal(ledger.filter((row) => row.type === "REFUND").length, 0);
        });
    });
});
