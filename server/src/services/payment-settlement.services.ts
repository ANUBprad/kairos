import crypto from "crypto";
import prisma from "../lib/db.js";
import { timingSafeEqualHex } from "../lib/crypto.js";
import { AppError, ValidationError } from "../types/app-error.js";
import { computePlanExpiry } from "../repository/user.repository.js";
import {
    HISTORICAL_PLAN_PRICES,
    PLAN_ACCESS_DESCRIPTION,
    PLAN_PRICES,
    calculateCreditsForInr,
    historicalCreditPackCreditsForInr,
} from "../lib/pricing.js";
import type { PurchasablePlan } from "../lib/pricing.js";
import type { PlanType, Prisma } from "../generated/prisma/client.js";

const ORDER_ID_PATTERN = /^order_[A-Za-z0-9]{6,}$/;
const PAYMENT_ID_PATTERN = /^pay_[A-Za-z0-9]{6,}$/;

/** Required at payment-operation time; env.ts keeps them optional at startup. */
const REQUIRED_RAZORPAY_ENV_VARS = [
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
] as const;
type RazorpayCredentialName = (typeof REQUIRED_RAZORPAY_ENV_VARS)[number];

/** Each operation only requires the credentials it actually uses. */
const CHECKOUT_SIGNATURE_CREDENTIALS: readonly RazorpayCredentialName[] = [
    "RAZORPAY_KEY_SECRET",
];
const WEBHOOK_CREDENTIALS: readonly RazorpayCredentialName[] = [
    "RAZORPAY_WEBHOOK_SECRET",
];

/**
 * Fails clearly when the credentials needed by an operation are absent. Only
 * variable NAMES are reported; values are never logged or returned.
 */
export function assertRazorpayCredentials(
    operation: string,
    required: readonly RazorpayCredentialName[] = REQUIRED_RAZORPAY_ENV_VARS,
): void {
    const missing = required.filter((name) => !process.env[name]?.trim());
    if (missing.length > 0) {
        throw new AppError(
            500,
            `Missing Razorpay credentials for ${operation}: ${missing.join(", ")} must be configured on the server`,
        );
    }
}

export interface SettlePaymentInput {
    userId: string;
    orderId: string;
    paymentId: string;
    /** Client-checkout HMAC. Webhook settlements omit this. */
    signature?: string;
}

export interface SettlementResult {
    success: true;
    duplicate: boolean;
    credits: number;
    creditsAdded: number;
    planApplied: string | null;
    message: string;
}

export type PaymentOrderKind = "credit_pack" | "subscription";

/** The raw, server-owned facts available on a payment record. */
export interface PaymentOrderFacts {
    plan: PlanType | null;
    creditsPurchased: number;
    amountPaise: number;
    currency: string;
}

/** The unambiguous entitlement derived from those facts. */
export interface ClassifiedPaymentOrder {
    kind: PaymentOrderKind;
    plan: PurchasablePlan | null;
    creditsPurchased: number;
    amountPaise: number;
    currency: string;
}

const AMBIGUOUS_PAYMENT_MESSAGE =
    "Payment record has ambiguous legacy entitlement fields";

function rejectPaymentOrder(reason: string): never {
    throw new AppError(409, AMBIGUOUS_PAYMENT_MESSAGE, { reason });
}

function isPurchasablePlan(plan: PlanType): plan is PurchasablePlan {
    return Object.prototype.hasOwnProperty.call(PLAN_PRICES, plan);
}

function matchesCurrentPlanPrice(
    plan: PurchasablePlan,
    amountPaise: number,
    creditsPurchased: number,
): boolean {
    const price = PLAN_PRICES[plan];
    return amountPaise === price.pricePaise && creditsPurchased === price.credits;
}

function matchesHistoricalPlanPrice(
    plan: PurchasablePlan,
    amountPaise: number,
    creditsPurchased: number,
): boolean {
    const price = HISTORICAL_PLAN_PRICES[plan];
    return amountPaise === price.pricePaise && creditsPurchased === price.credits;
}

/**
 * Derives an entitlement strictly from server-owned pricing facts.
 *
 * Current prices are the only prices allowed for NEW orders. Historical price
 * pairs are accepted only for rows that were already created before the price
 * change, so a pending or successful legacy order keeps its original amount
 * and credit award without any retroactive rewrite.
 *
 * Historical payment rows can look like subscriptions because `plan` used to
 * be NOT NULL DEFAULT 'PRO'. Those that do not match an exact current or
 * historical price pair are rejected as ambiguous instead of being guessed,
 * so they can never grant PRO by accident.
 */
export function classifyPaymentOrder(
    record: PaymentOrderFacts,
): ClassifiedPaymentOrder {
    if (record.currency !== "INR") {
        rejectPaymentOrder("unsupported_currency");
    }
    if (!Number.isInteger(record.amountPaise) || record.amountPaise <= 0) {
        rejectPaymentOrder("invalid_amount");
    }
    if (
        !Number.isInteger(record.creditsPurchased) ||
        record.creditsPurchased < 0
    ) {
        rejectPaymentOrder("invalid_credits");
    }

    const { plan, creditsPurchased, amountPaise, currency } = record;

    if (plan !== null) {
        // FREE (or any future non-purchasable plan) is never billable.
        if (!isPurchasablePlan(plan)) {
            rejectPaymentOrder("plan_not_purchasable");
        }
        if (
            !matchesCurrentPlanPrice(plan, amountPaise, creditsPurchased) &&
            !matchesHistoricalPlanPrice(plan, amountPaise, creditsPurchased)
        ) {
            rejectPaymentOrder("plan_fields_mismatch");
        }
        return {
            kind: "subscription",
            plan,
            creditsPurchased,
            amountPaise,
            currency,
        };
    }

    // Legacy PRO rows with zero credits or an unrelated amount must never reach
    // the plan update below: only an exact price pair identifies an entitlement.
    if (creditsPurchased === 0) {
        rejectPaymentOrder("missing_pack_credits");
    }
    const amountInr = amountPaise / 100;
    if (!Number.isInteger(amountInr)) {
        rejectPaymentOrder("invalid_pack_amount");
    }

    let expectedCredits: number | null = null;
    try {
        expectedCredits = calculateCreditsForInr(amountInr);
    } catch {
        expectedCredits = null;
    }
    if (expectedCredits === null) {
        expectedCredits = historicalCreditPackCreditsForInr(amountInr);
    }
    if (expectedCredits === null || creditsPurchased !== expectedCredits) {
        rejectPaymentOrder("pack_fields_mismatch");
    }

    return {
        kind: "credit_pack",
        plan: null,
        creditsPurchased,
        amountPaise,
        currency,
    };
}

function assertPaymentIdentifiers(orderId: string, paymentId: string): void {
    if (!ORDER_ID_PATTERN.test(orderId) || !PAYMENT_ID_PATTERN.test(paymentId)) {
        throw new ValidationError("Invalid Razorpay order or payment identifier");
    }
}

/** Verifies `order_id|payment_id` against RAZORPAY_KEY_SECRET in constant time. */
export function verifyCheckoutSignature(
    orderId: string,
    paymentId: string,
    signature: string,
): void {
    assertRazorpayCredentials(
        "checkout signature verification",
        CHECKOUT_SIGNATURE_CREDENTIALS,
    );
    const keySecret = process.env.RAZORPAY_KEY_SECRET!;
    assertPaymentIdentifiers(orderId, paymentId);

    const expected = crypto
        .createHmac("sha256", keySecret)
        .update(`${orderId}|${paymentId}`)
        .digest("hex");
    if (!timingSafeEqualHex(expected, signature)) {
        throw new ValidationError("Invalid payment signature");
    }
}

/** Verifies a raw Razorpay webhook body in constant time. */
export function verifyWebhookSignature(
    rawBody: Buffer,
    signatureHeader: string | undefined,
): void {
    assertRazorpayCredentials("webhook signature verification", WEBHOOK_CREDENTIALS);
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    if (!signatureHeader) {
        throw new ValidationError("Missing Razorpay webhook signature");
    }

    const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody)
        .digest("hex");
    if (!timingSafeEqualHex(expected, signatureHeader)) {
        throw new ValidationError("Invalid Razorpay webhook signature");
    }
}

/**
 * Atomically claims a server-created payment record and applies its entitlement.
 *
 * The payment status transition, credit ledger write and one-time plan access
 * all occur in one database transaction. A concurrent or repeated settlement
 * sees the already-SUCCESS row and returns `duplicate: true` without
 * re-granting anything.
 */
export async function settleCapturedPayment(
    input: SettlePaymentInput,
): Promise<SettlementResult> {
    // The caller has already verified either the checkout HMAC or the webhook
    // HMAC with its own scoped credential gate. Settlement itself only applies
    // server-owned facts and needs no additional provider credential.
    assertPaymentIdentifiers(input.orderId, input.paymentId);

    return prisma.$transaction((tx) =>
        settleCapturedPaymentInTransaction(tx, input),
    );
}

/**
 * Transaction body of {@link settleCapturedPayment}, exported for database-free
 * regression tests using a fake `Prisma.TransactionClient`.
 */
export async function settleCapturedPaymentInTransaction(
    tx: Prisma.TransactionClient,
    input: SettlePaymentInput,
): Promise<SettlementResult> {
    const record = await tx.paymentRecord.findUnique({
        where: { razorpayOrderId: input.orderId },
    });

    // Do not leak whether another user's order exists.
    if (!record || record.userId !== input.userId) {
        throw new AppError(404, "Payment order not found");
    }

    if (input.signature) {
        verifyCheckoutSignature(input.orderId, input.paymentId, input.signature);
    }

    // Classify before the atomic claim and before any write. Even a duplicate
    // SUCCESS row must be classified: if it cannot be, settlement fails closed
    // instead of reporting plan access as applied.
    const classified = classifyPaymentOrder({
        plan: record.plan,
        creditsPurchased: record.creditsPurchased,
        amountPaise: record.amount,
        currency: record.currency,
    });

    if (record.status === "SUCCESS") {
        if (record.razorpayPaymentId && record.razorpayPaymentId !== input.paymentId) {
            throw new AppError(409, "Payment order was settled with a different payment");
        }
        const settledUser = await tx.user.findUnique({
            where: { id: input.userId },
            select: { credits: true },
        });
        return {
            success: true as const,
            duplicate: true,
            credits: settledUser?.credits ?? 0,
            creditsAdded: 0,
            planApplied: classified.plan,
            message: "Payment already applied",
        };
    }

    if (record.status !== "PENDING") {
        throw new AppError(409, "Payment order is no longer payable");
    }

    const conflictingPayment = await tx.paymentRecord.findUnique({
        where: { razorpayPaymentId: input.paymentId },
        select: { id: true },
    });
    if (conflictingPayment && conflictingPayment.id !== record.id) {
        throw new AppError(409, "Payment identifier already belongs to another order");
    }

    const claimed = await tx.paymentRecord.updateMany({
        where: {
            id: record.id,
            status: "PENDING",
            razorpayPaymentId: null,
        },
        data: {
            status: "SUCCESS",
            razorpayPaymentId: input.paymentId,
            razorpaySignature: input.signature ?? null,
        },
    });

    if (claimed.count !== 1) {
        const fresh = await tx.paymentRecord.findUnique({
            where: { id: record.id },
            select: { status: true, razorpayPaymentId: true },
        });
        if (fresh?.status === "SUCCESS" && fresh.razorpayPaymentId === input.paymentId) {
            const settledUser = await tx.user.findUnique({
                where: { id: input.userId },
                select: { credits: true },
            });
            return {
                success: true as const,
                duplicate: true,
                credits: settledUser?.credits ?? 0,
                creditsAdded: 0,
                planApplied: classified.plan,
                message: "Payment already applied",
            };
        }
        throw new AppError(409, "Payment state changed concurrently");
    }

    if (classified.creditsPurchased > 0) {
        const idempotencyKey = `payment-credit:${record.id}`;
        const existingGrant = await tx.creditTransaction.findUnique({
            where: { idempotencyKey },
            select: { id: true },
        });

        if (!existingGrant) {
            await tx.user.update({
                where: { id: input.userId },
                data: { credits: { increment: classified.creditsPurchased } },
            });
            const updated = await tx.user.findUniqueOrThrow({
                where: { id: input.userId },
                select: { credits: true },
            });
            await tx.creditTransaction.create({
                data: {
                    userId: input.userId,
                    amount: classified.creditsPurchased,
                    balanceAfter: updated.credits,
                    type: "PURCHASE",
                    description: `Purchased ${classified.creditsPurchased} credits (order ${input.orderId})`,
                    metadata: {
                        orderId: input.orderId,
                        paymentId: input.paymentId,
                        source: "razorpay",
                    },
                    idempotencyKey,
                },
            });
        }
    }

    // Only a validated plan payment may change the user's plan. That access is
    // one-time and finite (planExpiresAt); there is no recurring billing or
    // automatic renewal job. Credit packs never change the plan.
    if (classified.kind === "subscription" && classified.plan) {
        const existing = await tx.user.findUnique({
            where: { id: input.userId },
            select: { planExpiresAt: true },
        });
        await tx.user.update({
            where: { id: input.userId },
            data: {
                plan: classified.plan,
                planExpiresAt: computePlanExpiry(existing?.planExpiresAt),
            },
        });
    }

    const finalUser = await tx.user.findUniqueOrThrow({
        where: { id: input.userId },
        select: { credits: true },
    });

    return {
        success: true as const,
        duplicate: false,
        credits: finalUser.credits,
        creditsAdded: classified.creditsPurchased,
        planApplied: classified.plan,
        message: classified.plan
            ? `${classified.plan} ${PLAN_ACCESS_DESCRIPTION.toLowerCase()} activated with ${classified.creditsPurchased} credits. No recurring billing is configured.`
            : `${classified.creditsPurchased} credits added as a one-time credit pack.`,
    };
}
