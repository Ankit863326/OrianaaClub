import { z } from 'zod';
import {
  optionalAnniversaryDateSchema,
  validateFamilyAnniversary,
} from './family-anniversary.schema.js';

const email = z.string().trim().email('Enter a valid email address').transform((value) => value.toLowerCase());
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid membership plan ID.');
const gender = z.enum(['male', 'female', 'other', 'prefer_not_to_say']);
const parentSideSchema = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
  z.enum(['member', 'spouse']).optional(),
);
const formBoolean = z.union([z.boolean(), z.enum(['true', 'false'])])
  .transform((value) => value === true || value === 'true');
const validateFamilyDraft = (member, context) => {
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
};
const familyDraftFields = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(120),
  gender: gender.default('prefer_not_to_say'),
  relationship: z.string().trim().min(1).max(40),
  dob: z.coerce.date().refine((value) => value < new Date(), 'Date of birth must be in the past.').optional().or(z.literal('')),
  photoUrl: z.string().max(300).optional(),
  memberType: z.enum(['spouse', 'child', 'father', 'mother', 'nominee_gm', 'nominee_hr', 'nominee']).optional(),
  isNominee: formBoolean.optional().default(false),
  parentSide: parentSideSchema,
  anniversaryDate: optionalAnniversaryDateSchema,
  wantsOwnMembership: formBoolean.optional().default(false),
  nomineeRole: z.string().trim().max(80).optional().default(''),
  designation: z.string().trim().max(120).optional().default(''),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  workEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().default(''),
});
const familyDraft = familyDraftFields.superRefine(validateFamilyDraft);

export const startMembershipDraftSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  email,
  profile: z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    gender: gender.optional(),
    countryCode: z.string().trim().max(8).optional(),
    mobile: z.string().trim().max(20).optional(),
    dob: z.string().max(40).optional(),
    interestArea: z.string().trim().max(100).optional(),
  }).optional(),
});

export const verifyDraftOtpSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code sent to your email.'),
});

export const membershipDraftPlanSchema = z.object({ planId: objectId });

export const membershipDraftFamilySchema = z.object({
  members: z.array(familyDraft),
});

export const membershipDraftFamilyIdSchema = z.object({
  id: z.string().uuid(),
});

export const membershipDraftFamilyPriceQuerySchema = z.object({ planId: objectId });

export const membershipDraftFamilyMemberSchema = familyDraftFields
  .omit({ id: true, photoUrl: true })
  .superRefine(validateFamilyDraft);

export const membershipDraftPurchaseSchema = z.object({
  planId: objectId,
  paymentMethod: z.enum(['upi', 'card', 'razorpay', 'bank_transfer', 'cheque', 'rtgs']),
  companyDetails: z.object({
    companyName: z.string().trim().min(1).max(160),
    gstNumber: z.string().trim().min(1).max(30),
    contactPerson: z.string().trim().min(1).max(120),
  }).optional(),
  rtgsDetails: z.object({
    utr: z.string().trim().min(6).max(50).regex(/^[a-z\d/-]+$/i),
    transferDate: z.coerce.date(),
  }).optional(),
}).superRefine((body, context) => {
  if (body.paymentMethod === 'rtgs' && !body.rtgsDetails) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rtgsDetails'],
      message: 'RTGS UTR and transfer date are required.',
    });
  }
});

export const membershipDraftPaymentVerificationSchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(100),
  razorpay_payment_id: z.string().trim().min(1).max(100),
  razorpay_signature: z.string().regex(/^[a-f\d]{64}$/i),
});
