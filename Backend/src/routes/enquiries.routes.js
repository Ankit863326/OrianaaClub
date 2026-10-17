// Phase 5b: Rate-limit and validate public contact requests before storing them.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { create } from '../controllers/enquiries.controller.js';
import validate from '../middleware/validate.js';
import { enquiryCreateSchema } from '../validators/content.schema.js';

const router = Router();
const enquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, message: 'Too many enquiries. Please try again in an hour.' },
});
router.post('/', enquiryLimiter, validate(enquiryCreateSchema), create);
export default router;
