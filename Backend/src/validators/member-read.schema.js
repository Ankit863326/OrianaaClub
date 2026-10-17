import { z } from 'zod';

const optionalDate = z.string().trim().optional().refine(
  (value) => !value || !Number.isNaN(Date.parse(value)),
  'Date filter must be a valid date.',
);

const pageFilters = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  from: optionalDate,
  to: optionalDate,
});

export const emptyQuerySchema = z.object({}).strict();

export const memberRedemptionsQuerySchema = pageFilters.extend({
  status: z.enum(['confirmed', 'cancelled']).optional(),
}).refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to), {
  message: 'The from date must be earlier than or equal to the to date.',
});

export const memberPointsHistoryQuerySchema = pageFilters.extend({
  type: z.enum([
    'credit_joining',
    'credit_renewal',
    'debit_redeem',
    'refund',
    'expire',
    'admin_adjust',
  ]).optional(),
}).refine((query) => !query.from || !query.to || new Date(query.from) <= new Date(query.to), {
  message: 'The from date must be earlier than or equal to the to date.',
});
