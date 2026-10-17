import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { webhook } from '../controllers/membership-webhook.controller.js';

const router = Router();
router.post('/', rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
}), webhook);

export default router;
