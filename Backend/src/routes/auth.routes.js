// Phase 1: Define account routes with validation and abuse limits.
import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import auth from '../middleware/auth.js';
import { membershipOnboardingAuth } from '../middleware/membershipOnboardingAuth.js';
import { sensitiveAuthLimiter } from '../middleware/rateLimit.js';
import validate from '../middleware/validate.js';
import {
  activateSchema,
  activateVerifySchema,
  forgotPasswordSchema,
  loginSchema,
  passwordLinkSchema,
  resendActivationSchema,
  resetPasswordSchema,
  setOnboardingPasswordSchema,
} from '../validators/auth.schema.js';

const router = Router();

router.post('/resend-activation', sensitiveAuthLimiter, validate(resendActivationSchema), authController.resendActivation);
router.post('/onboarding/password-link', sensitiveAuthLimiter, membershipOnboardingAuth, validate(passwordLinkSchema), authController.requestOnboardingPasswordLink);
router.get('/activate/verify', validate(activateVerifySchema, 'query'), authController.verifyActivation);
router.post('/activate', validate(activateSchema), authController.activate);
router.get('/onboarding/me', membershipOnboardingAuth, authController.onboardingMe);
router.post('/onboarding/set-password', sensitiveAuthLimiter, membershipOnboardingAuth, validate(setOnboardingPasswordSchema), authController.setOnboardingPassword);
router.post('/login', sensitiveAuthLimiter, validate(loginSchema), authController.login);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.me);
router.post('/refresh', authController.refresh);
router.post('/forgot-password', sensitiveAuthLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

export default router;
