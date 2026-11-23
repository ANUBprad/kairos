import assert from "node:assert/strict";
import { describe, it } from "node:test";
import prisma from "../lib/db.js";
import { grantSignupCreditsForUser } from "../lib/signup-credits.js";

type FakeState = {
    credits: number;
    userMissing?: boolean;
    existingKey?: string;
    createError?: unknown;
    created: Array<Record<string, unknown>>;
    committed: boolean;
};

/**
 * Replaces the client's transaction method for the duration of one test.
 * Each test file runs in its own node:test process, so this cannot affect
 * any other suite.
 */
async function withFakeTransaction<T>(
    state: FakeState,
    run: () => Promise<T>,
): Promise<T> {
    const client = prisma as unknown as Record<string, unknown>;
    const original = client.$transaction;

    const tx = {
        creditTransaction: {
            findUnique: async ({ where }: { where: { idempotencyKey: string } }) =>
                where.idempotencyKey === state.existingKey ? { id: "existing" } : null,
            create: async ({ data }: { data: Record<string, unknown> }) => {
                if (state.createError) throw state.createError;
                state.created.push(data);
                return { id: `ledger-${state.created.length}` };
            },
        },
        user: {
            findUnique: async () =>
                state.userMissing ? null : { credits: state.credits },
        },
    };

    client.$transaction = async (
        callback: (transaction: typeof tx) => Promise<unknown>,
    ) => {
        const pending = [...state.created];
        try {
            const result = await callback(tx);
            state.committed = true;
            return result;
        } catch (error) {
            // Model a rolled-back transaction: discard writes made in the body.
            state.created.length = pending.length;
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
    it("records one SIGNUP_BONUS entry matching the default balance", async () => {
        const state: FakeState = { credits: 50, created: [], committed: false };
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
    });

    it("does not grant a second bonus when the hook is replayed", async () => {
        const state: FakeState = {
            credits: 50,
            existingKey: "signup-credit:user-2",
            created: [],
            committed: false,
        };
        await withFakeTransaction(state, async () => {
            await grantSignupCreditsForUser({ id: "user-2" });
            await grantSignupCreditsForUser({ id: "user-2" });
        });

        assert.equal(state.created.length, 0);
    });

    it("treats a concurrent unique-key winner as success", async () => {
        const state: FakeState = {
            credits: 50,
            createError: Object.assign(new Error("duplicate"), { code: "P2002" }),
            created: [],
            committed: false,
        };
        await withFakeTransaction(state, () =>
            grantSignupCreditsForUser({ id: "user-3" }),
        );

        assert.equal(state.committed, true);
        assert.equal(state.created.length, 0);
    });

    it("propagates ledger failures and leaves no partial write", async () => {
        const state: FakeState = {
            credits: 50,
            createError: new Error("database unavailable"),
            created: [],
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
    });

    it("does not write a ledger entry for a removed user", async () => {
        const state: FakeState = {
            credits: 50,
            userMissing: true,
            created: [],
            committed: false,
        };
        await withFakeTransaction(state, () =>
            grantSignupCreditsForUser({ id: "user-5" }),
        );

        assert.equal(state.created.length, 0);
    });
});
