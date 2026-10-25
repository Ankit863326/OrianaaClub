import { Router } from 'express';
import * as draftsController from '../../controllers/admin/drafts.controller.js';
import validate from '../../middleware/validate.js';
import {
  adminDraftMarkPaidSchema,
  adminDraftParamsSchema,
  adminDraftPatchSchema,
  adminDraftsQuerySchema,
} from '../../validators/admin-drafts.schema.js';

const router = Router();

router.get('/', validate(adminDraftsQuerySchema, 'query'), draftsController.list);
router.post('/:id/resend-link', validate(adminDraftParamsSchema, 'params'), draftsController.resendLink);
router.post('/:id/mark-paid', validate(adminDraftParamsSchema, 'params'), validate(adminDraftMarkPaidSchema), draftsController.markPaid);
router.post('/:id/set-temp-password', validate(adminDraftParamsSchema, 'params'), draftsController.setTemporaryPassword);
router.patch('/:id', validate(adminDraftParamsSchema, 'params'), validate(adminDraftPatchSchema), draftsController.update);
router.post('/:id/activate', validate(adminDraftParamsSchema, 'params'), draftsController.activate);
router.delete('/:id', validate(adminDraftParamsSchema, 'params'), draftsController.remove);

export default router;
