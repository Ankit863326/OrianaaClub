// Phase 5b: Validate public content, admin editing, and enquiry requests.
import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'A valid record id is required.');
const slug = z.string().trim().min(2).max(180).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i);
const pagination = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
const optionalDate = z.string().trim().refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Dates must be valid and use YYYY-MM-DD.').optional();
const uploadedImagePath = z.string().regex(
  /^\/media\/[a-f\d-]+\.(?:jpg|png|webp)$/i,
  'Choose a supported uploaded image.',
).optional();

export const slugParamsSchema = z.object({ slug });
export const contentIdParamsSchema = z.object({ id: objectId });

const postFields = z.object({
  title: z.string().trim().min(2).max(180),
  slug,
  excerpt: z.string().trim().min(2).max(500),
  content: z.string().trim().min(2).max(50000),
  category: z.string().trim().min(1).max(80),
  status: z.enum(['draft', 'published']),
  coverImage: uploadedImagePath,
});
export const postCreateSchema = postFields;
export const postPatchSchema = postFields.partial().refine((body) => Object.keys(body).length > 0, 'At least one post field is required.');

const eventFields = z.object({
  title: z.string().trim().min(2).max(180),
  slug,
  description: z.string().trim().min(2).max(5000),
  date: z.coerce.date(),
  time: z.string().trim().max(80).optional(),
  location: z.string().trim().min(2).max(180),
  image: uploadedImagePath,
  status: z.enum(['draft', 'published', 'cancelled']),
  capacity: z.union([z.coerce.number().int().positive(), z.literal('').transform(() => undefined)]).optional(),
});
export const eventCreateSchema = eventFields;
export const eventPatchSchema = eventFields.partial().refine((body) => Object.keys(body).length > 0, 'At least one event field is required.');

export const publicPostsQuerySchema = pagination.extend({ category: z.string().trim().max(80).optional() });
export const adminPostsQuerySchema = publicPostsQuerySchema.extend({ status: z.enum(['draft', 'published']).optional() });
export const adminEventsQuerySchema = pagination.extend({ status: z.enum(['draft', 'published', 'cancelled']).optional() });
export const enquiryCreateSchema = z.object({
  type: z.enum(['experience', 'contact', 'query', 'other']),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
  mobile: z.string().trim().max(30).optional().default(''),
  message: z.string().trim().min(2).max(5000),
  extra: z.record(z.union([z.string().max(1000), z.number(), z.boolean()])).optional().default({}),
  recaptchaToken: z.string().max(5000).optional().default(''),
});
export const enquiriesQuerySchema = pagination.extend({
  type: z.enum(['experience', 'contact', 'query', 'other']).optional(),
  status: z.enum(['new', 'contacted', 'closed']).optional(),
  search: z.string().trim().max(100).optional(),
  from: optionalDate,
  to: optionalDate,
}).refine(({ from, to }) => !from || !to || from <= to, 'The start date must be before the end date.');
export const enquiryStatusSchema = z.object({ status: z.enum(['new', 'contacted', 'closed']) });
export const enquiryNoteSchema = z.object({ note: z.string().trim().min(1).max(2000) });
export const adminsQuerySchema = pagination.extend({
  status: z.enum(['pending', 'active', 'suspended']).optional(),
  search: z.string().trim().max(100).optional(),
});
export const adminCreateSchema = z.object({
  firstName: z.string().trim().min(2).max(50),
  email: z.string().trim().email().max(254).transform((value) => value.toLowerCase()),
});
export const adminStatusSchema = z.object({ status: z.enum(['active', 'suspended']) });
export const auditQuerySchema = pagination.extend({
  admin: objectId.optional(),
  actor: z.string().trim().max(100).optional(),
  action: z.string().trim().max(80).optional(),
  entityType: z.string().trim().max(80).optional(),
  from: optionalDate,
  to: optionalDate,
}).refine(({ from, to }) => !from || !to || from <= to, 'The start date must be before the end date.');
export const emailLogsQuerySchema = pagination.extend({
  status: z.enum(['sent', 'failed']).optional(),
  template: z.string().trim().max(100).optional(),
  search: z.string().trim().max(254).optional(),
  from: optionalDate,
  to: optionalDate,
}).refine(({ from, to }) => !from || !to || from <= to, 'The start date must be before the end date.');
export const reportQuerySchema = z.object({
  from: optionalDate,
  to: optionalDate,
}).refine(({ from, to }) => !from || !to || from <= to, 'The start date must be before the end date.');
export const reportExportSchema = z.object({
  report: z.enum(['members-by-plan', 'revenue-by-month', 'points-by-month']),
  from: optionalDate,
  to: optionalDate,
}).refine(({ from, to }) => !from || !to || from <= to, 'The start date must be before the end date.');
