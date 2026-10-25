import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid application ID.');

export const adminDraftParamsSchema = z.object({ id: objectId });

export const adminDraftsQuerySchema = z.object({
  status: z.enum([
    'draft',
    'payment_pending',
    'paid',
    'password_pending',
    'active',
    'failed',
    'payment_submitted',
    'abandoned',
  ]).optional(),
  needsHelp: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const adminDraftMarkPaidSchema = z.object({
  transactionId: z.string().trim().min(1).max(200),
  note: z.string().trim().max(1000).optional().default(''),
});

export const adminDraftPatchSchema = z.object({
  email: z.string().trim().email().transform((value) => value.toLowerCase()).optional(),
  phone: z.string().trim().min(6).max(30).optional(),
  adminNotes: z.string().trim().max(2000).optional(),
}).refine((value) => Object.keys(value).length > 0, 'At least one draft member field is required.');
