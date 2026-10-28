// Phase 1: Limit repeated account requests by IP address.
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import EmailLog from '../models/EmailLog.js';
import AuditLog from '../models/AuditLog.js';

const maskEmail = (email) => {
  const [localPart, domain] = String(email || '').split('@');
  return localPart && domain ? `${localPart[0]}***@${domain}` : '***';
};

const createLimiter = (windowMs, limit, message) => rateLimit({
  windowMs,
  limit: env.nodeEnv === 'production' ? Math.max(1, Math.floor(limit / 2)) : Math.max(limit, 1000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message },
  handler: async (request, response) => {
    if (request.originalUrl.split('?')[0].endsWith('/password-link')) {
      const email = String(request.body?.email || 'unknown@invalid.local').trim().toLowerCase().slice(0, 254);
      try {
        await Promise.all([
          EmailLog.create({
            to: email,
            template: 'activation',
            status: 'failed',
            error: 'Password-link skipped: rate_limit_exceeded',
          }),
          AuditLog.create({
            actorType: 'system',
            action: 'password_link.skipped',
            entityType: 'membership_password_link',
            entityId: 'unknown',
            summary: `Password setup email skipped for ${maskEmail(email)}.`,
            reason: 'rate_limit_exceeded',
            ip: String(request.ip || '').slice(0, 100),
          }),
        ]);
      } catch (error) {
        console.error('[auth] Failed to record password-link rate limit.', error);
      }
    }
    response.status(429).json({ status: 'error', message });
  },
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
