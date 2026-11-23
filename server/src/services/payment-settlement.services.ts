import crypto from "crypto";
import prisma from "../lib/db.js";
import { timingSafeEqualHex } from "../lib/crypto.js";
import { AppError, ValidationError } from "../types/app-error.js";
import { computePlanExpiry } from "../repository/user.repository.js";

const ORDER_ID_PATTERN = /^order_[A-Za-z0-9]{6,}$/;
const PAYMENT_ID_PATTERN = /^pay_[A-Za-z0-9]{6,}$/;

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
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret) {
        throw new AppError(500, "RAZORPAY_KEY_SECRET is not configured on the server");
    }
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
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
        throw new AppError(503, "RAZORPAY_WEBHOOK_SECRET is not configured on the server");
    }
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
 * The payment status transition, credit ledger write and plan renewal all occur
 * in one database transaction. A concurrent or repeated settlement sees the
 * already-SUCCESS row and returns `duplicate: true` without re-granting anything.
 */
export async function settleCapturedPayment(
    input: SettlePaymentInput,
): Promise<SettlementResult> {
    assertPaymentIdentifiers(input.orderId, input.paymentId);

    return prisma.$transaction(async (tx) => {
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
                planApplied: record.plan,
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
                    planApplied: record.plan,
                    message: "Payment already applied",
                };
            }
            throw new AppError(409, "Payment state changed concurrently");
        }

        if (record.creditsPurchased > 0) {
            const idempotencyKey = `payment-credit:${record.id}`;
            const existingGrant = await tx.creditTransaction.findUnique({
                where: { idempotencyKey },
                select: { id: true },
            });

            if (!existingGrant) {
                await tx.user.update({
                    where: { id: input.userId },
                    data: { credits: { increment: record.creditsPurchased } },
                });
                const updated = await tx.user.findUniqueOrThrow({
                    where: { id: input.userId },
                    select: { credits: true },
                });
                await tx.creditTransaction.create({
                    data: {
                        userId: input.userId,
                        amount: record.creditsPurchased,
                        balanceAfter: updated.credits,
                        type: "PURCHASE",
                        description: `Purchased ${record.creditsPurchased} credits (order ${input.orderId})`,
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

        if (record.plan) {
            const existing = await tx.user.findUnique({
                where: { id: input.userId },
                select: { planExpiresAt: true },
            });
            await tx.user.update({
                where: { id: input.userId },
                data: {
                    plan: record.plan,
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
            creditsAdded: record.creditsPurchased,
            planApplied: record.plan,
            message: record.plan
                ? `${record.plan} activated with ${record.creditsPurchased} credits.`
                : `${record.creditsPurchased} credits added.`,
        };
    });
}
