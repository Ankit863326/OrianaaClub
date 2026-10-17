// Phase 5a: Define validated admin member, family, and export endpoints.
import { Router } from 'express';
import * as membersController from '../../controllers/admin/members.controller.js';
import * as pointsController from '../../controllers/admin-points.controller.js';
import validate from '../../middleware/validate.js';
import {
  familyPatchSchema,
  familyParamsSchema,
  manualMemberSchema,
  memberPatchSchema,
  membersQuerySchema,
  userParamsSchema,
} from '../../validators/admin.schema.js';
import { pointsHistorySchema, pointsUserParamsSchema } from '../../validators/points.schema.js';

const router = Router();

router.get('/export', validate(membersQuerySchema, 'query'), membersController.exportCsv);
router.get('/', validate(membersQuerySchema, 'query'), membersController.list);
router.post('/', validate(manualMemberSchema), membersController.create);
router.get('/:userId/points', validate(pointsUserParamsSchema, 'params'), validate(pointsHistorySchema, 'query'), pointsController.getUserPoints);
router.get('/:userId/family', validate(userParamsSchema, 'params'), membersController.familyList);
router.patch('/:userId/family/:familyId', validate(familyParamsSchema, 'params'), validate(familyPatchSchema), membersController.familyUpdate);
router.delete('/:userId/family/:familyId', validate(familyParamsSchema, 'params'), membersController.familyDelete);
router.patch('/:userId', validate(userParamsSchema, 'params'), validate(memberPatchSchema), membersController.update);
router.post('/:userId/suspend', validate(userParamsSchema, 'params'), membersController.suspend);
router.post('/:userId/activate', validate(userParamsSchema, 'params'), membersController.activate);
router.post('/:userId/resend-activation', validate(userParamsSchema, 'params'), membersController.resendActivation);
router.delete('/:userId', validate(userParamsSchema, 'params'), membersController.remove);
router.get('/:userId', validate(userParamsSchema, 'params'), membersController.details);

export default router;
