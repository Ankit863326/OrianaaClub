// Phase 5b: Invite and manage administrator accounts through activation links.
import { Router } from 'express';
import * as controller from '../../controllers/admin/operations.controller.js';
import validate from '../../middleware/validate.js';
import {
  adminCreateSchema,
  adminStatusSchema,
  adminsQuerySchema,
  contentIdParamsSchema,
} from '../../validators/content.schema.js';

const router = Router();
router.get('/', validate(adminsQuerySchema, 'query'), controller.admins);
router.post('/', validate(adminCreateSchema), controller.createAdmin);
router.patch('/:id', validate(contentIdParamsSchema, 'params'), validate(adminStatusSchema), controller.updateAdmin);
export default router;
