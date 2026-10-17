// Phase 1: Verify registration CAPTCHA responses with Google's siteverify API.
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

export async function verifyRecaptcha(token) {
  if (!env.recaptchaSecretKey) {
    if (env.nodeEnv !== 'production') {
      console.warn('[recaptcha] Secret key is empty; skipping verification in development.');
      return;
    }
    throw new ApiError(503, 'Registration verification is temporarily unavailable.');
  }

  if (!token) {
    throw new ApiError(400, 'Please complete the reCAPTCHA check.');
  }

  let response;
  try {
    response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: env.recaptchaSecretKey, response: token }),
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(502, 'Registration verification is temporarily unavailable. Please try again.');
  }

  if (!response.ok) {
    throw new ApiError(502, 'Registration verification is temporarily unavailable. Please try again.');
  }

  const result = await response.json();
  if (!result.success) {
    throw new ApiError(400, 'The reCAPTCHA check failed. Please try again.');
  }
}
