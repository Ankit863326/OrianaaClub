import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');
const familyRelation = z.enum(['wife', 'husband', 'son', 'daughter', 'father', 'mother']);
const documentType = z.enum(['aadhaar_digilocker', 'aadhaar_upload']);
const extraDocumentType = z.enum(['', 'marriage_certificate', 'birth_certificate', 'family_card']);

export const familyVerificationParamsSchema = z.object({ familyId: objectId });
export const familyVerificationCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'Enter the six-digit email code.'),
});
export const familyVerificationDraftSchema = z.object({
  relation: familyRelation,
  docType: documentType,
  extraDocType: extraDocumentType.optional().default(''),
  parentSide: z.enum(['member', 'spouse']).optional(),
  nameOnDocument: z.string().trim().max(120).optional().default(''),
  relationLine: z.string().trim().max(240).optional().default(''),
  applicantAddress: z.string().trim().max(1000).optional().default(''),
});
export const familyVerificationSubmitSchema = familyVerificationDraftSchema.extend({
  aadhaarNumber: z.string().regex(/^\d{12}$/, 'Enter a 12-digit Aadhaar number for duplicate checking.'),
});
export const familyVerificationDecisionSchema = z.object({
  reason: z.string().trim().max(1000).optional().default(''),
});
export const familyVerificationRejectSchema = z.object({
  reason: z.string().trim().min(1, 'A rejection reason is required.').max(1000),
});
export const familyVerificationDocumentTokenSchema = z.object({
  token: z.string().regex(/^[a-f\d]{64}$/i, 'Invalid document link.'),
});
