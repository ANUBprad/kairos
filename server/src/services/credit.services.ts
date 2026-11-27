import prisma from "../lib/db.js";
import { InsufficientCreditsError } from "../types/app-error.js";
import type { CreditTransactionType, Prisma } from "../generated/prisma/client.js";
import {
  CREDIT_PACKS,
  calculateCreditsForInr,
} from "../lib/pricing.js";
import { isDeveloperInReader, isDeveloperUser } from "../lib/developer.js";

export { CREDIT_PACKS, calculateCreditsForInr } from "../lib/pricing.js";

/**
 * A source ingestion is one charge, regardless of how many extraction,
 * chunking, embedding or indexing stages it performs internally.
 */
export const CREDIT_COSTS = {
  SOURCE_UPLOAD: 1,
  CHAT_MESSAGE: 1,
  ARTIFACT_GENERATE: 3,
  ARTIFACT_COMPUTE: 5,
  AUDIO_DEBATE: 10,
} as const;

/**
 * Server-owned UTC free-credit window. Each six-hour window grants a quota
 * (never a cash balance) that expires when the next window starts.
 */
export const WINDOW_ALLOWANCE_CREDITS = 100;
export const CREDIT_WINDOW_MS = 6 * 60 * 60 * 1000;
export const CREDIT_WINDOWS_PER_DAY = (24 * 60 * 60 * 1000) / CREDIT_WINDOW_MS;
/** Backward-compatible alias for the per-window allowance. */
export const DAILY_ALLOWANCE_CREDITS = WINDOW_ALLOWANCE_CREDITS;

export type CreditBucket = "DAILY" | "PAID";
export type CreditChargeBucket = CreditBucket | "AUTO";

export interface CreditSnapshot {
  /** Backward-compatible total (daily + paid). */
  credits: number;
  dailyCredits: number;
  paidCredits: number;
  dailyAllowance: number;
  dailyCreditDay: string;
  nextDailyResetAt: string;
  serverTime: string;
  /** ISO-8601 identifier of the current six-hour UTC window. */
  creditWindowStart: string;
  /** ISO-8601 start of the following window. */
  nextCreditResetAt: string;
  windowAllowance: number;
  windowsPerDay: number;
}

export interface CreditMutationInput {
  userId: string;
  amount: number;
  type: CreditTransactionType;
  description: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  /** Charges default to AUTO (daily first, paid second). Grants use DAILY/PAID. */
  bucket?: CreditChargeBucket;
}

export interface RefundChargeInput {
  chargeIdempotencyKey: string;
  refundIdempotencyKey: string;
  expectedUserId?: string;
  reason: string;
}

type CreditReader = Pick<Prisma.TransactionClient, "creditTransaction" | "user">;

type StoredUserCredits = {
  credits: number;
  dailyCredits: number;
  dailyCreditDay: string;
};

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** @deprecated Kept only for legacy response/metadata compatibility. */
export function getUtcCreditDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

/** Authoritative start of the six-hour UTC window containing `now`. */
export function getUtcCreditWindowStart(now: Date = new Date()): string {
  return new Date(
    Math.floor(now.getTime() / CREDIT_WINDOW_MS) * CREDIT_WINDOW_MS,
  ).toISOString();
}

/** Authoritative next window boundary. Clients must not derive this locally. */
export function getNextUtcCreditReset(now: Date = new Date()): string {
  return new Date(
    Math.floor(now.getTime() / CREDIT_WINDOW_MS) * CREDIT_WINDOW_MS +
      CREDIT_WINDOW_MS,
  ).toISOString();
}

/**
 * Normalizes a stored window identifier. Legacy YYYY-MM-DD values are treated
 * as midnight UTC so a single rollover moves them onto the window scheme.
 */
export function normalizeCreditWindow(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00.000Z`;
  }
  const parsed = Date.parse(trimmed);
  if (!Number.isFinite(parsed)) return null;
  return getUtcCreditWindowStart(new Date(parsed));
}

function snapshotFromUser(
  user: StoredUserCredits | null,
  now: Date,
): CreditSnapshot {
  const dailyCredits = user?.dailyCredits ?? 0;
  const paidCredits = user?.credits ?? 0;
  const creditWindowStart = getUtcCreditWindowStart(now);
  const nextCreditResetAt = getNextUtcCreditReset(now);
  return {
    credits: dailyCredits + paidCredits,
    dailyCredits,
    paidCredits,
    dailyAllowance: DAILY_ALLOWANCE_CREDITS,
    dailyCreditDay: user?.dailyCreditDay ?? creditWindowStart,
    nextDailyResetAt: nextCreditResetAt,
    serverTime: now.toISOString(),
    creditWindowStart,
    nextCreditResetAt,
    windowAllowance: WINDOW_ALLOWANCE_CREDITS,
    windowsPerDay: CREDIT_WINDOWS_PER_DAY,
  };
}

function insufficientCreditsError(
  required: number,
  snapshot: CreditSnapshot,
): InsufficientCreditsError {
  return new InsufficientCreditsError(
    `Insufficient credits. This action requires ${required} credits. You have ${snapshot.dailyCredits} daily and ${snapshot.paidCredits} paid credits remaining; daily credits reset at ${snapshot.nextDailyResetAt}.`,
    {
      code: "INSUFFICIENT_CREDITS",
      required,
      balance: snapshot.credits,
      deficit: Math.max(0, required - snapshot.credits),
      dailyCredits: snapshot.dailyCredits,
      paidCredits: snapshot.paidCredits,
      dailyAllowance: snapshot.dailyAllowance,
      nextDailyResetAt: snapshot.nextDailyResetAt,
      serverTime: snapshot.serverTime,
      creditWindowStart: snapshot.creditWindowStart,
      nextCreditResetAt: snapshot.nextCreditResetAt,
      windowAllowance: snapshot.windowAllowance,
      windowsPerDay: snapshot.windowsPerDay,
    },
  );
}

/**
 * Serializes credit mutations for a user. The advisory lock is transaction
 * scoped; conditional updates below remain the final overdraft guard for
 * clients that do not expose `$executeRaw`.
 */
async function lockCreditsForUser(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  const client = tx as unknown as {
    $executeRaw?: (
      strings: TemplateStringsArray,
      ...values: unknown[]
    ) => Promise<number>;
  };
  if (typeof client.$executeRaw !== "function") return;
  const executeRaw = client.$executeRaw.bind(client);
  await executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'credit:' + userId}))`;
}

/**
 * Lazily renews the free allowance on the first server-side operation of a
 * new six-hour UTC window. The conditional update makes concurrent rollover
 * idempotent: exactly one caller can claim a given (user, window) and write
 * its ledger row.
 */
export async function ensureDailyCreditsInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date = new Date(),
): Promise<CreditSnapshot> {
  const windowStart = getUtcCreditWindowStart(now);
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { credits: true, dailyCredits: true, dailyCreditDay: true },
  });
  if (!user) return snapshotFromUser(null, now);
  const storedWindow = normalizeCreditWindow(user.dailyCreditDay);
  if (storedWindow !== null && storedWindow >= windowStart) {
    return snapshotFromUser(user, now);
  }

  const claimed = await tx.user.updateMany({
    where: { id: userId, dailyCreditDay: { lt: windowStart } },
    data: {
      dailyCredits: WINDOW_ALLOWANCE_CREDITS,
      dailyCreditDay: windowStart,
    },
  });

  if (claimed.count === 1) {
    const grantAmount = Math.max(
      0,
      WINDOW_ALLOWANCE_CREDITS - user.dailyCredits,
    );
    const nextCreditResetAt = getNextUtcCreditReset(now);
    await tx.creditTransaction.create({
      data: {
        userId,
        amount: grantAmount,
        balanceAfter: user.credits + WINDOW_ALLOWANCE_CREDITS,
        type: "DAILY_ALLOWANCE",
        description: `Free credit window reset for ${windowStart} (UTC)`,
        bucket: "DAILY",
        dailyAmount: grantAmount,
        paidAmount: 0,
        balanceAfterDaily: WINDOW_ALLOWANCE_CREDITS,
        balanceAfterPaid: user.credits,
        metadata: {
          day: getUtcCreditDay(now),
          creditWindowStart: windowStart,
          nextCreditResetAt,
          windowAllowance: WINDOW_ALLOWANCE_CREDITS,
          dailyCreditDay: windowStart,
          bucket: "DAILY",
          previousDailyCredits: user.dailyCredits,
          nextDailyResetAt: nextCreditResetAt,
        } as Prisma.InputJsonValue,
        idempotencyKey: `daily-reset:${userId}:${windowStart}`,
      },
    });
  }

  const current = await tx.user.findUnique({
    where: { id: userId },
    select: { credits: true, dailyCredits: true, dailyCreditDay: true },
  });
  return snapshotFromUser(current, now);
}

/** Returns the server-authoritative two-bucket credit snapshot. */
export async function getCreditSnapshot(
  userId: string,
  now: Date = new Date(),
): Promise<CreditSnapshot> {
  return prisma.$transaction((tx) =>
    ensureDailyCreditsInTransaction(tx, userId, now),
  );
}

/**
 * Returns the user's current total credit balance. Reading also performs the
 * lazy UTC rollover so the UI never shows an expired daily bucket.
 */
export async function getUserCredits(userId: string): Promise<number> {
  return (await getCreditSnapshot(userId)).credits;
}

/** Throws InsufficientCreditsError if the combined balance is too low. */
export async function assertHasCredits(
  userId: string,
  required: number,
): Promise<CreditSnapshot> {
  const snapshot = await getCreditSnapshot(userId);
  // Allowlisted developers bypass application-level credit gating. The real
  // balances are still returned; no paid entitlement is fabricated.
  if ((await isDeveloperUser(userId)) || snapshot.credits >= required) {
    return snapshot;
  }
  throw insufficientCreditsError(required, snapshot);
}

/**
 * Resolves an already-recorded debit for an idempotency key. A key may only be
 * reused by the same user, type and amount; reusing it for another charge is
 * rejected instead of silently skipping the debit.
 */
async function idempotentDebitBalance(
  reader: CreditReader,
  input: CreditMutationInput,
): Promise<CreditSnapshot | null> {
  if (!input.idempotencyKey) return null;

  const existing = await reader.creditTransaction.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
    select: { userId: true, amount: true, type: true },
  });
  if (!existing) return null;

  if (
    existing.userId !== input.userId ||
    existing.amount !== -input.amount ||
    existing.type !== input.type
  ) {
    throw new Error(
      `Idempotency key ${input.idempotencyKey} is already used by a different credit charge.`,
    );
  }

  const user = await reader.user.findUnique({
    where: { id: input.userId },
    select: { credits: true, dailyCredits: true, dailyCreditDay: true },
  });
  return snapshotFromUser(user, new Date());
}

/**
 * Debits credits using a caller-owned transaction so the ledger row, the
 * business record and a durable outbox job can commit atomically. Daily free
 * credits are consumed before paid credits; refunds restore those exact
 * bucket amounts.
 */
export async function debitCreditsInTransaction(
  tx: Prisma.TransactionClient,
  input: CreditMutationInput,
  now: Date = new Date(),
): Promise<{ success: boolean; balance: number; snapshot: CreditSnapshot }> {
  const { userId, amount, type, description, metadata, idempotencyKey } = input;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit deduction amount must be a positive integer.");
  }

  // Developer status is resolved from the user row inside this transaction.
  // There is no client-supplied flag on CreditMutationInput to trust.
  if (await isDeveloperInReader(tx, userId)) {
    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { credits: true, dailyCredits: true, dailyCreditDay: true },
    });
    const snapshot = snapshotFromUser(user, now);
    return { success: true, balance: snapshot.credits, snapshot };
  }

  if (idempotencyKey) {
    const existing = await idempotentDebitBalance(tx, input);
    if (existing) {
      return { success: true, balance: existing.credits, snapshot: existing };
    }
  }

  await lockCreditsForUser(tx, userId);
  const available = await ensureDailyCreditsInTransaction(tx, userId, now);
  if (available.credits < amount) {
    throw insufficientCreditsError(amount, available);
  }

  const dailySpend =
    input.bucket === "PAID"
      ? 0
      : Math.min(amount, available.dailyCredits);
  const paidSpend = amount - dailySpend;

  if (dailySpend > 0) {
    const claimed = await tx.user.updateMany({
      where: { id: userId, dailyCredits: { gte: dailySpend } },
      data: { dailyCredits: { decrement: dailySpend } },
    });
    if (claimed.count !== 1) {
      throw insufficientCreditsError(amount, available);
    }
  }
  if (paidSpend > 0) {
    const claimed = await tx.user.updateMany({
      where: { id: userId, credits: { gte: paidSpend } },
      data: { credits: { decrement: paidSpend } },
    });
    if (claimed.count !== 1) {
      throw insufficientCreditsError(amount, available);
    }
  }

  const updated = await tx.user.findUniqueOrThrow({
    where: { id: userId },
    select: { credits: true, dailyCredits: true, dailyCreditDay: true },
  });
  const after = snapshotFromUser(updated, now);
  const bucket: CreditBucket | "MIXED" =
    dailySpend > 0 && paidSpend > 0
      ? "MIXED"
      : dailySpend > 0
        ? "DAILY"
        : "PAID";

  await tx.creditTransaction.create({
    data: {
      userId,
      amount: -amount,
      balanceAfter: after.credits,
      type,
      description,
      bucket,
      dailyAmount: dailySpend,
      paidAmount: paidSpend,
      balanceAfterDaily: after.dailyCredits,
      balanceAfterPaid: after.paidCredits,
      metadata: {
        ...(input.metadata ?? {}),
        bucket,
        dailyCreditDay: after.dailyCreditDay,
        creditWindowStart: after.creditWindowStart,
        nextCreditResetAt: after.nextCreditResetAt,
        nextDailyResetAt: after.nextDailyResetAt,
      } as Prisma.InputJsonValue,
      idempotencyKey,
    },
  });

  return { success: true, balance: after.credits, snapshot: after };
}

/** Atomically debits credits and logs the transaction with an idempotency key. */
export async function deductCredits(
  input: CreditMutationInput,
  now: Date = new Date(),
): Promise<{ success: boolean; balance: number; snapshot: CreditSnapshot }> {
  try {
    return await prisma.$transaction((tx) =>
      debitCreditsInTransaction(tx, input, now),
    );
  } catch (error) {
    if (input.idempotencyKey && isUniqueConstraintError(error)) {
      const existing = await idempotentDebitBalance(prisma, input);
      if (existing) {
        return { success: true, balance: existing.credits, snapshot: existing };
      }
    }
    throw error;
  }
}

function assertMatchingGrant(
  existing: { userId: string; amount: number; type?: CreditTransactionType },
  userId: string,
  amount: number,
  idempotencyKey: string,
  type?: CreditTransactionType,
): void {
  if (
    existing.userId !== userId ||
    existing.amount !== amount ||
    (type && existing.type && existing.type !== type)
  ) {
    throw new Error(
      `Idempotency key ${idempotencyKey} is already used by a different credit grant.`,
    );
  }
}

/** Atomically adds credits to the requested bucket and logs the transaction. */
export async function addCredits(
  input: CreditMutationInput,
): Promise<number> {
  const { userId, amount, type, description, metadata, idempotencyKey } = input;
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error("Credit grant amount must be a positive integer.");
  }

  const bucket: CreditBucket = input.bucket === "DAILY" ? "DAILY" : "PAID";

  try {
    return await prisma.$transaction(async (tx) => {
      if (idempotencyKey) {
        const existing = await tx.creditTransaction.findUnique({
          where: { idempotencyKey },
          select: { userId: true, amount: true, type: true },
        });
        if (existing) {
          assertMatchingGrant(
            existing,
            userId,
            amount,
            idempotencyKey,
            type,
          );
          const user = await tx.user.findUnique({
            where: { id: userId },
            select: { credits: true },
          });
          return user?.credits ?? 0;
        }
      }

      await tx.user.update({
        where: { id: userId },
        data:
          bucket === "DAILY"
            ? { dailyCredits: { increment: amount } }
            : { credits: { increment: amount } },
      });

      const updated = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { credits: true, dailyCredits: true },
      });

      await tx.creditTransaction.create({
        data: {
          userId,
          amount,
          balanceAfter: updated.credits + updated.dailyCredits,
          type,
          description,
          bucket,
          dailyAmount: bucket === "DAILY" ? amount : 0,
          paidAmount: bucket === "PAID" ? amount : 0,
          balanceAfterDaily: updated.dailyCredits,
          balanceAfterPaid: updated.credits,
          metadata: metadata as object | undefined,
          idempotencyKey,
        },
      });

      return bucket === "DAILY"
        ? updated.credits + updated.dailyCredits
        : updated.credits;
    });
  } catch (error) {
    if (idempotencyKey && isUniqueConstraintError(error)) {
      const winner = await prisma.creditTransaction.findUnique({
        where: { idempotencyKey },
        select: { userId: true, amount: true, type: true },
      });
      if (winner) {
        assertMatchingGrant(winner, userId, amount, idempotencyKey, type);
      }
      return (await getCreditSnapshot(userId)).credits;
    }
    throw error;
  }
}

/** Refunds a standalone grant to the paid bucket with a stable key. */
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
    bucket: "PAID",
  });
}

type ChargeRow = {
  id: string;
  userId: string;
  amount: number;
  type: CreditTransactionType;
  bucket: string | null;
  dailyAmount: number;
  paidAmount: number;
  metadata: Prisma.JsonValue | null;
};

function metadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

/**
 * Refunds the exact recorded debit, returning daily and paid portions to their
 * original buckets. A daily charge from an already-expired six-hour window
 * cannot resurrect the old quota; its value is restored to the non-expiring
 * balance so the user is never penalized by a race across a window boundary.
 */
export async function refundChargeInTransaction(
  tx: Prisma.TransactionClient,
  input: RefundChargeInput,
  now: Date = new Date(),
): Promise<boolean> {
  const charge = await tx.creditTransaction.findUnique({
    where: { idempotencyKey: input.chargeIdempotencyKey },
    select: {
      id: true,
      userId: true,
      amount: true,
      type: true,
      bucket: true,
      dailyAmount: true,
      paidAmount: true,
      metadata: true,
    },
  });

  if (
    !charge ||
    charge.amount >= 0 ||
    (input.expectedUserId && charge.userId !== input.expectedUserId)
  ) {
    return false;
  }

  // Developer debits are never recorded, so there is nothing to refund. This
  // also protects legacy charges after an account joins the allowlist.
  if (await isDeveloperInReader(tx, charge.userId)) {
    return false;
  }

  const existingRefund = await tx.creditTransaction.findUnique({
    where: { idempotencyKey: input.refundIdempotencyKey },
    select: { userId: true, amount: true, metadata: true },
  });
  if (existingRefund) {
    const originalChargeId = metadataRecord(existingRefund.metadata)
      .originalChargeId;
    if (originalChargeId && originalChargeId !== charge.id) {
      throw new Error(
        `Refund idempotency key ${input.refundIdempotencyKey} belongs to another charge.`,
      );
    }
    return true;
  }

  const chargeMeta = metadataRecord((charge as ChargeRow).metadata);
  const chargeWindowValue =
    typeof chargeMeta.creditWindowStart === "string"
      ? chargeMeta.creditWindowStart
      : typeof chargeMeta.dailyCreditDay === "string"
        ? chargeMeta.dailyCreditDay
        : undefined;
  const chargedAmount = -charge.amount;
  const recordedDaily = charge.dailyAmount || 0;
  const recordedPaid = charge.paidAmount || 0;
  const splitDaily =
    charge.bucket === "DAILY"
      ? chargedAmount
      : charge.bucket === "MIXED"
        ? recordedDaily
        : recordedDaily;
  const splitPaid = Math.max(0, chargedAmount - splitDaily);

  const user = await tx.user.findUniqueOrThrow({
    where: { id: charge.userId },
    select: { credits: true, dailyCredits: true, dailyCreditDay: true },
  });
  // A daily credit belongs to exactly one window. Charges without a stored
  // window predate the scheme and keep the legacy same-day restore behavior.
  const canRestoreDaily =
    chargeWindowValue === undefined
      ? true
      : normalizeCreditWindow(chargeWindowValue) === getUtcCreditWindowStart(now);
  const restoredDaily = canRestoreDaily
    ? Math.min(splitDaily, Math.max(0, DAILY_ALLOWANCE_CREDITS - user.dailyCredits))
    : 0;
  const expiredDaily = splitDaily - restoredDaily;
  const restoredPaid = splitPaid + expiredDaily;

  await tx.user.update({
    where: { id: charge.userId },
    data: {
      dailyCredits: { increment: restoredDaily },
      credits: { increment: restoredPaid },
    },
  });
  const updatedUser = await tx.user.findUniqueOrThrow({
    where: { id: charge.userId },
    select: { credits: true, dailyCredits: true },
  });

  await tx.creditTransaction.create({
    data: {
      userId: charge.userId,
      amount: chargedAmount,
      balanceAfter: updatedUser.credits + updatedUser.dailyCredits,
      type: "REFUND",
      bucket:
        restoredDaily > 0 && restoredPaid > 0
          ? "MIXED"
          : restoredDaily > 0
            ? "DAILY"
            : "PAID",
      dailyAmount: restoredDaily,
      paidAmount: restoredPaid,
      balanceAfterDaily: updatedUser.dailyCredits,
      balanceAfterPaid: updatedUser.credits,
      description: `Refund for ${charge.type}: ${input.reason}`,
      metadata: {
        originalType: charge.type,
        originalChargeId: charge.id,
        reason: input.reason,
        bucket: "MIXED",
        expiredDailyRefund: expiredDaily,
        creditWindowStart: getUtcCreditWindowStart(now),
        nextCreditResetAt: getNextUtcCreditReset(now),
        dailyCreditDay: getUtcCreditWindowStart(now),
      } as Prisma.InputJsonValue,
      idempotencyKey: input.refundIdempotencyKey,
    },
  });

  return true;
}

/** Transaction wrapper around {@link refundChargeInTransaction}. */
export async function refundCreditCharge(
  input: RefundChargeInput,
  now: Date = new Date(),
): Promise<boolean> {
  try {
    return await prisma.$transaction((tx) =>
      refundChargeInTransaction(tx, input, now),
    );
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return true;
    }
    throw error;
  }
}

/** Returns the credit transaction history for a user. */
export async function getCreditHistory(userId: string, limit = 50) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
