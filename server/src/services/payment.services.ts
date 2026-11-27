import Razorpay from "razorpay";
import {
    createPaymentRecord,
    findPaymentRecordByOrderId,
} from "../repository/payment.repository.js";
import { logger } from "../lib/logger.js";
import { findUserPlanDetails } from "../repository/user.repository.js";
import {
    ALLOWED_CREDIT_AMOUNTS_INR,
    calculateCreditsForInr,
    PLAN_PRICES,
} from "../lib/pricing.js";
import {
    settleCapturedPayment,
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

export type PaymentProvider = {
    createOrder(input: {
        amount: number;
        currency: string;
        receipt: string;
        notes: Record<string, string>;
    }): Promise<PaymentProviderOrder>;
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
    const key_id = process.env.RAZORPAY_KEY_ID;
    const key_secret = process.env.RAZORPAY_KEY_SECRET;

    if (!key_id || !key_secret) {
        throw new AppError(
            500,
            "Razorpay API keys are not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in server/.env",
        );
    }

    if (providerOverride) {
        return {
            razorpay: {
                orders: {
                    create: (
                        input: Parameters<PaymentProvider["createOrder"]>[0],
                    ) => providerOverride!.createOrder(input),
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
 * Client-supplied amounts must match an existing credit pack; plan selection
 * uses the stored plan price and never falls back to PRO.
 */
export async function createRazorpayOrder(
    userId: string,
    options?: {
        amountInr?: number;
        plan?: "PRO" | "PRO_PLUS";
    },
) {
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
        description = planConfig.name;
    } else {
        // Credit packs are written with an explicit null plan. Legacy rows with
        // plan='PRO' are ambiguous and settlement now rejects them.
        targetPlan = null;
        amountInr = options?.amountInr ?? 50;
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
 * Verifies the client checkout HMAC and applies the payment exactly once.
 * Client amount and plan values are deliberately ignored.
 */
export async function verifyRazorpayPayment(
    userId: string,
    input: VerifyPaymentInput,
) {
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
            };
        };
    };
};

/** Verifies a Razorpay webhook and settles the matching server-created order. */
export async function processRazorpayWebhook(
    rawBody: Buffer,
    signatureHeader: string | undefined,
) {
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
    if (payment.status && payment.status !== "captured") {
        return { handled: false, reason: "ignored_event" as const };
    }
    if (payment.currency && payment.currency !== "INR") {
        throw new ValidationError("Unexpected webhook payment currency");
    }

    const record = await findPaymentRecordByOrderId(payment.order_id);
    if (!record) {
        logger.warn("Razorpay webhook for unknown order", {
            orderId: payment.order_id,
        });
        return { handled: false, reason: "unknown_order" as const };
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
