// Phase 1: Validate authentication requests and enforce password confirmation.
import { z } from 'zod';

const emailSchema = z.string().trim().email('Enter a valid email address').transform((email) => email.toLowerCase());
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[0-9]/, 'Password must include a number');

const passwordPairSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
});

const requireMatchingPasswords = (schema) => schema.refine((values) => values.password === values.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const registerSchema = z.object({
  firstName: z.string().trim().min(2, 'First name must be at least 2 characters').max(50, 'First name cannot exceed 50 characters'),
  email: emailSchema,
  recaptchaToken: z.string().max(4096).optional().default(''),
});

export const resendActivationSchema = z.object({ email: emailSchema });
export const passwordLinkSchema = z.object({ email: emailSchema });
const emailTokenSchema = z.string()
  .trim()
  .min(1, 'Password link token is required')
  .transform((token) => token.toLowerCase());

export const activateVerifySchema = z.object({ token: emailTokenSchema });
export const activateSchema = requireMatchingPasswords(z.object({
  token: emailTokenSchema,
  ...passwordPairSchema.shape,
}));
export const setOnboardingPasswordSchema = requireMatchingPasswords(passwordPairSchema);
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = requireMatchingPasswords(z.object({
  token: z.string().min(1, 'Password reset token is required'),
  ...passwordPairSchema.shape,
}));
