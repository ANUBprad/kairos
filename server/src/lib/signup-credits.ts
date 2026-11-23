import prisma from "./db.js";

const SIGNUP_BONUS_CREDITS = 50;

function isUniqueConstraintError(error: unknown): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        (error as { code?: unknown }).code === "P2002"
    );
}

/**
 * Records the ledger entry that matches the 50 welcome credits granted by the
 * `user.credits` database default. It never changes the user's balance, and a
 * unique idempotency key makes repeated registration hooks harmless.
 */
export async function grantSignupCreditsForUser(user: { id: string }): Promise<void> {
    const idempotencyKey = `signup-credit:${user.id}`;

    await prisma.$transaction(async (tx) => {
        const existing = await tx.creditTransaction.findUnique({
            where: { idempotencyKey },
            select: { id: true },
        });
        if (existing) return;

        const current = await tx.user.findUnique({
            where: { id: user.id },
            select: { credits: true },
        });
        // The user can be removed between account creation and the hook.
        if (!current) return;

        try {
            await tx.creditTransaction.create({
                data: {
                    userId: user.id,
                    amount: SIGNUP_BONUS_CREDITS,
                    // The default balance already includes the bonus; the
                    // ledger entry documents that initial state.
                    balanceAfter: current.credits,
                    type: "SIGNUP_BONUS",
                    description: "Welcome credits",
                    metadata: { idempotencyKey },
                    idempotencyKey,
                },
            });
        } catch (error) {
            // Another registration hook won the race with the same key.
            if (isUniqueConstraintError(error)) return;
            throw error;
        }
    });
}
