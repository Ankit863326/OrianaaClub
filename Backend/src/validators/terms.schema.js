import { z } from 'zod';

export const membershipApplicationIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership application ID.'),
});

export const termsConsentSchema = z.object({
  version: z.string().trim().min(1).max(20),
  language: z.string().trim().regex(/^[a-z]{2,3}$/i),
  readToEnd: z.boolean(),
});
