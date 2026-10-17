// Phase 5a: Define administrator-only plan list and edit routes.
import { Router } from 'express';
import * as plansController from '../../controllers/admin/plans.controller.js';
import validate from '../../middleware/validate.js';
import { idParamsSchema, paginationSchema, planBodySchema, planPatchSchema } from '../../validators/admin.schema.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), plansController.list);
router.post('/', validate(planBodySchema, 'body'), plansController.create);
router.patch('/:id', validate(idParamsSchema, 'params'), validate(planPatchSchema, 'body'), plansController.update);

export default router;
