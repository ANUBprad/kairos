import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import type { Prisma } from "../generated/prisma/client.js";
import { AppError } from "../types/app-error.js";
import {
  CREDIT_PACKS,
  HISTORICAL_CREDIT_PACK_PRICES,
  HISTORICAL_PLAN_PRICES,
  PLAN_PRICES,
} from "../lib/pricing.js";
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

const STARTER_PACK = CREDIT_PACKS[0];
const PACK_STARTER = {
  amount: STARTER_PACK.amountInr * 100,
  credits: STARTER_PACK.credits,
} as const;
const PRO_PRICE = {
  amount: PLAN_PRICES.PRO.pricePaise,
  credits: PLAN_PRICES.PRO.credits,
} as const;
const PRO_PLUS_PRICE = {
  amount: PLAN_PRICES.PRO_PLUS.pricePaise,
  credits: PLAN_PRICES.PRO_PLUS.credits,
} as const;
const LEGACY_PACK = {
  amount: HISTORICAL_CREDIT_PACK_PRICES[0].amountInr * 100,
  credits: HISTORICAL_CREDIT_PACK_PRICES[0].credits,
} as const;
const LEGACY_PRO = {
  amount: HISTORICAL_PLAN_PRICES.PRO.pricePaise,
  credits: HISTORICAL_PLAN_PRICES.PRO.credits,
} as const;
const LEGACY_PRO_PLUS = {
  amount: HISTORICAL_PLAN_PRICES.PRO_PLUS.pricePaise,
  credits: HISTORICAL_PLAN_PRICES.PRO_PLUS.credits,
} as const;

const CREDENTIAL_NAMES = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "RAZORPAY_WEBHOOK_SECRET",
] as const;
const ORIGINAL_ENV = new Map(
  CREDENTIAL_NAMES.map((name) => [name, process.env[name]]),
);

function restoreEnv(): void {
  for (const name of CREDENTIAL_NAMES) {
    const previous = ORIGINAL_ENV.get(name);
    if (previous === undefined) delete process.env[name];
    else process.env[name] = previous;
  }
}

function configureCredentials(): void {
  process.env.RAZORPAY_KEY_ID = "rzp_test_unit_mock_only";
  process.env.RAZORPAY_KEY_SECRET = "test_checkout_secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
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
    amount: seed.amount ?? PACK_STARTER.amount,
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
      amountPaise: LEGACY_PACK.amount,
      currency: "INR",
    });
  });

  it("classifies a null-plan credit pack with exact server-owned credits", () => {
    const result = classifyPaymentOrder({
      plan: null,
      creditsPurchased: PACK_STARTER.credits,
      amountPaise: PACK_STARTER.amount,
      currency: "INR",
    });
    assert.deepEqual(result, {
      kind: "credit_pack",
      plan: null,
      creditsPurchased: PACK_STARTER.credits,
      amountPaise: PACK_STARTER.amount,
      currency: "INR",
    });
  });

  it("rejects credit packs whose credits or amount are not server-owned", () => {
    assertClassificationRejected({
      plan: null,
      creditsPurchased: PACK_STARTER.credits - 1,
      amountPaise: PACK_STARTER.amount,
      currency: "INR",
    });
    assertClassificationRejected({
      plan: null,
      creditsPurchased: PACK_STARTER.credits,
      amountPaise: 12345,
      currency: "INR",
    });
    // New orders cannot use an old price, even with the old credit award.
    assertClassificationRejected({
      plan: null,
      creditsPurchased: PACK_STARTER.credits,
      amountPaise: LEGACY_PACK.amount + 1,
      currency: "INR",
    });
  });

  it("classifies exact current plan prices", () => {
    for (const [plan, price] of [
      ["PRO", PRO_PRICE],
      ["PRO_PLUS", PRO_PLUS_PRICE],
    ] as const) {
      assert.deepEqual(
        classifyPaymentOrder({
          plan,
          creditsPurchased: price.credits,
          amountPaise: price.amount,
          currency: "INR",
        }),
        {
          kind: "subscription",
          plan,
          creditsPurchased: price.credits,
          amountPaise: price.amount,
          currency: "INR",
        },
      );
    }
  });

  it("classifies historical plan prices without rewriting their amount or credits", () => {
    for (const [plan, price] of [
      ["PRO", LEGACY_PRO],
      ["PRO_PLUS", LEGACY_PRO_PLUS],
    ] as const) {
      assert.deepEqual(
        classifyPaymentOrder({
          plan,
          creditsPurchased: price.credits,
          amountPaise: price.amount,
          currency: "INR",
        }),
        {
          kind: "subscription",
          plan,
          creditsPurchased: price.credits,
          amountPaise: price.amount,
          currency: "INR",
        },
      );
    }
  });

  it("classifies historical credit-pack amounts with their original credits", () => {
    for (const pack of HISTORICAL_CREDIT_PACK_PRICES) {
      assert.deepEqual(
        classifyPaymentOrder({
          plan: null,
          creditsPurchased: pack.credits,
          amountPaise: pack.amountInr * 100,
          currency: "INR",
        }),
        {
          kind: "credit_pack",
          plan: null,
          creditsPurchased: pack.credits,
          amountPaise: pack.amountInr * 100,
          currency: "INR",
        },
      );
    }
  });

  it("rejects subscriptions with the wrong amount or the wrong credits", () => {
    assertClassificationRejected({
      plan: "PRO",
      creditsPurchased: PRO_PRICE.credits,
      amountPaise: PRO_PRICE.amount + 100,
      currency: "INR",
    });
    assertClassificationRejected({
      plan: "PRO_PLUS",
      creditsPurchased: PRO_PLUS_PRICE.credits - 1,
      amountPaise: PRO_PLUS_PRICE.amount,
      currency: "INR",
    });
  });

  it("rejects FREE, zero-credit subscriptions, invalid currency and invalid amounts", () => {
    const invalid: PaymentOrderFacts[] = [
      { plan: "FREE", creditsPurchased: PRO_PRICE.credits, amountPaise: PRO_PRICE.amount, currency: "INR" },
      { plan: "PRO", creditsPurchased: 0, amountPaise: PRO_PRICE.amount, currency: "INR" },
      { plan: null, creditsPurchased: PACK_STARTER.credits, amountPaise: PACK_STARTER.amount, currency: "USD" },
      { plan: null, creditsPurchased: PACK_STARTER.credits, amountPaise: 0, currency: "INR" },
      { plan: null, creditsPurchased: PACK_STARTER.credits, amountPaise: PACK_STARTER.amount + 1, currency: "INR" },
      { plan: null, creditsPurchased: 0, amountPaise: PACK_STARTER.amount, currency: "INR" },
      // Historical plan amounts are never credit packs.
      { plan: null, creditsPurchased: LEGACY_PRO.credits, amountPaise: LEGACY_PRO.amount, currency: "INR" },
      { plan: null, creditsPurchased: LEGACY_PRO_PLUS.credits, amountPaise: LEGACY_PRO_PLUS.amount, currency: "INR" },
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
      amount: LEGACY_PACK.amount,
      status: "PENDING",
    });

    await assertAmbiguous(h.settle());

    assert.equal(h.getClaimCalls(), 0);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
    assert.equal(h.getUserPlan(), "FREE");
  });

  it("fails closed for an ambiguous legacy SUCCESS row instead of reporting plan access as applied", async () => {
    const h = harness({
      plan: "PRO",
      credits: 0,
      amount: LEGACY_PACK.amount,
      status: "SUCCESS",
      existingPaymentId: PAYMENT_ID,
    });

    await assertAmbiguous(h.settle());

    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
    assert.equal(h.getUserPlan(), "FREE");
  });

  it("grants only credits and reports no plan for a new credit pack", async () => {
    const h = harness({
      plan: null,
      credits: PACK_STARTER.credits,
      amount: PACK_STARTER.amount,
      status: "PENDING",
    });

    const result = await h.settle();

    assert.equal(result.duplicate, false);
    assert.equal(result.planApplied, null);
    assert.equal(result.creditsAdded, PACK_STARTER.credits);
    assert.equal(result.credits, PACK_STARTER.credits);
    assert.equal(h.getUserPlan(), "FREE");
    assert.equal(h.getPlanExpiresAt(), null);
    assert.equal(h.getUserUpdates().length, 1);
    assert.equal(h.getCreditCreates().length, 1);
    assert.equal(h.getCreditCreates()[0]!.idempotencyKey, "payment-credit:payment-row-1");
    assert.equal(h.getCreditCreates()[0]!.amount, PACK_STARTER.credits);
    assert.match(result.message, /one-time credit pack/i);
  });

  it("preserves a historical pending credit-pack order with its original amount and credits", async () => {
    const h = harness({
      plan: null,
      credits: LEGACY_PACK.credits,
      amount: LEGACY_PACK.amount,
      status: "PENDING",
      startingCredits: 10,
    });

    const result = await h.settle();

    assert.equal(result.duplicate, false);
    assert.equal(result.planApplied, null);
    assert.equal(result.creditsAdded, LEGACY_PACK.credits);
    assert.equal(result.credits, 10 + LEGACY_PACK.credits);
    assert.equal(h.row.amount, LEGACY_PACK.amount);
    assert.equal(h.row.creditsPurchased, LEGACY_PACK.credits);
    assert.equal(h.getUserPlan(), "FREE");
    assert.equal(h.getPlanExpiresAt(), null);
  });

  it("rejects a credit pack with incorrect credits without writing anything", async () => {
    const h = harness({
      plan: null,
      credits: PACK_STARTER.credits - 1,
      amount: PACK_STARTER.amount,
    });

    await assertAmbiguous(h.settle());

    assert.equal(h.getClaimCalls(), 0);
    assert.equal(h.getUserUpdates().length, 0);
    assert.equal(h.getCreditCreates().length, 0);
  });

  it("applies the exact current plan with explicit one-time 30-day access", async () => {
    for (const [plan, price] of [
      ["PRO", PRO_PRICE],
      ["PRO_PLUS", PRO_PLUS_PRICE],
    ] as const) {
      const h = harness({
        plan,
        credits: price.credits,
        amount: price.amount,
        status: "PENDING",
      });

      const result = await h.settle();

      assert.equal(result.duplicate, false);
      assert.equal(result.planApplied, plan);
      assert.equal(result.creditsAdded, price.credits);
      assert.equal(h.getUserPlan(), plan);
      assert.ok(h.getPlanExpiresAt() instanceof Date);
      assert.equal(h.getUserUpdates().length, 2);
      assert.equal(h.getUserUpdates()[1]!.plan, plan);
      assert.equal(h.getCreditCreates().length, 1);
      assert.match(result.message, /One-time 30-day access/i);
      assert.match(result.message, /no recurring billing/i);
    }
  });

  it("settles a historical pending plan order with its original price and credits", async () => {
    for (const [plan, price] of [
      ["PRO", LEGACY_PRO],
      ["PRO_PLUS", LEGACY_PRO_PLUS],
    ] as const) {
      const h = harness({
        plan,
        credits: price.credits,
        amount: price.amount,
        status: "PENDING",
      });

      const result = await h.settle();

      assert.equal(result.duplicate, false);
      assert.equal(result.planApplied, plan);
      assert.equal(result.creditsAdded, price.credits);
      assert.equal(h.row.amount, price.amount);
      assert.equal(h.row.creditsPurchased, price.credits);
      assert.equal(h.getUserPlan(), plan);
      assert.ok(h.getPlanExpiresAt() instanceof Date);
    }
  });

  it("rejects subscriptions with wrong amount or credits before any write", async () => {
    const wrongAmount = harness({
      plan: "PRO",
      credits: PRO_PRICE.credits,
      amount: PRO_PRICE.amount + 100,
    });
    await assertAmbiguous(wrongAmount.settle());

    const wrongCredits = harness({
      plan: "PRO_PLUS",
      credits: PRO_PLUS_PRICE.credits - 1,
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
      credits: PACK_STARTER.credits,
      amount: PACK_STARTER.amount,
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

  it("returns a duplicate historical plan settlement without re-granting", async () => {
    const h = harness({
      plan: "PRO",
      credits: LEGACY_PRO.credits,
      amount: LEGACY_PRO.amount,
      status: "SUCCESS",
      existingPaymentId: PAYMENT_ID,
      startingCredits: 25,
    });

    const result = await h.settle();

    assert.equal(result.duplicate, true);
    assert.equal(result.planApplied, "PRO");
    assert.equal(result.creditsAdded, 0);
    assert.equal(result.credits, 25);
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
      credits: PACK_STARTER.credits,
      amount: PACK_STARTER.amount,
      status: "PENDING",
    });

    const first = await h.settle();
    assert.equal(first.duplicate, false);
    assert.equal(first.creditsAdded, PACK_STARTER.credits);

    const second = await h.settle();
    assert.equal(second.duplicate, true);
    assert.equal(second.planApplied, null);
    assert.equal(second.creditsAdded, 0);
    assert.equal(second.credits, PACK_STARTER.credits);
    assert.equal(h.getClaimCalls(), 1);
    assert.equal(h.getUserUpdates().length, 1);
    assert.equal(h.getCreditCreates().length, 1);
  });

  it("treats a lost claim race as a duplicate without re-granting credits", async () => {
    const h = harness({
      plan: null,
      credits: PACK_STARTER.credits,
      amount: PACK_STARTER.amount,
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
      credits: PACK_STARTER.credits,
      amount: PACK_STARTER.amount,
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

  it("does not mutate a balance or plan for a FAILED payment", async () => {
    const h = harness({
      plan: "PRO",
      credits: PRO_PRICE.credits,
      amount: PRO_PRICE.amount,
      status: "FAILED",
      startingCredits: 50,
    });

    await assert.rejects(h.settle(), /no longer payable/);

    assert.equal(h.getCredits(), 50);
    assert.equal(h.getUserPlan(), "FREE");
    assert.equal(h.getPlanExpiresAt(), null);
    assert.equal(h.getClaimCalls(), 0);
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
      { currency: "USD", amount: PACK_STARTER.amount, credits: PACK_STARTER.credits },
      { currency: "INR", amount: 0, credits: PACK_STARTER.credits },
      { currency: "INR", amount: PACK_STARTER.amount + 0.5, credits: PACK_STARTER.credits },
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
    configureCredentials();
    try {
      const h = harness({
        plan: null,
        credits: PACK_STARTER.credits,
        amount: PACK_STARTER.amount,
        startingCredits: 75,
      });

      await assert.rejects(h.settle({ signature: "deadbeef" }), /Invalid payment signature/);

      assert.equal(h.getCredits(), 75);
      assert.equal(h.getClaimCalls(), 0);
      assert.equal(h.getUserUpdates().length, 0);
      assert.equal(h.getCreditCreates().length, 0);
    } finally {
      restoreEnv();
    }
  });

  it("still settles a validly signed checkout order", async () => {
    configureCredentials();
    try {
      const signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
        .update(`${ORDER_ID}|${PAYMENT_ID}`)
        .digest("hex");
      const h = harness({
        plan: null,
        credits: PACK_STARTER.credits,
        amount: PACK_STARTER.amount,
      });

      const result = await h.settle({ signature });

      assert.equal(result.duplicate, false);
      assert.equal(result.planApplied, null);
      assert.equal(result.creditsAdded, PACK_STARTER.credits);
      assert.equal(h.getClaimCalls(), 1);
    } finally {
      restoreEnv();
    }
  });
});
