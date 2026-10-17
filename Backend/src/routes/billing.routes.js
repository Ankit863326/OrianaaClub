import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';
import * as billingController from '../controllers/billing.controller.js';
import billingApiKey from '../middleware/billingApiKey.js';
import validate from '../middleware/validate.js';
import {
  billingCancelSchema,
  billingCheckSchema,
  billingMemberCodeParamsSchema,
  billingRedeemSchema,
} from '../validators/billing.schema.js';

const router = Router();
router.use(rateLimit({
  windowMs: 60 * 1000,
  limit: env.nodeEnv === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Billing API rate limit exceeded.' },
}));
router.use(billingApiKey);
router.post('/check', validate(billingCheckSchema), billingController.check);
// Redeem and cancel accept channel: counter (default), app, or card; counter is stored as billing_counter.
router.post('/redeem', validate(billingRedeemSchema), billingController.redeem);
router.post('/cancel', validate(billingCancelSchema), billingController.cancel);
router.get('/member/:memberCode/balance', validate(billingMemberCodeParamsSchema, 'params'), billingController.balance);

export default router;
