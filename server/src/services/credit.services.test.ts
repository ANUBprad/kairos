import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import { refundChargeInTransaction } from "./credit.services.js";

type ChargeRow = {
  id: string;
  userId: string;
  amount: number;
  type: "SOURCE_UPLOAD" | "ARTIFACT_GENERATE" | "AUDIO_DEBATE" | "CHAT_MESSAGE";
};

function fakeTx(options: {
  charge?: ChargeRow | null;
  existingRefund?: boolean;
}) {
  const created: Array<Record<string, unknown>> = [];
  let incremented = 0;

  const tx = {
    creditTransaction: {
      findUnique: async ({ where }: { where: { idempotencyKey: string } }) => {
        if (where.idempotencyKey.endsWith(":refund") || where.idempotencyKey.includes("-refund:")) {
          return options.existingRefund ? { id: "refund-1" } : null;
        }
        return options.charge ?? null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return data;
      },
    },
    user: {
      update: async () => {
        incremented += 1;
      },
      findUniqueOrThrow: async () => ({ credits: 42 }),
    },
  };

  return { tx: tx as unknown as Prisma.TransactionClient, created, getIncremented: () => incremented };
}

describe("credit refund linkage", () => {
  it("refunds the exact recorded debit amount once", async () => {
    const { tx, created, getIncremented } = fakeTx({
      charge: {
        id: "charge-1",
        userId: "u1",
        amount: -10,
        type: "ARTIFACT_GENERATE",
      },
    });

    const refunded = await refundChargeInTransaction(tx, {
      chargeIdempotencyKey: "artifact-charge:a1",
      refundIdempotencyKey: "artifact-refund:a1",
      expectedUserId: "u1",
      reason: "generation failed",
    });

    assert.equal(refunded, true);
    assert.equal(getIncremented(), 1);
    assert.equal(created.length, 1);
    assert.equal(created[0]!.amount, 10);
    assert.equal(created[0]!.type, "REFUND");
    assert.equal(created[0]!.idempotencyKey, "artifact-refund:a1");
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

  it("treats an existing refund key as already refunded", async () => {
    const { tx, created, getIncremented } = fakeTx({
      charge: {
        id: "charge-3",
        userId: "u1",
        amount: -1,
        type: "CHAT_MESSAGE",
      },
      existingRefund: true,
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
    assert.equal(getIncremented(), 0);
    assert.equal(created.length, 0);
  });
});
