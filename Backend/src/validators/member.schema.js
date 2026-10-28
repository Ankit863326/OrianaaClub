// Phase 2: Validate profile details and family-member changes sent by members.
import { z } from 'zod';
import {
  optionalAnniversaryDateSchema,
  validateFamilyAnniversary,
} from './family-anniversary.schema.js';

const genderSchema = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);
const formBooleanSchema = z.union([
  z.boolean(),
  z.enum(['true', 'false']),
]).transform((value) => value === true || value === 'true');
const dateSchema = z.coerce.date().refine((date) => !Number.isNaN(date.getTime()) && date < new Date(), {
  message: 'Date of birth must be a valid date in the past.',
});
const parentSideSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.enum(['member', 'spouse']).optional(),
);
const promoSchema = z.union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');

export const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: genderSchema,
  countryCode: z.string().trim().min(1).max(8),
  mobile: z.string().trim().min(6).max(20),
  dob: dateSchema,
  interestArea: z.string().trim().min(1).max(100),
  address: z.string().trim().max(1000).optional().default(''),
  parentSide: parentSideSchema,
  agreePromo: promoSchema.optional().default(false),
});

export const planSelectionSchema = z.object({
  planId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership plan ID.'),
});

export const familyPriceQuerySchema = z.object({
  planId: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership plan ID.'),
});

export const familyMemberSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: genderSchema,
  relationship: z.string().trim().min(1).max(40),
  dob: dateSchema.optional().or(z.literal('')),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().default(''),
  workEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  nomineeRole: z.string().trim().max(80).optional().default(''),
  designation: z.string().trim().max(120).optional().default(''),
  address: z.string().trim().max(1000).optional().default(''),
  memberType: z.enum([
    'spouse', 'child', 'father', 'mother', 'nominee_gm', 'nominee_hr', 'nominee',
  ]).optional(),
  isNominee: formBooleanSchema.optional().default(false),
  parentSide: parentSideSchema,
  anniversaryDate: optionalAnniversaryDateSchema,
  wantsOwnMembership: formBooleanSchema.optional().default(false),
}).superRefine((member, context) => {
  const isNominee = member.isNominee || ['nominee', 'nominee_gm', 'nominee_hr'].includes(member.memberType);
  if (!isNominee && !member.dob) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['dob'], message: 'Date of birth is required.' });
  }
  if (isNominee && !member.workEmail) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['workEmail'], message: 'A nominee work email is required.' });
  }
  if (
    (['father', 'mother'].includes(member.memberType)
      || ['father', 'mother'].includes(member.relationship.toLowerCase()))
    && !member.parentSide
  ) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['parentSide'], message: 'Choose whose parent this is.' });
  }
  validateFamilyAnniversary(member, context);
});

export const familyIdSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, 'Invalid family member ID.'),
});
