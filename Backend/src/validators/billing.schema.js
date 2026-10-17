import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');
const serviceType = z.enum(['lawn', 'banquet', 'villa', 'resort', 'shoot', 'birthday', 'reunion', 'other']);
const integerAmount = z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const nonEmptyId = z.string().trim().min(1).max(120);
const billingChannel = z.string({
  invalid_type_error: 'Channel must be one of: counter, app, card.',
}).optional().default('counter').refine(
  (value) => ['counter', 'app', 'card'].includes(value),
  'Channel must be one of: counter, app, card.',
);
const pointChannel = z.enum(['admin_manual', 'billing_counter', 'app', 'card']);

export const billingCheckSchema = z.object({
  memberCode: z.string().trim().min(1).max(32).optional(),
  phone: z.string().trim().min(5).max(30).optional(),
  billAmount: integerAmount,
}).refine((body) => Boolean(body.memberCode || body.phone), 'Provide a member code or phone number.');

export const billingRedeemSchema = z.object({
  memberCode: z.string().trim().min(1).max(32),
  billId: nonEmptyId,
  bookingId: z.string().trim().max(120).optional().default(''),
  serviceType,
  eventDate: z.coerce.date(),
  billAmount: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  pointsToUse: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  familyMemberId: objectId.optional(),
  channel: billingChannel,
});

export const billingCancelSchema = z.object({
  billId: nonEmptyId.optional(),
  bookingId: nonEmptyId.optional(),
  cancelledAt: z.coerce.date().optional().default(() => new Date()),
}).refine((body) => Boolean(body.billId || body.bookingId), 'Provide a bill ID or booking ID.');
export const adminCancelSchema = z.object({
  cancelledAt: z.coerce.date().optional().default(() => new Date()),
});

export const billingMemberCodeParamsSchema = z.object({
  memberCode: z.string().trim().min(1).max(32),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(120),
});
export const apiKeyParamsSchema = z.object({ id: objectId });

export const pointsAdjustmentSchema = z.object({
  amount: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  direction: z.enum(['+', '-']),
  reason: z.string().trim().min(1).max(1000),
});
export const membershipLookupQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
});
export const membershipAdjustmentParamsSchema = z.object({
  id: z.string().trim().min(1).max(32),
});
export const membershipLedgerParamsSchema = z.object({
  id: objectId,
});
export const redemptionParamsSchema = z.object({ id: objectId });
export const redemptionsQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  memberCode: z.string().trim().max(32).optional(),
  serviceType: serviceType.optional(),
  status: z.enum(['confirmed', 'cancelled']).optional(),
  channel: pointChannel.optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
}).refine((query) => (!query.from || !Number.isNaN(Date.parse(query.from)))
  && (!query.to || !Number.isNaN(Date.parse(query.to))), 'Date filters must be valid dates.')
  .refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to), {
    message: 'The from date must be earlier than or equal to the to date.',
  });
export const ledgerQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  channel: pointChannel.optional(),
});
