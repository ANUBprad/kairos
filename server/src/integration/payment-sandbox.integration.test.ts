import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, describe, it } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/prisma/client.js";
import {
  CREDIT_PACKS,
  HISTORICAL_CREDIT_PACK_PRICES,
  HISTORICAL_PLAN_PRICES,
  PLAN_PRICES,
} from "../lib/pricing.js";

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

    const STARTER = CREDIT_PACKS[0];
    const PRO = PLAN_PRICES.PRO;
    const LEGACY_STARTER = HISTORICAL_CREDIT_PACK_PRICES[0];
    const LEGACY_PRO = HISTORICAL_PLAN_PRICES.PRO;
    const STARTER_PAISE = STARTER.amountInr * 100;
    const LEGACY_STARTER_PAISE = LEGACY_STARTER.amountInr * 100;

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

    function capturedPayment(
        id: string,
        pay: string,
        overrides: Record<string, unknown> = {},
    ) {
        return {
            id: pay,
            order_id: id,
            status: "captured",
            currency: "INR",
            amount: String(STARTER_PAISE),
            ...overrides,
        };
    }

    /** Installs a deterministic provider whose fetch mirrors the created order. */
    async function installProvider(
        onCreate?: (input: { amount: number; notes: Record<string, string> }) => void,
    ) {
        let lastOrder: { id: string; amount: number } | undefined;
        const paymentsModule = await import("../services/payment.services.js");
        paymentsModule.setPaymentProviderForTests({
            createOrder: async (input) => {
                const id = orderId();
                lastOrder = { id, amount: input.amount };
                onCreate?.({ amount: input.amount, notes: input.notes });
                return { id, amount: input.amount, currency: "INR" };
            },
            fetchPayment: async (pay) => {
                if (!lastOrder) throw new Error("provider has no created order");
                return capturedPayment(lastOrder.id, pay, {
                    amount: String(lastOrder.amount),
                });
            },
        });
        restoreProvider = () => paymentsModule.setPaymentProviderForTests(undefined);
        return paymentsModule;
    }

    /** Provider facts for a manually created pending order, with no real calls. */
    async function installCapturedProviderForOrder(
        id: string,
        amountPaise: number = STARTER_PAISE,
    ) {
        const paymentsModule = await import("../services/payment.services.js");
        paymentsModule.setPaymentProviderForTests({
            createOrder: async (input) => ({
                id,
                amount: input.amount,
                currency: "INR",
            }),
            fetchPayment: async (pay) =>
                capturedPayment(id, pay, { amount: String(amountPaise) }),
        });
        restoreProvider = () => paymentsModule.setPaymentProviderForTests(undefined);
        return paymentsModule;
    }

    async function importSettlement() {
        return await import("../services/payment-settlement.services.js");
    }

    function webhookBody(
        id: string,
        pay: string,
        overrides: Record<string, unknown> = {},
        amountPaise: number = STARTER_PAISE,
    ) {
        return Buffer.from(
            JSON.stringify({
                event: "payment.captured",
                payload: {
                    payment: {
                        entity: {
                            id: pay,
                            order_id: id,
                            status: "captured",
                            currency: "INR",
                            amount: String(amountPaise),
                            ...overrides,
                        },
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
        const calls: Array<{ amount: number; notes: Record<string, string> }> = [];
        const payments = await installProvider((input) => calls.push(input));
        const userId = await createUser();

        const order = await payments.createRazorpayOrder(userId, {
            amountInr: STARTER.amountInr,
        });
        assert.equal(order.amount, STARTER_PAISE);
        assert.equal(order.credits, STARTER.credits);
        assert.equal(calls[0].amount, STARTER_PAISE);
        assert.equal(order.keyId, process.env.RAZORPAY_KEY_ID);
        // Only the public key ID may reach the frontend.
        const serialized = JSON.stringify(order);
        assert.equal(serialized.includes(process.env.RAZORPAY_KEY_SECRET!), false);
        assert.equal(serialized.includes(process.env.RAZORPAY_WEBHOOK_SECRET!), false);

        const pay = paymentId();
        const first = await payments.verifyRazorpayPayment(userId, {
            razorpay_order_id: order.orderId,
            razorpay_payment_id: pay,
            razorpay_signature: checkoutSignature(order.orderId, pay),
        });
        assert.equal(first.duplicate, false);
        assert.equal(first.creditsAdded, STARTER.credits);

        const repeated = await payments.verifyRazorpayPayment(userId, {
            razorpay_order_id: order.orderId,
            razorpay_payment_id: pay,
            razorpay_signature: checkoutSignature(order.orderId, pay),
        });
        assert.equal(repeated.duplicate, true);
        assert.equal(repeated.creditsAdded, 0);

        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.credits, STARTER.credits);
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

    it("creates a one-time plan order from the plan price, ignoring client amount overrides", async () => {
        const calls: number[] = [];
        const payments = await installProvider((input) => calls.push(input.amount));
        const userId = await createUser();

        const order = await payments.createRazorpayOrder(userId, {
            plan: "PRO",
            amountInr: STARTER.amountInr,
        } as never);
        assert.equal(calls[0], PRO.pricePaise);
        assert.equal(order.plan, "PRO");
        assert.equal(order.credits, PRO.credits);
        assert.match(order.planName, /One-time 30-day access/);

        const pay = paymentId();
        await payments.verifyRazorpayPayment(userId, {
            razorpay_order_id: order.orderId,
            razorpay_payment_id: pay,
            razorpay_signature: checkoutSignature(order.orderId, pay),
        });
        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.plan, "PRO");
        assert.ok(user.planExpiresAt && user.planExpiresAt > new Date());
        assert.equal(user.credits, PRO.credits);
    });

    it("rejects invalid amounts, quantities and plans before contacting the provider", async () => {
        const payments = await import("../services/payment.services.js");
        const { createOrderSchema } = await import("../validators/payment.validator.js");
        const userId = await createUser();

        assert.equal(createOrderSchema.safeParse({ amountInr: 1 }).success, false);
        assert.equal(createOrderSchema.safeParse({ amountInr: 123 }).success, false);
        assert.equal(
            createOrderSchema.safeParse({ amountInr: LEGACY_STARTER.amountInr }).success,
            false,
        );
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
        const { verifyCheckoutSignature, settleCapturedPayment } = await importSettlement();
        const owner = await createUser();
        const attacker = await createUser();
        const id = orderId();
        const pay = paymentId();
        await createPendingRecord({
            userId: owner,
            order: id,
            credits: STARTER.credits,
            amountPaise: STARTER_PAISE,
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

    it("does not settle a checkout callback when the provider has not captured it", async () => {
        const payments = await import("../services/payment.services.js");
        const userId = await createUser();
        const id = orderId();
        const pay = paymentId();
        await createPendingRecord({
            userId,
            order: id,
            credits: STARTER.credits,
            amountPaise: STARTER_PAISE,
        });
        payments.setPaymentProviderForTests({
            createOrder: async (input) => ({
                id,
                amount: input.amount,
                currency: "INR",
            }),
            fetchPayment: async (paymentId) =>
                capturedPayment(id, paymentId, { status: "authorized" }),
        });
        restoreProvider = () => payments.setPaymentProviderForTests(undefined);

        await assert.rejects(
            payments.verifyRazorpayPayment(userId, {
                razorpay_order_id: id,
                razorpay_payment_id: pay,
                razorpay_signature: checkoutSignature(id, pay),
            }),
            /Payment is not captured/,
        );
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).credits, 0);
        assert.equal(
            (await db.paymentRecord.findUniqueOrThrow({ where: { razorpayOrderId: id } })).status,
            "PENDING",
        );
    });

    it("rejects invalid and malformed webhooks without granting value", async () => {
        const payments = await import("../services/payment.services.js");
        const id = orderId();
        const pay = paymentId();
        const userId = await createUser();
        await createPendingRecord({
            userId,
            order: id,
            credits: STARTER.credits,
            amountPaise: STARTER_PAISE,
        });

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

    it("ignores cancelled/failed payments, unknown orders and amount mismatches", async () => {
        const payments = await import("../services/payment.services.js");
        const userId = await createUser();
        const id = orderId();
        const pay = paymentId();
        await createPendingRecord({
            userId,
            order: id,
            credits: STARTER.credits,
            amountPaise: STARTER_PAISE,
        });

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

        const wrongAmount = webhookBody(id, pay, {}, STARTER_PAISE + 100);
        await assert.rejects(
            payments.processRazorpayWebhook(wrongAmount, webhookSignature(wrongAmount)),
            /amount does not match order/,
        );
        assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).credits, 0);
    });

    it("settles concurrent duplicate webhook deliveries exactly once", async () => {
        const payments = await import("../services/payment.services.js");
        const userId = await createUser();
        const id = orderId();
        const pay = paymentId();
        await createPendingRecord({
            userId,
            order: id,
            credits: STARTER.credits,
            amountPaise: STARTER_PAISE,
        });

        const body = webhookBody(id, pay);
        const signature = webhookSignature(body);
        const results = await Promise.all([
            payments.processRazorpayWebhook(body, signature),
            payments.processRazorpayWebhook(body, signature),
        ]);
        assert.equal(results.filter((r) => r.duplicate === false).length, 1);
        assert.equal(results.filter((r) => r.duplicate === true).length, 1);
        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.credits, STARTER.credits);
        assert.equal(await db.creditTransaction.count({ where: { userId, type: "PURCHASE" } }), 1);
    });

    it("handles webhook-before-verification and verification-before-webhook idempotently", async () => {
        for (const webhookFirst of [true, false]) {
            const userId = await createUser();
            const id = orderId();
            const pay = paymentId();
            await createPendingRecord({
                userId,
                order: id,
                credits: STARTER.credits,
                amountPaise: STARTER_PAISE,
            });
            const payments = await installCapturedProviderForOrder(id);
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
            assert.equal((await db.user.findUniqueOrThrow({ where: { id: userId } })).credits, STARTER.credits);
            assert.equal(await db.creditTransaction.count({ where: { userId, type: "PURCHASE" } }), 1);
        }
    });

    it("preserves historical pending orders with their original amount and credit award", async () => {
        const payments = await import("../services/payment.services.js");
        const userId = await createUser();
        const historicalOrders = [
            { plan: null, credits: LEGACY_STARTER.credits, amountPaise: LEGACY_STARTER_PAISE },
            { plan: "PRO" as const, credits: LEGACY_PRO.credits, amountPaise: LEGACY_PRO.pricePaise },
        ];

        for (const orderFacts of historicalOrders) {
            const id = orderId();
            const pay = paymentId();
            await createPendingRecord({
                userId,
                order: id,
                plan: orderFacts.plan,
                credits: orderFacts.credits,
                amountPaise: orderFacts.amountPaise,
            });
            const body = webhookBody(
                id,
                pay,
                { status: "captured", currency: "INR" },
                orderFacts.amountPaise,
            );
            const result = await payments.processRazorpayWebhook(body, webhookSignature(body));
            assert.equal(result.handled, true);
            assert.equal(result.duplicate, false);

            const record = await db.paymentRecord.findUniqueOrThrow({
                where: { razorpayOrderId: id },
            });
            assert.equal(record.amount, orderFacts.amountPaise);
            assert.equal(record.creditsPurchased, orderFacts.credits);
            assert.equal(record.status, "SUCCESS");
        }

        const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
        assert.equal(user.credits, LEGACY_STARTER.credits + LEGACY_PRO.credits);
        assert.equal(user.plan, "PRO");
        assert.ok(user.planExpiresAt && user.planExpiresAt > new Date());
    });

    it("fails closed for ambiguous legacy records and never grants a plan or credits", async () => {
        const { settleCapturedPayment } = await importSettlement();
        const userId = await createUser();
        const id = orderId();
        // Legacy shape: PRO plan with a credit-pack amount is ambiguous.
        await createPendingRecord({
            userId,
            order: id,
            plan: "PRO",
            credits: 0,
            amountPaise: LEGACY_STARTER_PAISE,
        });

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
        restoreProvider = () => payments.setPaymentProviderForTests(undefined);
        const userId = await createUser();
        await assert.rejects(
            payments.createRazorpayOrder(userId, { amountInr: STARTER.amountInr }),
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
