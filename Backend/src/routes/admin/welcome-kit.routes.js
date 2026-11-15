import { Router } from 'express';
import { z } from 'zod';
import * as welcomeKitController from '../../controllers/admin/welcome-kit.controller.js';
import validate from '../../middleware/validate.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i);
const paramsSchema = z.object({ id: objectId });
const querySchema = z.object({
  status: z.enum(['pending', 'dispatched', 'not_home', 'delivered']).optional(),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});
const dispatchSchema = z.object({ staff: z.string().trim().min(1).max(120) });
const notHomeSchema = z.object({ note: z.string().trim().max(500).optional().default('') });
const deliverSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Delivery code must contain six digits.') });

const router = Router();

router.get('/', validate(querySchema, 'query'), welcomeKitController.list);
router.patch('/:id/dispatch', validate(paramsSchema, 'params'), validate(dispatchSchema), welcomeKitController.dispatch);
router.patch('/:id/not-home', validate(paramsSchema, 'params'), validate(notHomeSchema), welcomeKitController.notHome);
router.post('/:id/deliver', validate(paramsSchema, 'params'), validate(deliverSchema), welcomeKitController.deliver);

export default router;
