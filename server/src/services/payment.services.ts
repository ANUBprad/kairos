import Razorpay from "razorpay";
import {
    createPaymentRecord,
    findPaymentRecordByOrderId,
} from "../repository/payment.repository.js";
import { logger } from "../lib/logger.js";
import { findUserPlanDetails } from "../repository/user.repository.js";
import {
    ALLOWED_CREDIT_AMOUNTS_INR,
    CREDIT_PACKS,
    calculateCreditsForInr,
    PLAN_PRICES,
} from "../lib/pricing.js";
import {
    assertRazorpayCredentials,
    settleCapturedPayment,
    verifyCheckoutSignature,
    verifyWebhookSignature,
} from "./payment-settlement.services.js";
import { AppError, ValidationError } from "../types/app-error.js";
import type { PlanType } from "../generated/prisma/client.js";
import type { VerifyPaymentInput } from "../validators/payment.validator.js";

export { PLAN_PRICES } from "../lib/pricing.js";

/** Minimal provider surface needed to create an order. */
export type PaymentProviderOrder = {
    id: string;
    amount: string | number;
    currency: string;
};

/** Server-side facts fetched from the provider before trusting a callback. */
export type PaymentProviderPayment = {
    id: string;
    order_id: string;
    status: string;
    currency: string;
    amount: string | number;
};

export type PaymentProvider = {
    createOrder(input: {
        amount: number;
        currency: string;
        receipt: string;
        notes: Record<string, string>;
    }): Promise<PaymentProviderOrder>;
    /** Optional only for order-only test doubles; checkout always requires it. */
    fetchPayment?(paymentId: string): Promise<PaymentProviderPayment>;
};

let providerOverride: PaymentProvider | undefined;

/**
 * Test-only provider injection. A deterministic, provider-mocked test can
 * exercise the real service and database without contacting Razorpay. Never
 * called by production code paths.
 */
export function setPaymentProviderForTests(provider: PaymentProvider | undefined): void {
    providerOverride = provider;
}

/** Initializes the Razorpay SDK instance with configured credentials. */
function getRazorpayInstance() {
    assertRazorpayCredentials("Razorpay payment operations");
    const key_id = process.env.RAZORPAY_KEY_ID!;
    const key_secret = process.env.RAZORPAY_KEY_SECRET!;

    if (providerOverride) {
        return {
            razorpay: {
                orders: {
                    create: (
                        input: Parameters<PaymentProvider["createOrder"]>[0],
                    ) => providerOverride!.createOrder(input),
                },
                payments: {
                    fetch: (paymentId: string) => {
                        if (!providerOverride!.fetchPayment) {
                            throw new AppError(
                                502,
                                "Payment provider lookup is unavailable",
                            );
                        }
                        return providerOverride!.fetchPayment(paymentId);
                    },
                },
            } as unknown as Razorpay,
            keyId: key_id,
        };
    }

    return {
        razorpay: new Razorpay({ key_id, key_secret }),
        keyId: key_id,
    };
}

/**
 * Creates a Razorpay order using server-owned prices only.
 * Client-supplied amounts and credit awards are never trusted: an amount is
 * checked against the pack allow-list, and plan selection uses the stored plan
 * price without ever falling back to PRO.
 */
export async function createRazorpayOrder(
    userId: string,
    options?: {
        amountInr?: number;
        plan?: "PRO" | "PRO_PLUS";
    },
) {
    // Fail before any database or provider work when credentials are missing.
    assertRazorpayCredentials("order creation");

    const user = await findUserPlanDetails(userId);
    if (!user) {
        throw new AppError(404, "User not found");
    }

    const { razorpay, keyId } = getRazorpayInstance();

    let amountInr: number;
    let creditsToAward: number;
    let description: string;
    let targetPlan: PlanType | null = null;

    if (options?.plan) {
        const selectedPlan = options.plan;
        // Defensive runtime check: an invalid plan must never fall through to
        // a default target (in particular, must never become PRO).
        if (!Object.prototype.hasOwnProperty.call(PLAN_PRICES, selectedPlan)) {
            throw new ValidationError("Unsupported subscription plan");
        }
        const planConfig = PLAN_PRICES[selectedPlan];
        amountInr = planConfig.pricePaise / 100;
        creditsToAward = planConfig.credits;
        targetPlan = selectedPlan;
        // The label is a price display only; backend is explicit that this is
        // one-time, finite access rather than a recurring subscription.
        description = `${planConfig.name} - ${planConfig.access} (${planConfig.label})`;
    } else {
        // Credit packs are written with an explicit null plan. Legacy rows with
        // plan='PRO' are ambiguous and settlement rejects them.
        targetPlan = null;
        amountInr = options?.amountInr ?? CREDIT_PACKS[0].amountInr;
        if (!ALLOWED_CREDIT_AMOUNTS_INR.includes(amountInr)) {
            throw new ValidationError("Unsupported top-up amount");
        }
        creditsToAward = calculateCreditsForInr(amountInr);
        description = `Purchase ${creditsToAward} Kairos Credits`;
    }

    const amountPaise = Math.round(amountInr * 100);
    const shortUserId = userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10);
    const receipt = `rcpt_${Date.now()}_${shortUserId}`;

    let order: { id: string; amount: string | number; currency: string };
    try {
        order = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt,
            notes: {
                userId,
                userEmail: user.email,
                creditsPurchased: String(creditsToAward),
                plan: targetPlan ?? "CREDITS",
            },
        });
    } catch (error) {
        logger.error("Razorpay order creation failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        throw new AppError(500, "Failed to create payment order with Razorpay");
    }

    const orderAmount =
        typeof order.amount === "number" ? order.amount : Number(order.amount);
    if (orderAmount !== amountPaise || (order.currency || "INR") !== "INR") {
        logger.error("Razorpay returned an unexpected order amount or currency", {
            orderId: order.id,
        });
        throw new AppError(502, "Payment provider returned unexpected order details");
    }

    await createPaymentRecord({
        userId,
        plan: targetPlan,
        creditsPurchased: creditsToAward,
        razorpayOrderId: order.id,
        amount: amountPaise,
        currency: "INR",
        status: "PENDING",
    });

    // Only the public key ID is returned. Key secret and webhook secret never
    // leave the server.
    return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        credits: creditsToAward,
        plan: targetPlan,
        planName: description,
        keyId,
        user: {
            name: user.name,
            email: user.email,
        },
    };
}

/**
 * Validates provider-observed payment facts before a callback can settle an
 * order. A frontend "success" report alone is never sufficient.
 */
export function assertCapturedInrPayment(input: {
    payment: PaymentProviderPayment;
    orderId: string;
    paymentId: string;
    amountPaise: number;
}): void {
    const { payment, orderId, paymentId, amountPaise } = input;
    if (payment.id !== paymentId || payment.order_id !== orderId) {
        throw new ValidationError("Payment does not match the requested order");
    }
    if (payment.status !== "captured") {
        throw new ValidationError("Payment is not captured");
    }
    if (payment.currency !== "INR") {
        throw new ValidationError("Unexpected payment currency");
    }
    const actualAmount =
        typeof payment.amount === "number" ? payment.amount : Number(payment.amount);
    if (
        !Number.isInteger(actualAmount) ||
        actualAmount <= 0 ||
        actualAmount !== amountPaise
    ) {
        throw new ValidationError("Payment amount does not match the order");
    }
}

/**
 * Verifies the client checkout HMAC, the provider-observed captured payment,
 * and the server-owned order before applying the payment exactly once.
 * Client amount, currency and plan values are deliberately ignored.
 */
export async function verifyRazorpayPayment(
    userId: string,
    input: VerifyPaymentInput,
) {
    assertRazorpayCredentials("payment verification");
    // Verify the client HMAC before any provider lookup or database write, so a
    // forged callback cannot consume provider API quota or touch a payment row.
    verifyCheckoutSignature(
        input.razorpay_order_id,
        input.razorpay_payment_id,
        input.razorpay_signature,
    );

    const record = await findPaymentRecordByOrderId(input.razorpay_order_id);
    if (!record || record.userId !== userId) {
        throw new AppError(404, "Payment order not found");
    }

    const { razorpay } = getRazorpayInstance();
    let payment: PaymentProviderPayment;
    try {
        payment = await razorpay.payments.fetch(input.razorpay_payment_id);
    } catch (error) {
        logger.error("Razorpay payment lookup failed", {
            errorType: error instanceof Error ? error.name : "UnknownError",
        });
        throw new AppError(502, "Failed to verify payment with Razorpay");
    }

    assertCapturedInrPayment({
        payment,
        orderId: input.razorpay_order_id,
        paymentId: input.razorpay_payment_id,
        amountPaise: record.amount,
    });

    return settleCapturedPayment({
        userId,
        orderId: input.razorpay_order_id,
        paymentId: input.razorpay_payment_id,
        signature: input.razorpay_signature,
    });
}

type RazorpayWebhookPayload = {
    event?: string;
    payload?: {
        payment?: {
            entity?: {
                id?: string;
                order_id?: string;
                status?: string;
                currency?: string;
                amount?: string | number;
            };
        };
    };
};

/** Verifies a Razorpay webhook and settles the matching server-created order. */
export async function processRazorpayWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
) {
    // verifyWebhookSignature checks the webhook secret only; order creation and
    // checkout verification do not need to be configured for a signed webhook.
    verifyWebhookSignature(rawBody, signatureHeader);

    let body: RazorpayWebhookPayload;
    try {
        body = JSON.parse(rawBody.toString("utf8")) as RazorpayWebhookPayload;
    } catch {
        throw new ValidationError("Invalid Razorpay webhook payload");
    }

    const event = body.event ?? "";
    const payment = body.payload?.payment?.entity;

    if (event !== "payment.captured" || !payment?.id || !payment.order_id) {
        return { handled: false, reason: "ignored_event" as const };
    }
    // Require an explicit captured status; a frontend report is not enough.
    if (payment.status !== "captured") {
        return { handled: false, reason: "ignored_event" as const };
    }
    if (payment.currency !== "INR") {
        throw new ValidationError("Unexpected webhook payment currency");
    }

    const paymentAmount =
        typeof payment.amount === "number" ? payment.amount : Number(payment.amount);
    if (!Number.isInteger(paymentAmount) || paymentAmount <= 0) {
        throw new ValidationError("Invalid webhook payment amount");
    }

    const record = await findPaymentRecordByOrderId(payment.order_id);
    if (!record) {
        logger.warn("Razorpay webhook for unknown order", {
            orderId: payment.order_id,
        });
        return { handled: false, reason: "unknown_order" as const };
    }
    if (paymentAmount !== record.amount) {
        throw new ValidationError("Webhook payment amount does not match order");
    }

    const result = await settleCapturedPayment({
        userId: record.userId,
        orderId: payment.order_id,
        paymentId: payment.id,
    });

    logger.info("Razorpay webhook processed payment", {
        userId: record.userId,
        paymentId: payment.id,
        duplicate: result.duplicate,
    });

    return { handled: true, duplicate: result.duplicate };
}
