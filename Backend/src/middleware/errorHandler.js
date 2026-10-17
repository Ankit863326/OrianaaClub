// Phase 0: Convert thrown errors into consistent JSON responses.
import { env } from '../config/env.js';

export default function errorHandler(error, request, response, next) {
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
    ? (isSafeApiError ? error.message : 'Internal server error.')
    : error.message || 'Internal server error.';
  const body = { status: 'error', success: false, data: null, message };

  if (env.nodeEnv !== 'production') {
    body.stack = error.stack;
  }

  response.status(statusCode).json(body);
}
