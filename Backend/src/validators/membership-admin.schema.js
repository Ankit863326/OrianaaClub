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
export const familyTreeParamsSchema = z.object({
  memberNo: z.string().trim().min(1).max(60).regex(/^(?:(?:\d+)(?:-(?:S|C\d+|F|M|SF|SM|GM|HR|N\d+))?|OC-\d{4,}(?:-(?:S|C\d+|F|M|SF|SM))?)$/i, 'Invalid member number.'),
});
export const membershipPlanIdParamsSchema = z.object({ id: objectId });
export const membershipSearchQuerySchema = z.preprocess(
  normalizeMembershipSearchQuery,
  pagination.extend({
    search: z.string().trim().optional(),
    tier: z.string().trim().max(80).optional(),
    status: z.enum(['draft', 'profile_only', 'payment_pending', 'pending_payment', 'pending_verification', 'pending_approval', 'active', 'expired', 'cancelled']).optional(),
    memberType: z.enum(['primary', 'spouse', 'child', 'father', 'mother', 'nominee_gm', 'nominee_hr', 'nominee']).optional(),
    ratePhase: z.enum(['early_bird', 'default']).optional(),
    aadhaarPending: z.enum(['true', 'false']).optional().transform((value) => value === 'true'),
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

const familyTierConfigSchema = z.object({
  tier: z.enum([
    'founder-legacy',
    'platinum-crest',
    'imperial-signature',
    'presidential-elite',
    'chairmans-privilege',
    'founder-circle',
    'corporate',
    'privileged',
  ]),
  familyEnabled: z.boolean(),
  nomineesEnabled: z.boolean(),
  maxNominees: z.number().int().min(0).max(100),
  nomineeRoles: z.union([
    z.literal('free_text'),
    z.array(z.enum(['GM', 'HR'])),
  ]),
});

const familyMembershipConfigSchema = z.object({
  gstPct: z.number().min(0).max(100)
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8),
  pointsOnBase: z.boolean(),
  multipliers: z.object({
    earlyBird: z.number().finite().nonnegative(),
    default: z.number().finite().nonnegative(),
  }),
  earlyBirdLimit: z.number().int().min(0).max(10000000),
  pointExpiryYears: z.number().int().min(1).max(100),
  discounts: z.object({
    spouse: z.union([z.literal(0), z.literal(50), z.literal(75)]),
    parent: z.union([z.literal(0), z.literal(50), z.literal(75)]),
    child: z.union([z.literal(0), z.literal(50), z.literal(75)]),
  }),
  childMaxAge: z.number().int().min(0).max(100),
  limits: z.object({
    spouse: z.number().int().min(0).max(100),
    parents: z.number().int().min(0).max(100),
    parentsPerSide: z.number().int().min(0).max(100),
    children: z.number().int().min(0).max(100).nullable(),
  }),
  reviewTargets: z.object({
    verificationWorkingDays: z.number().int().min(0).max(365),
    approvalHours: z.number().int().min(0).max(8760),
  }),
  nomineesTakeApprovalSeq: z.boolean(),
  tiers: z.array(familyTierConfigSchema).length(8)
    .refine((tiers) => new Set(tiers.map((tier) => tier.tier)).size === 8,
      'Each configured membership tier must appear exactly once.')
    .refine((tiers) => {
      const corporate = tiers.find((tier) => tier.tier === 'corporate');
      return corporate?.nomineeRoles?.length === 2
        && corporate.nomineeRoles.includes('GM')
        && corporate.nomineeRoles.includes('HR');
    }, 'Corporate nominee roles must remain GM and HR.'),
});

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
  earlyBirdLimit: z.coerce.number().int().min(0).max(10000000).optional(),
  familyMembership: familyMembershipConfigSchema.optional(),
  receiptCompanyName: z.string().trim().max(160).optional(),
  receiptAddress: z.string().trim().max(500).optional(),
  receiptGstin: z.string().trim().max(30).optional(),
  receiptHsnSac: z.string().trim().max(30).optional(),
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
export const approvalQueueQuerySchema = pagination;
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
