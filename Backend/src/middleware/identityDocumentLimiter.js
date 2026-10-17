import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

const development = env.nodeEnv !== 'production';

export default rateLimit({
  windowMs: env.docRateWindowMinutes * 60 * 1000,
  limit: development ? 1000 : env.docRateMax,
  standardHeaders: true,
  legacyHeaders: false,
  skipFailedRequests: true,
  keyGenerator: (request) => {
    const owner = request.membershipDraft?._id || request.user?._id || 'anonymous';
    return `${owner}:${request.ip}`;
  },
  handler: (request, response) => {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((request.rateLimit.resetTime.getTime() - Date.now()) / 1000),
    );
    response.set('Retry-After', String(retryAfterSeconds));
    response.status(429).json({
      status: 'error',
      success: false,
      data: null,
      message: `Too many identity document submissions. Try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      retryAfterSeconds,
    });
  },
});
