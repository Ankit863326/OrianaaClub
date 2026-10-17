// Phase 5a: Restrict dashboard metrics to authenticated administrators.
import { Router } from 'express';
import { getDashboard } from '../../controllers/admin/dashboard.controller.js';
import validate from '../../middleware/validate.js';
import { paginationSchema } from '../../validators/admin.schema.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), getDashboard);

export default router;
