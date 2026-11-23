import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../types/app-error.js";
import type {
  PaymentOrderFacts,
  SettlePaymentInput,
} from "./payment-settlement.services.js";
import {
  classifyPaymentOrder,
  settleCapturedPaymentInTransaction,
} from "./payment-settlement.services.js";

const USER_ID = "user_billing_test";
const OTHER_USER_ID = "user_other";
const ORDER_ID = "order_abc123def456";
const PAYMENT_ID = "pay_abc123def456";

type TestPlan = "FREE" | "PRO" | "PRO_PLUS" | null;
type TestStatus = "PENDING" | "SUCCESS" | "FAILED";

const PACK_50 = { amount: 5000, credits: 100 } as const;
const PRO_PRICE = { amount: 19900, credits: 500 } as const;
const PRO_PLUS_PRICE = { amount: 49900, credits: 1500 } as const;

function restoreEnv(name: string, previous: string | undefined): void {
  if (previous === undefined) delete process.env[name];
  else process.env[name] = previous;
}

function assertAmbiguousError(error: unknown): boolean {
  assert.ok(error instanceof AppError, "expected an AppError");
  assert.equal(error.statusCode, 409);
  assert.match(error.message, /ambiguous legacy entitlement fields/);
  return true;
}

async function assertAmbiguous(promise: Promise<unknown>): Promise<void> {
  await assert.rejects(promise, assertAmbiguousError);
}

function assertClassificationRejected(facts: PaymentOrderFacts): void {
  assert.throws(() => classifyPaymentOrder(facts), assertAmbiguousError);
}

interface Seed {
  plan?: TestPlan;
  credits?: number;
  amount?: number;
  currency?: string;
  status?: TestStatus;
  userId?: string;
  existingPaymentId?: string | null;
  /** 0 simulates a concurrent claim winning the PENDING -> SUCCESS race. */
  claimCount?: number;
  freshStatus?: TestStatus;
  freshPaymentId?: string | null;
  existingGrant?: boolean;
  startingCredits?: number;
}

/** In-memory transaction client: no database, no network, no timers. */
function harness(seed: Seed = {}) {
  const row = {
    id: "payment-row-1",
    userId: seed.userId ?? USER_ID,
    plan: seed.plan ?? null,
    creditsPurchased: seed.credits ?? 0,
    amount: seed.amount ?? PACK_50.amount,
    currency: seed.currency ?? "INR",
    status: seed.status ?? ("PENDING" as TestStatus),
    razorpayOrderId: ORDER_ID,
    razorpayPaymentId: seed.existingPaymentId ?? null,
  };

  let credits = seed.startingCredits ?? 0;
  let userPlan: Exclude<TestPlan, null> = "FREE";
  let planExpiresAt: Date | null = null;
  let existingGrant = seed.existingGrant ?? false;
  let claimCalls = 0;
  const userUpdates: Array<Record<string, unknown>> = [];
  const creditCreates: Array<Record<string, unknown>> = [];

  const tx = {
    paymentRecord: {
      findUnique: async ({
        where,
      }: {
        where: {
          id?: string;
          razorpayOrderId?: string;
          razorpayPaymentId?: string;
        };
      }) => {
        if (where.id === row.id) {
          return {
            status: seed.freshStatus ?? row.status,
            razorpayPaymentId:
              seed.freshPaymentId !== undefined
                ? seed.freshPaymentId
                : row.razorpayPaymentId,
          };
        }
        if (where.razorpayOrderId === ORDER_ID) return { ...row };
        // No other order owns this payment id.
        return null;
      },
      updateMany: async ({ data }: { data: { razorpayPaymentId: string } }) => {
        claimCalls += 1;
        if ((seed.claimCount ?? 1) === 0) return { count: 0 };
        row.status = "SUCCESS";
        row.razorpayPaymentId = data.razorpayPaymentId;
        return { count: 1 };
      },
    },
    user: {
      findUnique: async ({
        select,
      }: {
        select: { credits?: boolean; planExpiresAt?: boolean };
      }) => {
        if (select.planExpiresAt) return { planExpiresAt };
        return { credits };
      },
      findUniqueOrThrow: async () => ({ credits }),
      update: async ({
        data,
      }: {
        data: {
          credits?: { increment: number };
          plan?: TestPlan;
          planExpiresAt?: Date;
        };
      }) => {
        userUpdates.push(data as Record<string, unknown>);
        if (data.credits) credits += data.credits.increment;
        if (data.plan) userPlan = data.plan;
        if (data.planExpiresAt) planExpiresAt = data.planExpiresAt;
      },
    },
    creditTransaction: {
      findUnique: async () => (existingGrant ? { id: "existing-grant" } : null),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        creditCreates.push(data);
        return data;
      },
    },
  };

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    row,
    settle: (input: Partial<SettlePaymentInput> = {}) =>
      settleCapturedPaymentInTransaction(tx as unknown as Prisma.TransactionClient, {
        userId: USER_ID,
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        ...input,
      }),
    getCredits: () => credits,
    getUserPlan: () => userPlan,
    getPlanExpiresAt: () => planExpiresAt,
    getUserUpdates: () => userUpdates,
    getCreditCreates: () => creditCreates,
    getClaimCalls: () => claimCalls,
    setExistingGrant: (value: boolean) => {
      existingGrant = value;
    },
  };
}

describe("payment order classification", () => {
  it("rejects a legacy PRO record with zero credits and a pack amount", () => {
    assertClassificationRejected({
      plan: "PRO",
      creditsPurchased: 0,
      amountPaise: PACK_50.amount,
      currency: "INR",
    });
  });

  it("classifies a null-plan credit pack with exact server-owned credits", () => {
    const result = classifyPaymentOrder({
      plan: null,
      creditsPurchased: PACK_50.credits,
      amountPaise: PACK_50.amount,
      currency: "INR",
    });
    assert.deepEqual(result, {
      kind: "credit_pack",
      plan: null,
      creditsPurchased: 100,
      amountPaise: 5000,
      currency: "INR",
    });
  });

  it("rejects a credit pack whose credits do not match the amount", () => {
    assertClassificationRejected({
      plan: null,
      creditsPurchased: 99,
      amountPaise: PACK_50.amount,
      currency: "INR",
    });
  });

  it("classifies exact PRO and PRO_PLUS subscriptions", () => {
    assert.deepEqual(
      classifyPaymentOrder({
        plan: "PRO",
        creditsPurchased: PRO_PRICE.credits,
        amountPaise: PRO_PRICE.amount,
        currency: "INR",
      }),
      {
        kind: "subscription",
        plan: "PRO",
        creditsPurchased: 500,
        amountPaise: 19900,
        currency: "INR",
      },
    );
    assert.deepEqual(
      classifyPaymentOrder({
        plan: "PRO_PLUS",
        creditsPurchased: PRO_PLUS_PRICE.credits,
        amountPaise: PRO_PLUS_PRICE.amount,
        currency: "INR",
      }),
      {
        kind: "subscription",
        plan: "PRO_PLUS",
        creditsPurchased: 1500,
        amountPaise: 49900,
        currency: "INR",
      },
    );
  });

  it("rejects subscriptions with the wrong amount or the wrong credits", () => {
    assertClassificationRejected({
      plan: "PRO",
      creditsPurchased: PRO_PRICE.credits,
      amountPaise: 20000,
      currency: "INR",
    });
    assertClassificationRejected({
      plan: "PRO_PLUS",
      creditsPurchased: 1499,
      amountPaise: PRO_PLUS_PRICE.amount,
      currency: "INR",
    });
  });

  it("rejects FREE, zero-credit subscriptions, invalid currency and invalid amounts", () => {
    const invalid = [
      { plan: "FREE" as const, creditsPurchased: 500, amountPaise: 19900, currency: "INR" },
      { plan: "PRO" as const, creditsPurchased: 0, amountPaise: 19900, currency: "INR" },
      { plan: null, creditsPurchased: 100, amountPaise: 5000, currency: "USD" },
      { plan: null, creditsPurchased: 100, amountPaise: 0, currency: "INR" },
      { plan: null, creditsPurchased: 100, amountPaise: 5001, currency: "INR" },
      { plan: null, creditsPurchased: 0, amountPaise: 5000, currency: "INR" },
      { plan: "PRO" as const, creditsPurchased: 100, amountPaise: 5000, currency: "INR" },
      { plan: null, creditsPurchased: 100, amountPaise: 12345, currency: "INR" },
    ];
    for (const facts of invalid) {
      assertClassificationRejected(facts);
    }
  });
});

describe("billing entitlement settlement", () => {
  it("does not grant PRO for a legacy PENDING PRO row with pack amount and zero credits", async () => {
    const h = harness({
      plan: "PRO",
      credits: 0,
      amount: PACK_50.amount,
      status: "PENDING",
    });

    await assertAmbiguous(h.settle());

    assert.equal(h.getClaimCalls(), 0);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
    assert.equal(h.getUserPlan(), "FREE");
  });

  it("fails closed for a legacy SUCCESS PRO row instead of reporting PRO applied", async () => {
    const h = harness({
      plan: "PRO",
      credits: 0,
      amount: PACK_50.amount,
      status: "SUCCESS",
      existingPaymentId: PAYMENT_ID,
    });

    await assertAmbiguous(h.settle());

    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
    assert.equal(h.getUserPlan(), "FREE");
  });

  it("grants only credits and reports no plan for an exact credit pack", async () => {
    const h = harness({
      plan: null,
      credits: PACK_50.credits,
      amount: PACK_50.amount,
      status: "PENDING",
    });

    const result = await h.settle();

    assert.equal(result.duplicate, false);
    assert.equal(result.planApplied, null);
    assert.equal(result.creditsAdded, 100);
    assert.equal(result.credits, 100);
    assert.equal(h.getUserPlan(), "FREE");
    assert.equal(h.getUserUpdates().length, 1);
    assert.equal(h.getCreditCreates().length, 1);
    assert.equal(h.getCreditCreates()[0]!.idempotencyKey, "payment-credit:payment-row-1");
    assert.equal(h.getCreditCreates()[0]!.amount, 100);
  });

  it("rejects a credit pack with incorrect credits without writing anything", async () => {
    const h = harness({ plan: null, credits: 99, amount: PACK_50.amount });

    await assertAmbiguous(h.settle());

    assert.equal(h.getClaimCalls(), 0);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
  });

  it("applies the exact subscribed plan for valid PRO and PRO_PLUS records", async () => {
    for (const price of [PRO_PRICE, PRO_PLUS_PRICE]) {
      const h = harness({
        plan: price === PRO_PRICE ? "PRO" : "PRO_PLUS",
        credits: price.credits,
        amount: price.amount,
        status: "PENDING",
      });

      const result = await h.settle();

      assert.equal(result.duplicate, false);
      assert.equal(result.planApplied, h.row.plan);
      assert.equal(result.creditsAdded, price.credits);
      assert.equal(h.getUserPlan(), h.row.plan);
      assert.ok(h.getPlanExpiresAt() instanceof Date);
      assert.equal(h.getUserUpdates().length, 2);
      assert.equal(h.getUserUpdates()[1]!.plan, h.row.plan);
      assert.equal(h.getCreditCreates().length, 1);
    }
  });

  it("rejects subscriptions with wrong amount or credits before any write", async () => {
    const wrongAmount = harness({
      plan: "PRO",
      credits: PRO_PRICE.credits,
      amount: 20000,
    });
    await assertAmbiguous(wrongAmount.settle());

    const wrongCredits = harness({
      plan: "PRO_PLUS",
      credits: 1499,
      amount: PRO_PLUS_PRICE.amount,
    });
    await assertAmbiguous(wrongCredits.settle());

    for (const h of [wrongAmount, wrongCredits]) {
      assert.equal(h.getClaimCalls(), 0);
      assert.equal(h.getUserUpdates().length, 0);
      assert.equal(h.getCreditCreates().length, 0);
      assert.equal(h.getUserPlan(), "FREE");
    }
  });

  it("returns a duplicate credit-pack settlement with no plan and no extra credits", async () => {
    const h = harness({
      plan: null,
      credits: PACK_50.credits,
      amount: PACK_50.amount,
      status: "SUCCESS",
      existingPaymentId: PAYMENT_ID,
      startingCredits: 250,
    });

    const result = await h.settle();

    assert.equal(result.duplicate, true);
    assert.equal(result.planApplied, null);
    assert.equal(result.creditsAdded, 0);
    assert.equal(result.credits, 250);
    assert.equal(h.getClaimCalls(), 0);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
  });

  it("returns the classified plan on a duplicate subscription settlement without re-granting", async () => {
    const h = harness({
      plan: "PRO_PLUS",
      credits: PRO_PLUS_PRICE.credits,
      amount: PRO_PLUS_PRICE.amount,
      status: "SUCCESS",
      existingPaymentId: PAYMENT_ID,
    });

    const result = await h.settle();

    assert.equal(result.duplicate, true);
    assert.equal(result.planApplied, "PRO_PLUS");
    assert.equal(result.creditsAdded, 0);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
  });

  it("settles twice with one claim: the second call is a duplicate with no extra credits", async () => {
    const h = harness({
      plan: null,
      credits: PACK_50.credits,
      amount: PACK_50.amount,
      status: "PENDING",
    });

    const first = await h.settle();
    assert.equal(first.duplicate, false);
    assert.equal(first.creditsAdded, 100);

    const second = await h.settle();
    assert.equal(second.duplicate, true);
    assert.equal(second.planApplied, null);
    assert.equal(second.creditsAdded, 0);
    assert.equal(second.credits, 100);
    assert.equal(h.getClaimCalls(), 1);
    assert.equal(h.getUserUpdates().length, 1);
    assert.equal(h.getCreditCreates().length, 1);
  });

  it("treats a lost claim race as a duplicate without re-granting credits", async () => {
    const h = harness({
      plan: null,
      credits: PACK_50.credits,
      amount: PACK_50.amount,
      status: "PENDING",
      claimCount: 0,
      freshStatus: "SUCCESS",
      freshPaymentId: PAYMENT_ID,
    });

    const result = await h.settle();

    assert.equal(result.duplicate, true);
    assert.equal(result.planApplied, null);
    assert.equal(result.creditsAdded, 0);
    assert.equal(h.getClaimCalls(), 1);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
  });

  it("does not double-credit when the idempotency key already exists", async () => {
    const h = harness({
      plan: null,
      credits: PACK_50.credits,
      amount: PACK_50.amount,
      startingCredits: 500,
      existingGrant: true,
    });

    const result = await h.settle();

    assert.equal(result.duplicate, false);
    assert.equal(result.credits, 500);
    assert.equal(result.planApplied, null);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
  });

  it("returns 404 for another user's order and performs no writes", async () => {
    const h = harness({ userId: OTHER_USER_ID });

    await assert.rejects(h.settle(), (error: unknown) => {
      assert.ok(error instanceof AppError);
      assert.equal(error.statusCode, 404);
      return true;
    });

    assert.equal(h.getClaimCalls(), 0);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
  });

  it("rejects invalid currency and non-positive or non-integer amounts without writes", async () => {
    const invalid = [
      { currency: "USD", amount: PACK_50.amount, credits: PACK_50.credits },
      { currency: "INR", amount: 0, credits: PACK_50.credits },
      { currency: "INR", amount: 5000.5, credits: PACK_50.credits },
    ];
    for (const facts of invalid) {
      const h = harness({
        plan: null,
        currency: facts.currency,
        amount: facts.amount,
        credits: facts.credits,
      });
      await assertAmbiguous(h.settle());
      assert.equal(h.getClaimCalls(), 0);
      assert.equal(h.getUserUpdates().length, 0);
      assert.equal(h.getCreditCreates().length, 0);
    }
  });

  it("rejects an invalid checkout signature before classification or any write", async () => {
    const previous = process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_KEY_SECRET = "test_checkout_secret";
    try {
      const h = harness({
        plan: null,
        credits: PACK_50.credits,
        amount: PACK_50.amount,
      });

      await assert.rejects(h.settle({ signature: "deadbeef" }), /Invalid payment signature/);

      assert.equal(h.getClaimCalls(), 0);
      assert.equal(h.getUserUpdates().length, 0);
      assert.equal(h.getCreditCreates().length, 0);
    } finally {
      restoreEnv("RAZORPAY_KEY_SECRET", previous);
    }
  });

  it("still settles a validly signed checkout order", async () => {
    const previous = process.env.RAZORPAY_KEY_SECRET;
    process.env.RAZORPAY_KEY_SECRET = "test_checkout_secret";
    try {
      const signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(`${ORDER_ID}|${PAYMENT_ID}`)
        .digest("hex");
      const h = harness({
        plan: null,
        credits: PACK_50.credits,
        amount: PACK_50.amount,
      });

      const result = await h.settle({ signature });

      assert.equal(result.duplicate, false);
      assert.equal(result.planApplied, null);
      assert.equal(result.creditsAdded, 100);
      assert.equal(h.getClaimCalls(), 1);
    } finally {
      restoreEnv("RAZORPAY_KEY_SECRET", previous);
    }
  });
});
