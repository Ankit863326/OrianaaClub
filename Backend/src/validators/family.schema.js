import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier.');

export const familyMemberParamsSchema = z.object({ familyId: objectId });
export const membershipFamilyParamsSchema = z.object({ id: objectId });
export const familyMemberSchema = z.object({
  name: z.string().trim().min(1).max(120),
  relation: z.string().trim().min(1).max(40),
  dateOfBirth: z.coerce.date().optional(),
  phone: z.string().trim().max(40).optional().default(''),
  email: z.string().trim().email().max(254).optional().or(z.literal('')),
  gender: z.enum(['male', 'female', 'other', 'prefer_not_to_say']).optional(),
  address: z.string().trim().max(1000).optional().default(''),
  workEmail: z.string().trim().email().max(254).optional().or(z.literal('')),
  nomineeRole: z.string().trim().max(80).optional().default(''),
  designation: z.string().trim().max(120).optional().default(''),
  parentSide: z.enum(['member', 'spouse']).optional(),
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
