// Receive payment-provider callbacks; authenticity is checked against the raw body.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { webhook } from '../controllers/payment.controller.js';

const router = Router();
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/', webhookLimiter, webhook);

export default router;
