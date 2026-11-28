import assert from "node:assert/strict";
import crypto from "node:crypto";
import { afterEach, describe, it } from "node:test";
import { AppError } from "../types/app-error.js";
import {
  assertRazorpayCredentials,
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "./payment-settlement.services.js";

const ORDER_ID = "order_abc123def456";
const PAYMENT_ID = "pay_abc123def456";

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

describe("Razorpay credential checks", () => {
  it("names every missing credential clearly without disclosing values", () => {
    for (const name of CREDENTIAL_NAMES) delete process.env[name];
    assert.throws(
      () => assertRazorpayCredentials("order creation"),
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

  it("reports only the credentials that are still missing", () => {
    configureCredentials();
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    assert.throws(
      () => assertRazorpayCredentials("webhook processing"),
      (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.match(error.message, /RAZORPAY_WEBHOOK_SECRET must be configured/);
        assert.doesNotMatch(error.message, /RAZORPAY_KEY_ID/);
        assert.doesNotMatch(error.message, /RAZORPAY_KEY_SECRET/);
        return true;
      },
    );
    configureCredentials();
    assert.doesNotThrow(() => {
      assertRazorpayCredentials("order creation");
    });
  });
});

describe("payment HMAC verification", () => {
  it("accepts a correctly signed checkout payload", () => {
    configureCredentials();
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${ORDER_ID}|${PAYMENT_ID}`)
      .digest("hex");
    assert.doesNotThrow(() =>
      verifyCheckoutSignature(ORDER_ID, PAYMENT_ID, signature),
    );
  });

  it("rejects tampered checkout payloads and identifiers", () => {
    configureCredentials();
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
      .update(`${ORDER_ID}|${PAYMENT_ID}`)
      .digest("hex");

    assert.throws(
      () => verifyCheckoutSignature(ORDER_ID, "pay_tampered123", signature),
      /Invalid payment signature|Invalid Razorpay/,
    );
    assert.throws(
      () => verifyCheckoutSignature("../../../etc", PAYMENT_ID, signature),
      /Invalid Razorpay/,
    );
  });

  it("refuses to verify a checkout signature when a credential is absent", () => {
    configureCredentials();
    delete process.env.RAZORPAY_KEY_SECRET;
    assert.throws(
      () => verifyCheckoutSignature(ORDER_ID, PAYMENT_ID, "deadbeef"),
      /RAZORPAY_KEY_SECRET must be configured/,
    );
  });

  it("verifies webhook signatures over the raw body", () => {
    configureCredentials();
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    assert.doesNotThrow(() => verifyWebhookSignature(rawBody, signature));
    assert.throws(
      () => verifyWebhookSignature(Buffer.from('{"event":"changed"}'), signature),
      /Invalid Razorpay webhook signature/,
    );
    assert.throws(
      () => verifyWebhookSignature(rawBody, undefined),
      /Missing Razorpay webhook signature/,
    );
  });

  it("refuses to verify a webhook when the webhook secret is absent", () => {
    configureCredentials();
    delete process.env.RAZORPAY_WEBHOOK_SECRET;
    assert.throws(
      () => verifyWebhookSignature(Buffer.from("{}"), "deadbeef"),
      /RAZORPAY_WEBHOOK_SECRET must be configured/,
    );
  });

  it("verifies webhooks with only the webhook secret configured", () => {
    configureCredentials();
    delete process.env.RAZORPAY_KEY_ID;
    delete process.env.RAZORPAY_KEY_SECRET;
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
      .update(rawBody)
      .digest("hex");

    assert.doesNotThrow(() => verifyWebhookSignature(rawBody, signature));
    assert.throws(
      () => verifyCheckoutSignature(ORDER_ID, PAYMENT_ID, "deadbeef"),
      /RAZORPAY_KEY_SECRET must be configured/,
    );
  });
});
