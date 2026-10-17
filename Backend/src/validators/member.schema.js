// Phase 2: Validate profile details and family-member changes sent by members.
import { z } from 'zod';

const genderSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);
const dateSchema = z.coerce.date().refine((date) => !Number.isNaN(date.getTime()) && date < new Date(), {
  message: 'Date of birth must be a valid date in the past.',
});
const promoSchema = z.union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: genderSchema,
  countryCode: z.string().trim().min(1).max(8),
  mobile: z.string().trim().min(6).max(20),
  dob: dateSchema,
  interestArea: z.string().trim().min(1).max(100),
  agreePromo: promoSchema.optional().default(false),
});

export const planSelectionSchema = z.object({
  planId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership plan ID.'),
});

export const familyMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: genderSchema,
  relationship: z.string().trim().min(1).max(40),
  dob: dateSchema,
});

export const familyIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid family member ID.'),
});
