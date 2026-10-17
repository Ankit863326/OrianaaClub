import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

export const identityVerificationSchema = z.object({
  panNumber: z.string().trim().toUpperCase().regex(/^[A-Z]{5}\d{4}[A-Z]$/, 'Enter a valid PAN number (for example, ABCDE1234F).'),
  secondIdType: z.enum(['aadhaar', 'driving_licence', 'passport']),
  secondIdNumber: z.string().trim().min(1).max(30),
  consent: z.literal('true', { errorMap: () => ({ message: 'Consent is required to submit identity documents.' }) }),
});

export const identityMembershipParamsSchema = z.object({ id: objectId });
export const identityDocumentParamsSchema = z.object({
  id: objectId,
  documentId: z.string().uuid(),
});
export const identityReviewSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('verified') }),
  z.object({
    status: z.literal('rejected'),
    reason: z.string().trim().min(1, 'A rejection reason is required.').max(1000),
  }),
]);
