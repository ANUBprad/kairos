import prisma from "../lib/db.js";
import { InsufficientCreditsError } from "../types/app-error.js";
import type { CreditTransactionType, Prisma } from "../generated/prisma/client.js";
import {
  CREDIT_PACKS,
  calculateCreditsForInr,
} from "../lib/pricing.js";

export { CREDIT_PACKS, calculateCreditsForInr } from "../lib/pricing.js";

export const CREDIT_COSTS = {
  SOURCE_UPLOAD: 5,
  CHAT_MESSAGE: 1,
  ARTIFACT_GENERATE: 10,
  AUDIO_DEBATE: 50,
} as const;

export interface CreditMutationInput {
  userId: string;
  amount: number;
  type: CreditTransactionType;
  description: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface RefundChargeInput {
  chargeIdempotencyKey: string;
  refundIdempotencyKey: string;
  expectedUserId?: string;
  reason: string;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function readBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { credits: true },
  });
  return user?.credits ?? 0;
}

/**
 * Returns user's current credit balance.
 */
export async function getUserCredits(userId: string): Promise<number> {
  return readBalance(userId);
}

/**
 * Throws InsufficientCreditsError if user has fewer credits than required.
 */
export async function assertHasCredits(userId: string, required: number): Promise<number> {
  const balance = await getUserCredits(userId);
  if (balance < required) {
    throw new InsufficientCreditsError(
      `Insufficient credits. This action requires ${required} credits, but your current balance is ${balance}.`,
      { required, balance, deficit: required - balance },
    );
  }
  return balance;
}

/**
 * Atomically deducts credits from a user's account and logs the transaction.
 * An idempotency key makes retries safe; the debit amount is never recomputed
 * from client input.
 */
export async function deductCredits(
  input: CreditMutationInput,
): Promise<{ success: boolean; balance: number }> {
  const { userId, amount, type, description, metadata, idempotencyKey } = input;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit deduction amount must be a positive integer.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.creditTransaction.findUnique({
          where: { idempotencyKey },
          select: { id: true },
        });
        if (existing) {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { credits: true },
          });
          return { success: true, balance: user?.credits ?? 0 };
        }
      }

      const current = await tx.user.findUnique({
        where: { id: userId },
        select: { credits: true },
      });
      const currentBalance = current?.credits ?? 0;

      if (currentBalance < amount) {
        throw new InsufficientCreditsError(
          `Insufficient credits. Required: ${amount}, Available: ${currentBalance}.`,
          {
            required: amount,
            balance: currentBalance,
            deficit: amount - currentBalance,
          },
        );
      }

      // Conditional decrement prevents lost updates and overdrafts under concurrency.
      const claimed = await tx.user.updateMany({
        where: { id: userId, credits: { gte: amount } },
        data: { credits: { decrement: amount } },
      });
      if (claimed.count !== 1) {
        throw new InsufficientCreditsError("Credit balance changed concurrently.", {
          required: amount,
          balance: currentBalance,
          deficit: amount - currentBalance,
        });
      }

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { credits: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount: -amount,
          balanceAfter: updated.credits,
          type,
          description,
          metadata: metadata as object | undefined,
          idempotencyKey,
        },
      });

      return { success: true, balance: updated.credits };
    });
  } catch (error) {
    if (idempotencyKey && isUniqueConstraintError(error)) {
      return { success: true, balance: await readBalance(userId) };
    }
    throw error;
  }
}

/**
 * Atomically adds credits to a user's account (e.g. from a purchase or bonus) and logs the transaction.
 */
export async function addCredits(
  input: CreditMutationInput,
): Promise<number> {
  const { userId, amount, type, description, metadata, idempotencyKey } = input;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit grant amount must be a positive integer.");
  }

  try {
    return await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.creditTransaction.findUnique({
          where: { idempotencyKey },
          select: { id: true },
        });
        if (existing) {
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { credits: true },
          });
          return user?.credits ?? 0;
        }
      }

      await tx.user.update({
        where: { id: userId },
        data: { credits: { increment: amount } },
      });

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { credits: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          balanceAfter: updated.credits,
          type,
          description,
          metadata: metadata as object | undefined,
          idempotencyKey,
        },
      });

      return updated.credits;
    });
  } catch (error) {
    if (idempotencyKey && isUniqueConstraintError(error)) {
      return readBalance(userId);
    }
    throw error;
  }
}

/**
 * Refunds credits for a failed operation. The idempotency key must be stable
 * for the operation being refunded so retries cannot double-credit.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  originalType: CreditTransactionType,
  reason: string,
  idempotencyKey: string,
): Promise<void> {
  await addCredits({
    userId,
    amount,
    type: "REFUND",
    description: `Refund for ${originalType}: ${reason}`,
    metadata: { originalType, reason },
    idempotencyKey,
  });
}

/**
 * Refunds the exact amount of a recorded debit. If the debit is missing (for
 * example, a historical operation created before ledger keys existed), no
 * credits are granted. The refund itself is idempotent via its own key.
 */
export async function refundChargeInTransaction(
  tx: Prisma.TransactionClient,
  input: RefundChargeInput,
): Promise<boolean> {
  const charge = await tx.creditTransaction.findUnique({
    where: { idempotencyKey: input.chargeIdempotencyKey },
    select: {
      id: true,
      userId: true,
      amount: true,
      type: true,
    },
  });

  if (
    !charge ||
    charge.amount >= 0 ||
    (input.expectedUserId && charge.userId !== input.expectedUserId)
  ) {
    return false;
  }

  const existingRefund = await tx.creditTransaction.findUnique({
    where: { idempotencyKey: input.refundIdempotencyKey },
    select: { id: true },
  });
  if (existingRefund) return true;

  const amount = -charge.amount;
  await tx.user.update({
    where: { id: charge.userId },
    data: { credits: { increment: amount } },
  });
  const updatedUser = await tx.user.findUniqueOrThrow({
    where: { id: charge.userId },
    select: { credits: true },
  });

  await tx.creditTransaction.create({
    data: {
      userId: charge.userId,
      amount,
      balanceAfter: updatedUser.credits,
      type: "REFUND",
      description: `Refund for ${charge.type}: ${input.reason}`,
      metadata: {
        originalType: charge.type,
        originalChargeId: charge.id,
        reason: input.reason,
      },
      idempotencyKey: input.refundIdempotencyKey,
    },
  });

  return true;
}

/** Transaction wrapper around {@link refundChargeInTransaction}. */
export async function refundCreditCharge(input: RefundChargeInput): Promise<boolean> {
  try {
    return await prisma.$transaction((tx) =>
      refundChargeInTransaction(tx, input),
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return true;
    }
    throw error;
  }
}

/**
 * Returns the credit transaction history for a user.
 */
export async function getCreditHistory(userId: string, limit = 50) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
