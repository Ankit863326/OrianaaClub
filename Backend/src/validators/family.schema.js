import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

export const familyMemberParamsSchema = z.object({ familyId: objectId });
export const membershipFamilyParamsSchema = z.object({ id: objectId });
export const familyMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relation: z.string().trim().min(1).max(40),
  dateOfBirth: z.coerce.date().optional(),
  phone: z.string().trim().max(40).optional().default(''),
});
export const adminFamilyMemberSchema = familyMemberSchema.extend({
  linkedUser: objectId.nullable().optional(),
});
export const nomineeSchema = z.object({ familyMemberId: objectId.nullable() });
export const familyDecisionSchema = z.object({
  reason: z.string().trim().max(1000).optional().default(''),
}).default({});
export const familyRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
export const familyTransferSchema = z.object({
  reason: z.string().trim().min(1, 'A transfer reason is required.').max(1000),
});
