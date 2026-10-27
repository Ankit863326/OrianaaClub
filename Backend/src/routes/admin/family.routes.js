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
  adminFamilyMemberUpdateSchema,
  familyMemberParamsSchema,
  familyMemberSchema,
  familyRequestsQuerySchema,
  membershipFamilyParamsSchema,
  nomineeSchema,
  familyTransferSchema,
} from '../../validators/family.schema.js';
import { membershipIdParamsSchema } from '../../validators/membership-purchase.schema.js';
import * as familyVerificationController from '../../controllers/family-verification.controller.js';
import {
  familyVerificationDecisionSchema,
  familyVerificationDocumentTokenSchema,
  familyVerificationParamsSchema,
  familyVerificationRejectSchema,
} from '../../validators/family-verification.schema.js';

const router = Router();

router.get('/family-verifications', familyVerificationController.listAdminQueue);
router.get(
  '/family-verifications/documents',
  validate(familyVerificationDocumentTokenSchema, 'query'),
  familyVerificationController.readAdminDocument,
);
router.get(
  '/family-verifications/:familyId',
  validate(familyVerificationParamsSchema, 'params'),
  familyVerificationController.getAdminDetail,
);
router.patch(
  '/family-verifications/:familyId/approve',
  validate(familyVerificationParamsSchema, 'params'),
  validate(familyVerificationDecisionSchema),
  familyVerificationController.decideAdmin('approve'),
);
router.patch(
  '/family-verifications/:familyId/reject',
  validate(familyVerificationParamsSchema, 'params'),
  validate(familyVerificationRejectSchema),
  familyVerificationController.decideAdmin('reject'),
);
router.patch(
  '/family-verifications/:familyId/request-reupload',
  validate(familyVerificationParamsSchema, 'params'),
  validate(familyVerificationRejectSchema),
  familyVerificationController.decideAdmin('request_reupload'),
);

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
  validate(adminFamilyMemberUpdateSchema),
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
