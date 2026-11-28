import type { Request, Response } from "express";
import {
    createRazorpayOrder,
    processRazorpayWebhook,
    verifyRazorpayPayment,
} from "../services/payment.services.js";
import {
    createOrderSchema,
    verifyPaymentSchema,
} from "../validators/payment.validator.js";

/**
 * Handles HTTP POST request to initiate a Razorpay checkout order for a
 * one-time credit pack or one-time, finite (30-day) PRO / PRO_PLUS access.
 * There is no recurring billing.
 *
 * @param req - Express request with an allow-listed pack amount or plan key
 * @param res - Express response returning 201 Created with order ID and details
 */
export async function createOrder(req: Request, res: Response) {
    const input = createOrderSchema.parse(req.body);
    const orderData = await createRazorpayOrder(req.session.user.id, input);
    res.status(201).json(orderData);
}

/**
 * Verifies the checkout HMAC plus the provider-observed captured payment, then
 * settles the server-created order exactly once.
 *
 * @param req - Express request with razorpay_order_id, razorpay_payment_id, and razorpay_signature
 * @param res - Express response returning the settlement result
 */
export async function verifyPayment(req: Request, res: Response) {
    const input = verifyPaymentSchema.parse(req.body);
    const result = await verifyRazorpayPayment(req.session.user.id, input);
    res.json(result);
}

/**
 * Razorpay server webhook (raw JSON body, no session). Idempotent on payment id.
 */
export async function handleRazorpayWebhook(req: Request, res: Response) {
    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
        res.status(400).json({ error: "Expected raw JSON body" });
        return;
    }

    const signature =
        req.headers["x-razorpay-signature"]?.toString() ??
        req.headers["X-Razorpay-Signature"]?.toString();

    const result = await processRazorpayWebhook(rawBody, signature);
    res.json({ received: true, ...result });
}
