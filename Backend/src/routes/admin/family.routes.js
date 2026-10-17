import { Router } from 'express';
import * as familyController from '../../controllers/family.controller.js';
import {
  familyPhotoUpload,
  optionalFamilyIdProofUpload,
  verificationDocumentUpload,
} from '../../middleware/upload.js';
import validate from '../../middleware/validate.js';
import {
  familyDecisionSchema,
  adminFamilyMemberSchema,
  familyMemberParamsSchema,
  familyMemberSchema,
  familyRequestsQuerySchema,
  membershipFamilyParamsSchema,
  nomineeSchema,
  familyTransferSchema,
} from '../../validators/family.schema.js';
import { membershipIdParamsSchema } from '../../validators/membership-purchase.schema.js';

const router = Router();

router.get('/family-requests', validate(familyRequestsQuerySchema, 'query'), familyController.listRequests);
router.patch(
  '/family-requests/:familyId/approve',
  validate(familyMemberParamsSchema, 'params'),
  validate(familyDecisionSchema),
  familyController.decideRequest(true),
);
router.patch(
  '/family-requests/:familyId/reject',
  validate(familyMemberParamsSchema, 'params'),
  validate(familyDecisionSchema),
  familyController.decideRequest(false),
);
router.get(
  '/family/:familyId/id-proof',
  validate(familyMemberParamsSchema, 'params'),
  familyController.getFamilyIdProof,
);
router.get(
  '/memberships/:id/transfer-document',
  validate(membershipFamilyParamsSchema, 'params'),
  familyController.getTransferDocument,
);
router.patch(
  '/family/:familyId',
  validate(familyMemberParamsSchema, 'params'),
  optionalFamilyIdProofUpload,
  validate(adminFamilyMemberSchema.partial()),
  familyController.updateFamily,
);
router.delete(
  '/family/:familyId',
  validate(familyMemberParamsSchema, 'params'),
  validate(familyDecisionSchema),
  familyController.removeFamily,
);
router.get(
  '/memberships/:id/family',
  validate(membershipFamilyParamsSchema, 'params'),
  familyController.listMembershipFamily,
);
router.post(
  '/memberships/:id/family',
  validate(membershipFamilyParamsSchema, 'params'),
  familyPhotoUpload,
  validate(adminFamilyMemberSchema),
  familyController.addMembershipFamily,
);
router.patch(
  '/memberships/:id/nominee',
  validate(membershipFamilyParamsSchema, 'params'),
  validate(nomineeSchema),
  familyController.setNominee,
);
router.post(
  '/memberships/:id/transfer-to-nominee',
  validate(membershipIdParamsSchema, 'params'),
  verificationDocumentUpload,
  validate(familyTransferSchema),
  familyController.transferToNominee,
);

export default router;
