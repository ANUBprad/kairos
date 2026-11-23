import { z } from "zod";
import { ALLOWED_CREDIT_AMOUNTS_INR } from "../lib/pricing.js";

export const createOrderSchema = z
  .object({
    amountInr: z.number().int().positive().optional(),
    plan: z.enum(["PRO", "PRO_PLUS"]).optional(),
  })
  .superRefine((value, ctx) => {
    // A plan selection is priced from PLAN_PRICES; any client amount is ignored.
    if (value.plan) return;
    const amount = value.amountInr ?? 50;
    if (!ALLOWED_CREDIT_AMOUNTS_INR.includes(amount)) {
      ctx.addIssue({
        code: "custom",
        path: ["amountInr"],
        message: "Unsupported top-up amount",
      });
    }
  });

/** Client amount/plan are intentionally not accepted at verification time. */
export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().regex(/^order_[A-Za-z0-9]{6,}$/, "Invalid order ID"),
  razorpay_payment_id: z.string().regex(/^pay_[A-Za-z0-9]{6,}$/, "Invalid payment ID"),
  razorpay_signature: z.string().regex(/^[0-9a-f]{64}$/i, "Invalid signature"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
