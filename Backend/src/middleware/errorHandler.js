// Phase 0: Convert thrown errors into consistent JSON responses.
import { env } from '../config/env.js';
import logger from '../utils/logger.js';

function redactErrorDetails(value) {
  let message = String(value || '');
  const secrets = [
    env.smtpPass,
    env.razorpayKeySecret,
    env.razorpayWebhookSecret,
    env.jwtAccessSecret,
    env.jwtRefreshSecret,
    env.recaptchaSecretKey,
    env.identityDocumentEncryptionKey,
  ].filter((secret) => typeof secret === 'string' && secret.length > 0);
  for (const secret of secrets) message = message.split(secret).join('[redacted]');
  return message
    .replace(/(mongodb(?:\+srv)?:\/\/)[^@\s]+@/gi, '$1[redacted]@')
    .replace(/\bBearer\s+[A-Za-z\d._~+/-]+=*/gi, 'Bearer [redacted]')
    .replace(/((?:password|passwd|token|secret|authorization|cookie)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]');
}

export default function errorHandler(error, request, response, next) {
  const details = redactErrorDetails(error.stack || error.message || 'Unknown error');
  logger.error(`[http] ${request.method} ${request.path}\n${details}`);
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error.code === 'IDENTITY_DOCUMENT_ENCRYPTION_NOT_CONFIGURED') {
    response.status(503).json({ message: error.message });
    return;
  }

  if (error.code === 'PASSWORD_LINK_EMAIL_ALREADY_REGISTERED') {
    response.status(409).json({ message: error.message });
    return;
  }

  const statusCode = Number.isInteger(error.statusCode) ? error.statusCode : 500;
  const isSafeApiError = error.name === 'ApiError'
    && Number.isInteger(error.statusCode)
    && error.statusCode < 500;
  const message = env.nodeEnv === 'production'
    ? (isSafeApiError ? redactErrorDetails(error.message) : 'Internal server error.')
    : redactErrorDetails(error.message || 'Internal server error.');
  const body = { status: 'error', success: false, data: null, message };
  if (isSafeApiError && error.code) body.code = error.code;

  if (env.nodeEnv !== 'production') {
    body.stack = details;
  }

  response.status(statusCode).json(body);
}
