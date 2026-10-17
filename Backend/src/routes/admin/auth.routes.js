// Admin login and recovery use their own endpoints and session cookies.
import { Router } from 'express';
import * as controller from '../../controllers/admin-auth.controller.js';
import adminAuth from '../../middleware/adminAuth.js';
import { adminForgotLimiter, adminLoginLimiter } from '../../middleware/rateLimit.js';
import validate from '../../middleware/validate.js';
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from '../../validators/auth.schema.js';

const router = Router();

router.post('/login', adminLoginLimiter, validate(loginSchema), controller.login);
router.post('/logout', controller.logout);
router.post('/refresh', controller.refresh);
router.get('/me', adminAuth, controller.me);
router.post('/forgot-password', adminForgotLimiter, validate(forgotPasswordSchema), controller.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), controller.resetPassword);

export default router;
