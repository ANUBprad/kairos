import assert from "node:assert/strict";
import { describe, it } from "node:test";
import prisma from "../lib/db.js";
import { grantSignupCreditsForUser } from "../lib/signup-credits.js";

type FakeState = {
    credits: number;
    userMissing?: boolean;
    createManyError?: unknown;
    created: Array<Record<string, unknown>>;
    increments: number[];
    committed: boolean;
};

/**
 * Replaces the client's transaction method for the duration of one test.
 * Each test file runs in its own node:test process, so this cannot affect
 * any other suite. The fake models `createMany({ skipDuplicates: true })`
 * and the conditional balance increment well enough to assert atomicity.
 */
async function withFakeTransaction<T>(
    state: FakeState,
    run: () => Promise<T>,
): Promise<T> {
    const client = prisma as unknown as Record<string, unknown>;
    const original = client.$transaction;

    const tx = {
        creditTransaction: {
            createMany: async ({
                data,
                skipDuplicates,
            }: {
                data: Array<Record<string, unknown>>;
                skipDuplicates: boolean;
            }) => {
                if (state.createManyError) throw state.createManyError;
                assert.equal(skipDuplicates, true);
                const row = data[0];
                if (state.created.some((item) => item.idempotencyKey === row.idempotencyKey)) {
                    return { count: 0 };
                }
                state.created.push(row);
                return { count: 1 };
            },
        },
        user: {
            findUnique: async () =>
                state.userMissing ? null : { credits: state.credits },
            update: async ({
                data,
            }: {
                data: { credits: { increment: number } };
            }) => {
                state.increments.push(data.credits.increment);
                state.credits += data.credits.increment;
                return { credits: state.credits };
            },
        },
    };

    client.$transaction = async (
        callback: (transaction: typeof tx) => Promise<unknown>,
    ) => {
        const pendingRows = [...state.created];
        const pendingIncrements = [...state.increments];
        const pendingCredits = state.credits;
        try {
            const result = await callback(tx);
            state.committed = true;
            return result;
        } catch (error) {
            // Model a rolled-back transaction: discard writes made in the body.
            state.created.length = pendingRows.length;
            state.increments.length = pendingIncrements.length;
            state.credits = pendingCredits;
            state.committed = false;
            throw error;
        }
    };

    try {
        return await run();
    } finally {
        client.$transaction = original;
    }
}

describe("signup credit ledger", () => {
    it("grants 50 credits with one matching SIGNUP_BONUS entry for a new user", async () => {
        const state: FakeState = {
            credits: 0,
            created: [],
            increments: [],
            committed: false,
        };
        await withFakeTransaction(state, () =>
            grantSignupCreditsForUser({ id: "user-1" }),
        );

        assert.equal(state.committed, true);
        assert.equal(state.created.length, 1);
        assert.deepEqual(state.created[0], {
            userId: "user-1",
            amount: 50,
            balanceAfter: 50,
            type: "SIGNUP_BONUS",
            description: "Welcome credits",
            metadata: { idempotencyKey: "signup-credit:user-1" },
            idempotencyKey: "signup-credit:user-1",
        });
        assert.deepEqual(state.increments, [50]);
        assert.equal(state.credits, 50);
    });

    it("does not grant a second bonus when the hook is replayed", async () => {
        const state: FakeState = {
            credits: 0,
            created: [],
            increments: [],
            committed: false,
        };
        await withFakeTransaction(state, async () => {
            await grantSignupCreditsForUser({ id: "user-2" });
            await grantSignupCreditsForUser({ id: "user-2" });
        });

        assert.equal(state.created.length, 1);
        assert.deepEqual(state.increments, [50]);
        assert.equal(state.credits, 50);
    });

    it("treats a concurrent unique-key winner as success", async () => {
        const state: FakeState = {
            credits: 50, // the concurrent winner already credited the balance
            created: [{ idempotencyKey: "signup-credit:user-3" }],
            increments: [],
            committed: false,
        };
        await withFakeTransaction(state, () =>
            grantSignupCreditsForUser({ id: "user-3" }),
        );

        assert.equal(state.committed, true);
        assert.deepEqual(state.increments, []);
        assert.equal(state.credits, 50);
    });

    it("propagates ledger failures and leaves no partial write", async () => {
        const state: FakeState = {
            credits: 0,
            createManyError: new Error("database unavailable"),
            created: [],
            increments: [],
            committed: false,
        };
        await assert.rejects(
            withFakeTransaction(state, () =>
                grantSignupCreditsForUser({ id: "user-4" }),
            ),
            /database unavailable/,
        );
        assert.equal(state.committed, false);
        assert.equal(state.created.length, 0);
        assert.deepEqual(state.increments, []);
        assert.equal(state.credits, 0);
    });

    it("does not write a ledger entry for a removed user", async () => {
        const state: FakeState = {
            credits: 0,
            userMissing: true,
            created: [],
            increments: [],
            committed: false,
        };
        await withFakeTransaction(state, () =>
            grantSignupCreditsForUser({ id: "user-5" }),
        );

        assert.equal(state.created.length, 0);
        assert.deepEqual(state.increments, []);
    });
});
