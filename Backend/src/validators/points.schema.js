// Phase 3: Validate points filters and administrator ledger changes.
import { z } from 'zod';

export const pointsCategories = [
  'membership_award', 'food', 'dance_floor', 'stay', 'spa', 'event', 'other', 'adjustment', 'refund',
];

const positiveInteger = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const optionalDate = z.preprocess(
  (value) => typeof value === 'string' && value.trim() === '' ? undefined : value,
  z.string().trim().optional().refine(
    (value) => !value || !Number.isNaN(Date.parse(value)),
    'Date filter must be a valid date.',
  ),
);

export const pointsHistorySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  type: z.enum(['credit', 'debit']).optional(),
  category: z.enum(pointsCategories).optional(),
  from: optionalDate,
  to: optionalDate,
}).refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to), {
  message: 'The from date must be earlier than or equal to the to date.',
});

const transactionSchema = z.object({
  membershipId: z.string().regex(/^[a-f\d]{24}$/i, 'Membership ID is invalid.'),
  amount: positiveInteger,
  category: z.enum(pointsCategories),
  reason: z.string().trim().min(1).max(500),
  reference: z.string().trim().max(500).optional(),
  idempotencyKey: z.string().trim().min(1).max(200).optional(),
});

export const pointsCreditSchema = transactionSchema;
export const pointsDebitSchema = transactionSchema.omit({ idempotencyKey: true });

export const pointsBulkCreditSchema = z.object({
  membershipIds: z.array(z.string().regex(/^[a-f\d]{24}$/i)).min(1).max(500).optional(),
  filter: z.object({ planSlug: z.string().trim().min(1).max(80) }).optional(),
  amount: positiveInteger,
  reason: z.string().trim().min(1).max(500),
}).refine((body) => Boolean(body.membershipIds?.length) !== Boolean(body.filter), {
  message: 'Provide either membershipIds or a planSlug filter.',
});

export const pointsUserParamsSchema = z.object({
  userId: z.string().regex(/^[a-f\d]{24}$/i, 'User ID is invalid.'),
});
