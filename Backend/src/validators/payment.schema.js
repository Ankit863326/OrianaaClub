// Validate member-owned Razorpay requests before they reach payment processing.
import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership ID.');

export const membershipPaymentParamsSchema = z.object({
  membershipId: objectIdSchema,
});

export const createPaymentOrderSchema = z.object({
  membershipId: objectIdSchema,
  method: z.enum(['upi', 'card', 'razorpay']),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(100),
  razorpay_payment_id: z.string().trim().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
});
