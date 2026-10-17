import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');
const membershipId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership id');
const optionalDate = z.string().trim().optional().refine(
  (value) => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
  'Date filters must use YYYY-MM-DD.',
);
const pagination = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
const pointChannel = z.enum(['admin_manual', 'billing_counter', 'app', 'card']);

function normalizeMembershipSearchQuery(query) {
  if (!query || typeof query !== 'object' || Array.isArray(query)) return query;

  const normalized = Object.fromEntries(
    Object.entries(query).filter(([, value]) => (
      typeof value !== 'string' || value.trim() !== ''
    )),
  );
  if (!normalized.search && normalized.q) normalized.search = normalized.q;
  delete normalized.q;
  if (typeof normalized.status === 'string') {
    normalized.status = normalized.status.trim().toLowerCase().replace(/\s+/g, '_');
    if (normalized.status === 'all') delete normalized.status;
  }
  if (normalized.limit !== undefined && Number.isFinite(Number(normalized.limit))) {
    normalized.limit = String(Math.min(Number(normalized.limit), 100));
  }
  return normalized;
}

export const membershipIdParamsSchema = z.object({ id: membershipId });
export const membershipPlanIdParamsSchema = z.object({ id: objectId });
export const membershipSearchQuerySchema = z.preprocess(
  normalizeMembershipSearchQuery,
  pagination.extend({
    search: z.string().trim().optional(),
    tier: z.string().trim().max(80).optional(),
    status: z.enum(['pending_payment', 'pending_verification', 'active', 'expired', 'cancelled']).optional(),
    documentsPending: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
    notActivated: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
  }),
);
export const membershipPlanPatchSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  price: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  earlyBirdPoints: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  defaultPoints: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  renewalPoints: z.coerce.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),
  isActive: z.boolean().optional(),
  requiresVerification: z.boolean().optional(),
  requiresCompanyDetails: z.boolean().optional(),
  sortOrder: z.coerce.number().int().positive().optional(),
}).refine((body) => Object.keys(body).length > 0, 'At least one plan field is required.');
export const membershipSettingsPatchSchema = z.object({
  discountPercent: z.coerce.number().int().min(0).max(100).optional(),
  gstEnabled: z.boolean().optional(),
  gstRate: z.coerce.number().min(0).max(100)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, 'GST rate can have at most two decimal places.')
    .optional(),
  gstLabel: z.string().trim().min(1).max(40).optional(),
  gstin: z.string().trim().max(30).optional(),
  pointsValidityYears: z.coerce.number().int().positive().max(100).optional(),
  membershipValidityYears: z.coerce.number().int().positive().max(100).optional(),
  maxFamilyMembers: z.coerce.number().int().min(1).max(100).optional(),
  childAgeLimit: z.coerce.number().int().min(0).max(100).optional(),
  earlyBirdLimit: z.coerce.number().int().min(0).max(10000000).optional(),
  receiptCompanyName: z.string().trim().max(160).optional(),
  receiptAddress: z.string().trim().max(500).optional(),
  receiptGstin: z.string().trim().max(30).optional(),
  receiptFooterNote: z.string().trim().max(500).optional(),
}).refine((body) => Object.keys(body).length > 0, 'At least one setting is required.');
export const membershipBillsQuerySchema = pagination.extend({
  from: optionalDate,
  to: optionalDate,
  memberCode: z.string().trim().max(32).optional(),
  serviceType: z.enum(['lawn', 'banquet', 'villa', 'resort', 'shoot', 'birthday', 'reunion', 'other']).optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
  channel: pointChannel.optional(),
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: 'The start date must be before the end date.',
});
export const membershipRenewalSchema = z.object({
  planId: objectId,
  paymentMethod: z.enum(['razorpay', 'bank_transfer', 'cheque']),
  companyDetails: z.object({
    companyName: z.string().trim().min(1).max(160),
    gstNumber: z.string().trim().min(1).max(30),
    contactPerson: z.string().trim().min(1).max(120),
  }).optional(),
});
export const verificationRejectSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});
export const memberLedgerQuerySchema = pagination.extend({
  type: z.enum([
    'credit_joining',
    'credit_renewal',
    'debit_redeem',
    'refund',
    'expire',
    'admin_adjust',
  ]).optional(),
  channel: pointChannel.optional(),
});
export const queueQuerySchema = pagination.extend({
  status: z.enum(['pending_payment', 'pending_verification']).optional(),
});
export const pointsExpiringQuerySchema = z.object({
  withinDays: z.enum(['30', '90']),
});
export const membershipReportsQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: 'The start date must be before the end date.',
});
export const adminBillParamsSchema = z.object({ id: objectId });
export const cancelAdminBillSchema = z.object({
  cancelledAt: z.coerce.date().optional().default(() => new Date()),
});
