import { Router } from 'express';
import * as membershipsController from '../../controllers/admin/membership-purchase.controller.js';
import validate from '../../middleware/validate.js';
import {
  deactivateMembershipSchema,
  membershipIdParamsSchema,
  verificationDocumentParamsSchema,
} from '../../validators/membership-purchase.schema.js';

const router = Router();
router.get('/:id/verification-documents/:documentId', validate(verificationDocumentParamsSchema, 'params'), membershipsController.getVerificationDocument);
router.patch('/:id/approve-verification', validate(membershipIdParamsSchema, 'params'), membershipsController.approveVerification);
router.patch('/:id/deactivate', validate(membershipIdParamsSchema, 'params'), validate(deactivateMembershipSchema), membershipsController.deactivate);

export default router;
