import prisma from "./db.js";

const SIGNUP_BONUS_CREDITS = 50;

/**
 * Grants the 50 welcome credits and records the matching SIGNUP_BONUS ledger
 * entry in one transaction. `createMany({ skipDuplicates: true })` is the
 * conflict-safe insert: unlike catching a unique violation inside an
 * interactive transaction, it does not leave the transaction in an aborted
 * state. The balance is incremented only when this call actually inserted the
 * ledger row, so concurrent/retried signup hooks cannot grant the bonus twice.
 *
 * Users created before this behavior keep their existing balances; nothing is
 * backfilled or rewritten.
 */
export async function grantSignupCreditsForUser(user: { id: string }): Promise<void> {
    const idempotencyKey = `signup-credit:${user.id}`;

    await prisma.$transaction(async (tx) => {
        const current = await tx.user.findUnique({
            where: { id: user.id },
            select: { credits: true },
        });
        // The user can be removed between account creation and the hook.
        if (!current) return;

        const inserted = await tx.creditTransaction.createMany({
            data: [
                {
                    userId: user.id,
                    amount: SIGNUP_BONUS_CREDITS,
                    balanceAfter: current.credits + SIGNUP_BONUS_CREDITS,
                    type: "SIGNUP_BONUS",
                    description: "Welcome credits",
                    metadata: { idempotencyKey },
                    idempotencyKey,
                },
            ],
            skipDuplicates: true,
        });
        if (inserted.count === 0) return;

        await tx.user.update({
            where: { id: user.id },
            data: { credits: { increment: SIGNUP_BONUS_CREDITS } },
        });
    });
}
