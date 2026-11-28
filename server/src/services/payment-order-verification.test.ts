import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { AppError } from "../types/app-error.js";
import {
  ALLOWED_CREDIT_AMOUNTS_INR,
  CREDIT_PACKS,
  PLAN_PRICES,
} from "../lib/pricing.js";
import {
  createOrderSchema,
  verifyPaymentSchema,
} from "../validators/payment.validator.js";
import { assertRazorpayCredentials } from "./payment-settlement.services.js";
import {
  assertCapturedInrPayment,
  createRazorpayOrder,
} from "./payment.services.js";

const ORDER_ID = "order_abc123def456";
const PAYMENT_ID = "pay_abc123def456";
const AMOUNT_PAISE = CREDIT_PACKS[0].amountInr * 100;

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

afterEach(restoreEnv);

describe("client-supplied pricing input", () => {
  it("accepts only current server-owned pack amounts", () => {
    for (const amountInr of ALLOWED_CREDIT_AMOUNTS_INR) {
      assert.equal(createOrderSchema.safeParse({ amountInr }).success, true);
    }
    for (const amountInr of [50, 100, 250, 500, 1, -99, 123, 50.5]) {
      // Old prices are no longer valid for NEW orders.
      assert.equal(createOrderSchema.safeParse({ amountInr }).success, false);
    }
  });

  it("rejects client-supplied credits, paise amounts and prices", () => {
    assert.equal(
      createOrderSchema.safeParse({
        amountInr: CREDIT_PACKS[0].amountInr,
        credits: 999999,
      }).success,
      false,
    );
    assert.equal(
      createOrderSchema.safeParse({
        amountInr: CREDIT_PACKS[0].amountInr,
        amountPaise: 1,
        pricePaise: 1,
      }).success,
      false,
    );
    // A plan key is priced from PLAN_PRICES; a client amount is tolerated but
    // never authoritative, and client credit awards are still rejected.
    assert.equal(
      createOrderSchema.safeParse({
        plan: "PRO",
        amountInr: CREDIT_PACKS[0].amountInr,
      }).success,
      true,
    );
    assert.equal(
      createOrderSchema.safeParse({ plan: "PRO", credits: 999999 }).success,
      false,
    );
    assert.equal(
      createOrderSchema.safeParse({
        plan: "FREE",
        pricePaise: PLAN_PRICES.PRO.pricePaise,
      }).success,
      false,
    );
  });

  it("does not accept amount, currency or credits at verification time", () => {
    const valid = {
      razorpay_order_id: ORDER_ID,
      razorpay_payment_id: PAYMENT_ID,
      razorpay_signature: "a".repeat(64),
    };
    assert.equal(verifyPaymentSchema.safeParse(valid).success, true);
    assert.equal(
      verifyPaymentSchema.safeParse({ ...valid, amount: 1, credits: 999999 }).success,
      false,
    );
  });
});

describe("provider-observed payment validation", () => {
  const captured = {
    id: PAYMENT_ID,
    order_id: ORDER_ID,
    status: "captured",
    currency: "INR",
    amount: String(AMOUNT_PAISE),
  } as const;

  it("accepts a captured INR payment for the expected order and amount", () => {
    assert.doesNotThrow(() =>
      assertCapturedInrPayment({
        payment: captured,
        orderId: ORDER_ID,
        paymentId: PAYMENT_ID,
        amountPaise: AMOUNT_PAISE,
      }),
    );
  });

  it("rejects a frontend-only success when the provider has not captured it", () => {
    assert.throws(
      () =>
        assertCapturedInrPayment({
          payment: { ...captured, status: "authorized" },
          orderId: ORDER_ID,
          paymentId: PAYMENT_ID,
          amountPaise: AMOUNT_PAISE,
        }),
      /Payment is not captured/,
    );
  });

  it("rejects wrong ownership, currency and amount", () => {
    const base = {
      orderId: ORDER_ID,
      paymentId: PAYMENT_ID,
      amountPaise: AMOUNT_PAISE,
    };
    assert.throws(
      () =>
        assertCapturedInrPayment({
          ...base,
          payment: { ...captured, order_id: "order_other123" },
        }),
      /does not match the requested order/,
    );
    assert.throws(
      () =>
        assertCapturedInrPayment({
          ...base,
          payment: { ...captured, id: "pay_other1234" },
        }),
      /does not match the requested order/,
    );
    assert.throws(
      () =>
        assertCapturedInrPayment({
          ...base,
          payment: { ...captured, currency: "USD" },
        }),
      /Unexpected payment currency/,
    );
    assert.throws(
      () =>
        assertCapturedInrPayment({
          ...base,
          payment: { ...captured, amount: AMOUNT_PAISE + 1 },
        }),
      /amount does not match/,
    );
  });
});

describe("missing credentials at payment-operation time", () => {
  it("fails order creation clearly before any database or provider work", async () => {
    for (const name of CREDENTIAL_NAMES) delete process.env[name];
    await assert.rejects(
      createRazorpayOrder("user_missing_credentials"),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.statusCode, 500);
        for (const name of CREDENTIAL_NAMES) {
          assert.match(error.message, new RegExp(name));
        }
        return true;
      },
    );
  });

  it("allows the credential gate to pass when all three names are present", () => {
    configureCredentials();
    assert.doesNotThrow(() => {
      assertRazorpayCredentials("order creation");
    });
  });
});
