// Phase 1: Limit repeated account requests by IP address.
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const createLimiter = (windowMs, limit, message) => rateLimit({
  windowMs,
  limit: env.nodeEnv === 'production' ? Math.max(1, Math.floor(limit / 2)) : Math.max(limit, 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message },
});

export const sensitiveAuthLimiter = createLimiter(
  15 * 60 * 1000,
  12,
  'Too many attempts. Please try again in 15 minutes.',
);

export const adminLoginLimiter = createLimiter(
  15 * 60 * 1000,
  12,
  'Too many attempts. Please try again in 15 minutes.',
);

export const adminForgotLimiter = createLimiter(
  15 * 60 * 1000,
  12,
  'Too many attempts. Please try again in 15 minutes.',
);
