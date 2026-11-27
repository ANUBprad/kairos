import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import { refundChargeInTransaction } from "./credit.services.js";

type ChargeRow = {
  id: string;
  userId: string;
  amount: number;
  type: "SOURCE_UPLOAD" | "ARTIFACT_GENERATE" | "AUDIO_DEBATE" | "CHAT_MESSAGE";
  bucket?: string | null;
  dailyAmount?: number;
  paidAmount?: number;
  metadata?: Record<string, unknown> | null;
};

function fakeTx(options: {
  charge?: ChargeRow | null;
  existingRefund?: { userId: string; amount: number; metadata?: Record<string, unknown> } | null;
  user?: { credits: number; dailyCredits: number; dailyCreditDay: string };
}) {
  const created: Array<Record<string, unknown>> = [];
  const updates: Array<Record<string, unknown>> = [];
  const user = options.user ?? { credits: 42, dailyCredits: 100, dailyCreditDay: "2099-01-01" };

  const tx = {
    creditTransaction: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) => {
        if (where.idempotencyKey.endsWith(":refund") || where.idempotencyKey.includes("-refund:")) {
          return options.existingRefund
            ? { id: "refund-1", ...options.existingRefund }
            : null;
        }
        const charge = options.charge;
        return charge
          ? {
              ...charge,
              bucket: charge.bucket ?? null,
              dailyAmount: charge.dailyAmount ?? 0,
              paidAmount: charge.paidAmount ?? 0,
              metadata: charge.metadata ?? null,
            }
          : null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return data;
      },
    },
    user: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
      },
      findUniqueOrThrow: async () => ({ credits: user.credits, dailyCredits: user.dailyCredits }),
      findUnique: async () => user,
    },
  };

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    created,
    updates,
  };
}

describe("credit refund linkage", () => {
  it("refunds the exact recorded debit amount once", async () => {
    const { tx, created, updates } = fakeTx({
      charge: {
        id: "charge-1",
        userId: "u1",
        amount: -10,
        type: "ARTIFACT_GENERATE",
        bucket: "PAID",
        paidAmount: 10,
        metadata: { dailyCreditDay: "2099-01-01" },
      },
    });

    const refunded = await refundChargeInTransaction(tx, {
      chargeIdempotencyKey: "artifact-charge:a1",
      refundIdempotencyKey: "artifact-refund:a1",
      expectedUserId: "u1",
      reason: "generation failed",
    });

    assert.equal(refunded, true);
    assert.equal(updates.length, 1);
    assert.equal(created.length, 1);
    assert.equal(created[0]!.amount, 10);
    assert.equal(created[0]!.type, "REFUND");
    assert.equal(created[0]!.bucket, "PAID");
    assert.equal(created[0]!.paidAmount, 10);
    assert.equal(created[0]!.idempotencyKey, "artifact-refund:a1");
  });

  it("restores daily and paid portions into their original buckets", async () => {
    const { tx, created, updates } = fakeTx({
      user: { credits: 40, dailyCredits: 93, dailyCreditDay: "2099-01-01" },
      charge: {
        id: "charge-mixed",
        userId: "u1",
        amount: -10,
        type: "ARTIFACT_GENERATE",
        bucket: "MIXED",
        dailyAmount: 7,
        paidAmount: 3,
      },
    });

    assert.equal(
      await refundChargeInTransaction(tx, {
        chargeIdempotencyKey: "artifact-charge:mixed",
        refundIdempotencyKey: "artifact-refund:mixed",
        expectedUserId: "u1",
        reason: "generation failed",
      }),
      true,
    );

    assert.deepEqual(updates[0], {
      dailyCredits: { increment: 7 },
      credits: { increment: 3 },
    });
    assert.equal(created[0]!.dailyAmount, 7);
    assert.equal(created[0]!.paidAmount, 3);
  });

  it("does not refund when the debit is missing or belongs to another user", async () => {
    const missing = fakeTx({ charge: null });
    assert.equal(
      await refundChargeInTransaction(missing.tx, {
        chargeIdempotencyKey: "artifact-charge:a2",
        refundIdempotencyKey: "artifact-refund:a2",
        reason: "failed",
      }),
      false,
    );
    assert.equal(missing.created.length, 0);

    const otherUser = fakeTx({
      charge: {
        id: "charge-2",
        userId: "u2",
        amount: -5,
        type: "CHAT_MESSAGE",
      },
    });
    assert.equal(
      await refundChargeInTransaction(otherUser.tx, {
        chargeIdempotencyKey: "chat-charge:m1",
        refundIdempotencyKey: "chat-refund:m1",
        expectedUserId: "u1",
        reason: "failed",
      }),
      false,
    );
    assert.equal(otherUser.created.length, 0);
  });

  it("treats a matching existing refund key as already refunded", async () => {
    const { tx, created, updates } = fakeTx({
      charge: {
        id: "charge-3",
        userId: "u1",
        amount: -1,
        type: "CHAT_MESSAGE",
        bucket: "DAILY",
        dailyAmount: 1,
        metadata: { dailyCreditDay: "2099-01-01" },
      },
      existingRefund: {
        userId: "u1",
        amount: 1,
        metadata: { originalChargeId: "charge-3" },
      },
    });

    assert.equal(
      await refundChargeInTransaction(tx, {
        chargeIdempotencyKey: "chat-charge:m2",
        refundIdempotencyKey: "chat-refund:m2",
        expectedUserId: "u1",
        reason: "aborted",
      }),
      true,
    );
    assert.equal(updates.length, 0);
    assert.equal(created.length, 0);
  });

  it("rejects a refund key that belongs to a different charge", async () => {
    const { tx } = fakeTx({
      charge: {
        id: "charge-4",
        userId: "u1",
        amount: -1,
        type: "CHAT_MESSAGE",
        bucket: "DAILY",
        dailyAmount: 1,
      },
      existingRefund: {
        userId: "u1",
        amount: 1,
        metadata: { originalChargeId: "another-charge" },
      },
    });

    await assert.rejects(
      refundChargeInTransaction(tx, {
        chargeIdempotencyKey: "chat-charge:m3",
        refundIdempotencyKey: "chat-refund:m3",
        expectedUserId: "u1",
        reason: "aborted",
      }),
      /another charge/,
    );
  });
});
