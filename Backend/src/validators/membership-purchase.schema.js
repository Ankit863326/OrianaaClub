import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');
const membershipObjectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership id');
const paymentMethod = z.enum(['razorpay', 'bank_transfer', 'cheque', 'rtgs']);
const renewalPaymentMethod = z.enum(['razorpay', 'bank_transfer', 'cheque']);
const rtgsDetails = z.object({
  utr: z.string().trim().min(6).max(50).regex(/^[a-z\d/-]+$/i),
  transferDate: z.coerce.date(),
});
const companyDetails = z.object({
  companyName: z.string().trim().min(1).max(160),
  gstNumber: z.string().trim().min(1).max(30),
  contactPerson: z.string().trim().min(1).max(120),
}).optional();

export const membershipPurchaseSchema = z.object({
  planId: objectId,
  paymentMethod,
  companyDetails,
  rtgsDetails: rtgsDetails.optional(),
}).superRefine((body, context) => {
  if (body.paymentMethod === 'rtgs' && !body.rtgsDetails) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rtgsDetails'],
      message: 'RTGS UTR and transfer date are required.',
    });
  }
});

export const membershipRenewalSchema = z.object({
  planId: objectId,
  paymentMethod: renewalPaymentMethod,
  companyDetails,
});

export const membershipPaymentVerificationSchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(100),
  razorpay_payment_id: z.string().trim().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
});

export const membershipPaymentOrderSchema = z.object({
  paymentId: objectId,
});

export const offlinePaymentSchema = z.object({
  membershipId: objectId,
  method: z.enum(['bank_transfer', 'cheque', 'rtgs']),
  amount: z.number().positive().max(Number.MAX_SAFE_INTEGER)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, 'Amount can have at most two decimal places.')
    .optional(),
  reference: z.string().trim().min(1).max(200),
  paymentDate: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional().default(''),
}).superRefine((body, context) => {
  if (body.method === 'rtgs'
    && (!/^[a-z\d/-]{6,50}$/i.test(body.reference) || !body.paymentDate)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['reference'],
      message: 'RTGS UTR and transfer date are required; UTR must be 6 to 50 valid characters.',
    });
  }
});

export const paymentIdParamsSchema = z.object({ id: objectId });
export const paymentReceiptParamsSchema = z.object({ paymentId: objectId });
export const membershipIdParamsSchema = z.object({ id: membershipObjectId });
export const verificationDocumentParamsSchema = z.object({
  id: membershipObjectId,
  documentId: z.string().uuid(),
});
export const deactivateMembershipSchema = z.object({
  reason: z.string().trim().min(1, 'A reason is required to deactivate a membership.').max(1000),
});
