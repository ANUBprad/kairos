import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";

/**
 * Provider-mocked payment lifecycle tests against real PostgreSQL.
 *
 * LIVE SANDBOX VALIDATION IS NOT PERFORMED HERE: no Razorpay test-mode
 * credentials were supplied. These tests exercise the real service, HMAC
 * verification, HTTP-independent webhook processing, and database invariants
 * with a deterministic injected provider. No network call or real money is
 * involved, and only the disposable TEST_DATABASE_URL is written.
 */
describe("payment sandbox (provider-mocked integration)", () => {
    if (!process.env.TEST_DATABASE_URL) {
        it("requires TEST_DATABASE_URL", { skip: "TEST_DATABASE_URL not set" }, () => {});
        return;
    }

    const testUrl = process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL = testUrl;
    process.env.NODE_ENV = "test";
    delete process.env.DEPLOYMENT_ENV;
    process.env.RAZORPAY_KEY_ID = "rzp_test_localmockonly000";
    process.env.RAZORPAY_KEY_SECRET = "test-key-secret-not-real-0001";
    process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret-not-real";

    const pool = new Pool({ connectionString: testUrl });
    const db = new PrismaClient({ adapter: new PrismaPg(pool) });
    const userIds: string[] = [];
    let restoreProvider: (() => void) | undefined;

    async function createUser(credits = 0) {
        const id = `paytest-${randomUUID()}`;
        userIds.push(id);
        await db.user.create({
            data: {
                id,
                name: "Payment test user",
                email: `${id}@example.test`,
                credits,
            },
        });
        return id;
    }

    function orderId() {
        return `order_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
    }

    function paymentId() {
        return `pay_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
    }

    function checkoutSignature(id: string, pay: string) {
        return createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
            .update(`${id}|${pay}`)
            .digest("hex");
    }

    function webhookBody(
        id: string,
        pay: string,
        overrides: Record<string, unknown> = {},
    ) {
        return Buffer.from(
            JSON.stringify({
                event: "payment.captured",
                payload: {
                    payment: {
                        entity: { id: pay, order_id: id, status: "captured", currency: "INR", ...overrides },
                    },
                },
            }),
        );
    }

    function webhookSignature(body: Buffer) {
        return createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!)
            .update(body)
            .digest("hex");
    }

    async function createPendingRecord(input: {
        userId: string;
        order: string;
        plan?: "PRO" | "PRO_PLUS" | null;
        credits: number;
        amountPaise: number;
        currency?: string;
        status?: "PENDING" | "SUCCESS" | "FAILED";
    }) {
        await db.paymentRecord.create({
            data: {
                userId: input.userId,
                plan: input.plan ?? null,
                creditsPurchased: input.credits,
                razorpayOrderId: input.order,
                amount: input.amountPaise,
                currency: input.currency ?? "INR",
                status: input.status ?? "PENDING",
            },
        });
    }

    after(async () => {
        restoreProvider?.();
        if (userIds.length) {
            await db.user.deleteMany({ where: { id: { in: userIds } } });
        }
        await db.$disconnect();
        await pool.end();
    });

    it("creates a credit-pack order with server-owned pricing and settles it exactly once", async () => {
        const payments = await import("../services/payment.services.js");
        const calls: Array<{ amount: number; notes: Record<string, string> }> = [];
        payments.setPaymentProviderForTests({
            createOrder: async (input) => {
                calls.push({ amount: input.amount, notes: input.notes });
                return { id: orderId(), amount: input.amount, currency: "INR" };
            },
        });
        restoreProvider = () => payments.setPaymentProviderForTests(undefined);
        const userId = await createUser();

        // Client asks for a smaller amount; the server must use the pack price.
        const order = await payments.createRazorpayOrder(userId, { amountInr: 50 });
        assert.equal(order.amount, 5000);
        assert.equal(order.credits, 100);
        assert.equal(calls[0].amount, 5000);

        const pay = paymentId();
        const first = await payments.verifyRazorpayPayment(userId, {
            razorpay_order_id: order.orderId,
            razorpay_payment_id: pay,
            razorpay_signature: checkoutSignature(order.orderId, pay),
        });
        assert.equal(first.duplicate, false);
        assert.equal(first.creditsAdded, 100);

        const repeated = await payments.verifyRazorpayPayment(userId, {
            razorpay_order_id: order.orderId,
            razorpay_payment_id: pay,
            razorpay_signature: checkoutSignature(order.orderId, pay),
        });
        assert.equal(repeated.duplicate, true);
        assert.equal(repeated.creditsAdded, 0);

        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.credits, 100);
        assert.equal(user.plan, "FREE");
        assert.equal(
            await db.creditTransaction.count({
                where: { userId, idempotencyKey: `payment-credit:${(await db.paymentRecord.findUniqueOrThrow({ where: { razorpayOrderId: order.orderId } })).id}` },
            }),
            1,
        );
        assert.equal(
            (await db.paymentRecord.findUniqueOrThrow({ where: { razorpayOrderId: order.orderId } })).status,
            "SUCCESS",
        );
    });

    it("creates a subscription order from the plan price, ignoring client amount overrides", async () => {
        const payments = await import("../services/payment.services.js");
        const calls: number[] = [];
        payments.setPaymentProviderForTests({
            createOrder: async (input) => {
                calls.push(input.amount);
                return { id: orderId(), amount: input.amount, currency: "INR" };
            },
        });
        const userId = await createUser();

        const order = await payments.createRazorpayOrder(userId, {
            plan: "PRO",
            amountInr: 50,
        } as never);
        assert.equal(calls[0], 19900);
        assert.equal(order.plan, "PRO");
        assert.equal(order.credits, 500);

        const pay = paymentId();
        await payments.verifyRazorpayPayment(userId, {
            razorpay_order_id: order.orderId,
            razorpay_payment_id: pay,
            razorpay_signature: checkoutSignature(order.orderId, pay),
        });
        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.plan, "PRO");
        assert.ok(user.planExpiresAt && user.planExpiresAt > new Date());
        assert.equal(user.credits, 500);
    });

    it("rejects invalid amounts, quantities and plans before contacting the provider", async () => {
        const payments = await import("../services/payment.services.js");
        const { createOrderSchema } = await import("../validators/payment.validator.js");
        const userId = await createUser();

        assert.equal(createOrderSchema.safeParse({ amountInr: 1 }).success, false);
        assert.equal(createOrderSchema.safeParse({ amountInr: 123 }).success, false);
        await assert.rejects(
            payments.createRazorpayOrder(userId, { amountInr: 1 }),
            /Unsupported top-up amount/,
        );
        await assert.rejects(
            payments.createRazorpayOrder(userId, { plan: "ENTERPRISE" } as never),
            /Unsupported subscription plan/,
        );
        assert.equal(await db.paymentRecord.count({ where: { userId } }), 0);
    });

    it("rejects tampered order ids, wrong users and forged signatures", async () => {
        const { verifyCheckoutSignature, settleCapturedPayment } =
            await import("../services/payment-settlement.services.js");
        const owner = await createUser();
        const attacker = await createUser();
        const id = orderId();
        const pay = paymentId();
        await createPendingRecord({
            userId: owner,
            order: id,
            credits: 100,
            amountPaise: 5000,
        });

        await assert.rejects(
            settleCapturedPayment({ userId: owner, orderId: orderId(), paymentId: pay }),
            /not found/,
        );
        await assert.rejects(
            settleCapturedPayment({ userId: attacker, orderId: id, paymentId: pay }),
            /not found/,
        );
        assert.throws(
            () => verifyCheckoutSignature(id, pay, "0".repeat(64)),
            /Invalid payment signature/,
        );

        const record = await db.paymentRecord.findUniqueOrThrow({
            where: { razorpayOrderId: id },
        });
        assert.equal(record.status, "PENDING");
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner } })).credits, 0);
    });

    it("rejects invalid and malformed webhooks without granting value", async () => {
        const payments = await import("../services/payment.services.js");
        const id = orderId();
        const pay = paymentId();
        const userId = await createUser();
        await createPendingRecord({ userId, order: id, credits: 100, amountPaise: 5000 });

        const body = webhookBody(id, pay);
        await assert.rejects(
            payments.processRazorpayWebhook(body, "deadbeef"),
            /Invalid Razorpay webhook signature/,
        );
        await assert.rejects(
            payments.processRazorpayWebhook(body, undefined),
            /Missing Razorpay webhook signature/,
        );

        const malformed = Buffer.from("{not json");
        await assert.rejects(
            payments.processRazorpayWebhook(malformed, webhookSignature(malformed)),
            /Invalid Razorpay webhook payload/,
        );

        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.credits, 0);
        assert.equal(
            (await db.paymentRecord.findUniqueOrThrow({ where: { razorpayOrderId: id } })).status,
            "PENDING",
        );
    });

    it("ignores cancelled/failed payments and unknown orders", async () => {
        const payments = await import("../services/payment.services.js");
        const userId = await createUser();
        const id = orderId();
        const pay = paymentId();
        await createPendingRecord({ userId, order: id, credits: 100, amountPaise: 5000 });

        const failed = webhookBody(id, pay, { status: "failed" });
        const result = await payments.processRazorpayWebhook(
            failed,
            webhookSignature(failed),
        );
        assert.deepEqual(result, { handled: false, reason: "ignored_event" });

        const unknown = webhookBody(orderId(), paymentId());
        const unknownResult = await payments.processRazorpayWebhook(
            unknown,
            webhookSignature(unknown),
        );
        assert.deepEqual(unknownResult, { handled: false, reason: "unknown_order" });
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).credits, 0);
    });

    it("settles concurrent duplicate webhook deliveries exactly once", async () => {
        const payments = await import("../services/payment.services.js");
        const userId = await createUser();
        const id = orderId();
        const pay = paymentId();
        await createPendingRecord({ userId, order: id, credits: 100, amountPaise: 5000 });

        const body = webhookBody(id, pay);
        const signature = webhookSignature(body);
        const results = await Promise.all([
            payments.processRazorpayWebhook(body, signature),
            payments.processRazorpayWebhook(body, signature),
        ]);
        assert.equal(results.filter((r) => r.duplicate === false).length, 1);
        assert.equal(results.filter((r) => r.duplicate === true).length, 1);
        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.credits, 100);
        assert.equal(await db.creditTransaction.count({ where: { userId, type: "PURCHASE" } }), 1);
    });

    it("handles webhook-before-verification and verification-before-webhook idempotently", async () => {
        const payments = await import("../services/payment.services.js");
        for (const webhookFirst of [true, false]) {
            const userId = await createUser();
            const id = orderId();
            const pay = paymentId();
            await createPendingRecord({ userId, order: id, credits: 100, amountPaise: 5000 });
            const body = webhookBody(id, pay);
            const signature = webhookSignature(body);
            const verify = () =>
                payments.verifyRazorpayPayment(userId, {
                    razorpay_order_id: id,
                    razorpay_payment_id: pay,
                    razorpay_signature: checkoutSignature(id, pay),
                });
            const hook = () => payments.processRazorpayWebhook(body, signature);

            if (webhookFirst) {
                assert.equal((await hook()).duplicate, false);
                assert.equal((await verify()).duplicate, true);
            } else {
                assert.equal((await verify()).duplicate, false);
                assert.equal((await hook()).duplicate, true);
            }
            assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).credits, 100);
            assert.equal(await db.creditTransaction.count({ where: { userId, type: "PURCHASE" } }), 1);
        }
    });

    it("fails closed for ambiguous legacy records and never grants a plan or credits", async () => {
        const { settleCapturedPayment } = await import("../services/payment-settlement.services.js");
        const userId = await createUser();
        const id = orderId();
        // Legacy shape: PRO plan with a credit-pack amount is ambiguous.
        await createPendingRecord({ userId, order: id, plan: "PRO", credits: 0, amountPaise: 5000 });

        await assert.rejects(
            settleCapturedPayment({ userId, orderId: id, paymentId: paymentId() }),
            /ambiguous legacy entitlement/,
        );
        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.plan, "FREE");
        assert.equal(user.credits, 0);
        assert.equal(
            (await db.paymentRecord.findUniqueOrThrow({ where: { razorpayOrderId: id } })).status,
            "PENDING",
        );
    });

    it("reports provider failures without creating a payment record", async () => {
        const payments = await import("../services/payment.services.js");
        payments.setPaymentProviderForTests({
            createOrder: async () => {
                throw new Error("provider unavailable");
            },
        });
        const userId = await createUser();
        await assert.rejects(
            payments.createRazorpayOrder(userId, { amountInr: 50 }),
            /Failed to create payment order/,
        );
        assert.equal(await db.paymentRecord.count({ where: { userId } }), 0);
        payments.setPaymentProviderForTests(undefined);
    });

    it("refunds only the matching eligible debit, once, to the correct user", async () => {
        const { refundCreditCharge } = await import("../services/credit.services.js");
        const owner = await createUser(100);
        const other = await createUser(100);
        const chargeKey = `jr-charge-${randomUUID()}`;
        const refundKey = `jr-refund-${randomUUID()}`;
        await db.creditTransaction.create({
            data: {
                userId: owner,
                amount: -10,
                balanceAfter: 90,
                type: "ARTIFACT_GENERATE",
                description: "refund test charge",
                idempotencyKey: chargeKey,
            },
        });
        await db.user.update({ where: { id: owner }, data: { credits: 90 } });

        // Wrong user cannot refund someone else's debit.
        assert.equal(
            await refundCreditCharge({
                chargeIdempotencyKey: chargeKey,
                refundIdempotencyKey: refundKey,
                expectedUserId: other,
                reason: "wrong owner",
            }),
            false,
        );
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: other } })).credits, 100);

        assert.equal(
            await refundCreditCharge({
                chargeIdempotencyKey: chargeKey,
                refundIdempotencyKey: refundKey,
                expectedUserId: owner,
                reason: "terminal failure",
            }),
            true,
        );
        assert.equal(
            await refundCreditCharge({
                chargeIdempotencyKey: chargeKey,
                refundIdempotencyKey: refundKey,
                expectedUserId: owner,
                reason: "duplicate request",
            }),
            true,
        );
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: owner } })).credits, 100);
        assert.equal(await db.creditTransaction.count({ where: { idempotencyKey: refundKey } }), 1);
        assert.equal(
            await db.creditTransaction.count({ where: { userId: owner, type: "REFUND" } }),
            1,
        );
    });
});
