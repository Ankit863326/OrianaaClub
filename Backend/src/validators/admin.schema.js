// Phase 5a: Validate admin search, member, family, and plan request payloads.
import { z } from 'zod';
import { optionalAnniversaryDateSchema } from './family-anniversary.schema.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const gender = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);
const dateOfBirth = z.coerce.date().refine((date) => date < new Date(), 'Date must be in the past.');

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const membersQuerySchema = paginationSchema.extend({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['draft', 'pending_payment', 'pending_verification', 'active', 'expired', 'cancelled']).optional(),
  notActivated: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
  plan: z.string().trim().max(80).optional(),
  sort: z.enum(['createdAt', 'name', 'email', 'status']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const userParamsSchema = z.object({ userId: objectId });
export const idParamsSchema = z.object({ id: objectId });
export const familyParamsSchema = z.object({ userId: objectId, familyId: objectId });

export const memberPatchSchema = z.object({
  firstName: z.string().trim().min(2).max(50).optional(),
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  fullName: z.string().trim().min(2).max(120).optional(),
  gender: gender.optional(),
  countryCode: z.string().trim().min(1).max(8).optional(),
  mobile: z.string().trim().min(6).max(20).optional(),
  dob: dateOfBirth.optional(),
  interestArea: z.string().trim().min(1).max(100).optional(),
  agreePromo: z.coerce.boolean().optional(),
}).refine((values) => Object.keys(values).length > 0, 'At least one member field is required.');

export const manualMemberSchema = z.object({
  user: z.object({
    firstName: z.string().trim().min(2).max(50),
    email: z.string().trim().email().transform((value) => value.toLowerCase()),
  }),
  profile: z.object({
    fullName: z.string().trim().min(2).max(120),
    gender,
    countryCode: z.string().trim().min(1).max(8),
    mobile: z.string().trim().min(6).max(20),
    dob: dateOfBirth,
    interestArea: z.string().trim().min(1).max(100),
    agreePromo: z.boolean().optional().default(false),
  }),
  planSlug: z.string().trim().min(1).max(80),
  offlinePayment: z.object({
    method: z.enum(['bank_transfer', 'cheque', 'rtgs']),
    reference: z.string().trim().min(1).max(200),
    paymentDate: z.coerce.date().optional(),
    amountPaise: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    note: z.string().trim().min(1).max(500),
  }).superRefine((payment, context) => {
    if (payment.method === 'rtgs'
      && (!/^[a-z\d/-]{6,50}$/i.test(payment.reference) || !payment.paymentDate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reference'],
        message: 'A valid RTGS UTR and transfer date are required.',
      });
    }
  }).optional(),
});

const planFields = z.object({
  id: z.string().trim().min(1).max(80).optional(),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9-]+$/i).optional(),
  title: z.string().trim().min(2).max(100),
  subtitle: z.string().trim().max(200).optional(),
  price: z.coerce.number().nonnegative().max(Number.MAX_SAFE_INTEGER),
  gstPercent: z.coerce.number().nonnegative().max(100),
  planFee: z.coerce.number().nonnegative().max(Number.MAX_SAFE_INTEGER),
  pointsTiers: z.array(z.object({
    label: z.string().trim().min(1).max(200),
    points: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
    fromMember: z.coerce.number().int().positive(),
    toMember: z.coerce.number().int().positive().nullable().optional(),
  })).max(30),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder: z.coerce.number().int().nonnegative().max(10000),
});

export const planBodySchema = planFields.refine((value) => !value.slug || !value.id || value.slug === value.id, {
  message: 'Plan id and slug must match when both are provided.',
}).refine((value) => Boolean(value.slug || value.id), 'A plan slug is required.');

export const planPatchSchema = planFields.partial().omit({ id: true, slug: true })
  .refine((value) => Object.keys(value).length > 0, 'At least one plan field is required.');

export const familyPatchSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  gender: gender.optional(),
  relationship: z.string().trim().min(1).max(40).optional(),
  dob: dateOfBirth.optional(),
  anniversaryDate: optionalAnniversaryDateSchema,
}).refine((values) => Object.keys(values).length > 0, 'At least one family field is required.');

export const paymentsQuerySchema = paginationSchema.extend({
  status: z.enum(['created', 'pending', 'pending_verification', 'confirmed', 'paid', 'failed', 'rejected', 'refunded', 'partially_refunded']).optional(),
  method: z.enum(['razorpay', 'bank_transfer', 'netbanking', 'cheque', 'rtgs', 'cash', 'manual']).optional(),
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
}).refine((query) => {
  const fromValid = !query.from || !Number.isNaN(Date.parse(query.from));
  const toValid = !query.to || !Number.isNaN(Date.parse(query.to));
  return fromValid && toValid && (!query.from || !query.to || Date.parse(query.from) <= Date.parse(query.to));
}, 'Payment date range must contain valid dates in chronological order.');

export const refundBodySchema = z.object({
  amount: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  reason: z.string().trim().min(1).max(500),
  reversePoints: z.boolean().optional().default(false),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});
