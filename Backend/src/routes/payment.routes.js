// Expose rate-limited, authenticated member payment endpoints.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as paymentController from '../controllers/payment.controller.js';
import { memberAccessAuth } from '../middleware/membershipOnboardingAuth.js';
import validate from '../middleware/validate.js';
import {
  createPaymentOrderSchema,
  membershipPaymentParamsSchema,
  verifyPaymentSchema,
} from '../validators/payment.schema.js';

const router = Router();
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment attempts. Please try again later.' },
});

router.use(memberAccessAuth);
router.get('/memberships/:membershipId', validate(membershipPaymentParamsSchema, 'params'), paymentController.getMembership);
router.post('/create-order', paymentLimiter, validate(createPaymentOrderSchema), paymentController.createOrder);
router.post('/verify', paymentLimiter, validate(verifyPaymentSchema), paymentController.verifyPayment);

export default router;
