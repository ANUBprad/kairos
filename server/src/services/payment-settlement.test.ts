import assert from "node:assert/strict";
import crypto from "node:crypto";
import { describe, it } from "node:test";
import {
  verifyCheckoutSignature,
  verifyWebhookSignature,
} from "./payment-settlement.services.js";

const ORDER_ID = "order_abc123def456";
const PAYMENT_ID = "pay_abc123def456";

describe("payment HMAC verification", () => {
  it("accepts a correctly signed checkout payload", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_checkout_secret";
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${ORDER_ID}|${PAYMENT_ID}`)
      .digest("hex");
    assert.doesNotThrow(() =>
      verifyCheckoutSignature(ORDER_ID, PAYMENT_ID, signature),
    );
  });

  it("rejects tampered checkout payloads and identifiers", () => {
    process.env.RAZORPAY_KEY_SECRET = "test_checkout_secret";
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
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

  it("verifies webhook signatures over the raw body", () => {
    process.env.RAZORPAY_WEBHOOK_SECRET = "test_webhook_secret";
    const rawBody = Buffer.from('{"event":"payment.captured"}');
    const signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    assert.doesNotThrow(() =>
      verifyWebhookSignature(rawBody, signature),
    );
    assert.throws(
      () => verifyWebhookSignature(Buffer.from('{"event":"changed"}'), signature),
      /Invalid Razorpay webhook signature/,
    );
    assert.throws(
      () => verifyWebhookSignature(rawBody, undefined),
      /Missing Razorpay webhook signature/,
    );
  });
});
