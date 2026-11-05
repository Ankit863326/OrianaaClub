import { z } from 'zod';

export const memberReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().min(10).max(1200),
});

export const adminMemberReviewsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
