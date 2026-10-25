import { Router } from 'express';
import * as controller from '../../controllers/admin/membership-admin.controller.js';
import validate from '../../middleware/validate.js';
import {
  adminBillParamsSchema,
  approvalQueueQuerySchema,
  cancelAdminBillSchema,
  familyTreeParamsSchema,
  membershipBillsQuerySchema,
  membershipIdParamsSchema,
  membershipPlanIdParamsSchema,
  membershipPlanPatchSchema,
  membershipReportsQuerySchema,
  membershipRenewalSchema,
  membershipSearchQuerySchema,
  membershipSettingsPatchSchema,
  memberLedgerQuerySchema,
  pointsExpiringQuerySchema,
  queueQuerySchema,
  verificationRejectSchema,
} from '../../validators/membership-admin.schema.js';
import {
  identityDocumentParamsSchema,
  identityMembershipParamsSchema,
  identityReviewSchema,
} from '../../validators/identity-verification.schema.js';

const router = Router();
router.get('/early-bird-counter', controller.earlyBirdCounter);
router.get('/membership-plans', controller.listPlans);
router.patch(
  '/membership-plans/:id',
  validate(membershipPlanIdParamsSchema, 'params'),
  validate(membershipPlanPatchSchema),
  controller.updatePlan,
);
router.get('/settings', controller.getSettings);
router.patch('/settings', validate(membershipSettingsPatchSchema), controller.updateSettings);
router.get('/membership-settings', controller.getSettings);
router.patch('/membership-settings', validate(membershipSettingsPatchSchema), controller.updateSettings);
router.get('/memberships', validate(membershipSearchQuerySchema, 'query'), controller.listMemberships);
router.get(
  '/memberships/family-tree/:memberNo',
  validate(familyTreeParamsSchema, 'params'),
  controller.familyTree,
);
router.get('/membership-queue', validate(queueQuerySchema, 'query'), controller.queue);
router.get('/membership-approval-queue', validate(approvalQueueQuerySchema, 'query'), controller.approvalQueue);
router.post(
  '/memberships/:id/approve',
  validate(membershipIdParamsSchema, 'params'),
  controller.approveMembership,
);
router.get('/membership-reports', controller.reports);
router.get(
  '/reports/membership',
  validate(membershipReportsQuerySchema, 'query'),
  controller.membershipReports,
);
router.get('/membership-points-expiring', validate(pointsExpiringQuerySchema, 'query'), controller.pointsExpiring);
router.get('/membership-bills', validate(membershipBillsQuerySchema, 'query'), controller.bills);
router.get('/membership-bills/export', validate(membershipBillsQuerySchema, 'query'), controller.exportBills);
router.get(
  '/memberships/:id/details',
  validate(membershipIdParamsSchema, 'params'),
  controller.membershipDetails,
);
router.get(
  '/memberships/:id/identity-verification',
  validate(identityMembershipParamsSchema, 'params'),
  controller.identityVerificationDetails,
);
router.get(
  '/memberships/:id/identity-documents/:documentId',
  validate(identityDocumentParamsSchema, 'params'),
  controller.identityVerificationDocument,
);
router.patch(
  '/memberships/:id/identity-verification',
  validate(identityMembershipParamsSchema, 'params'),
  validate(identityReviewSchema),
  controller.reviewIdentityVerification,
);
router.get(
  '/memberships/:id/card-qr',
  validate(membershipIdParamsSchema, 'params'),
  controller.membershipQr,
);
router.post(
  '/memberships/:id/renew',
  validate(membershipIdParamsSchema, 'params'),
  validate(membershipRenewalSchema),
  controller.renewMembership,
);
router.patch(
  '/memberships/:id/reject-verification',
  validate(membershipIdParamsSchema, 'params'),
  validate(verificationRejectSchema),
  controller.rejectVerification,
);
router.post(
  '/membership-bills/:id/cancel',
  validate(adminBillParamsSchema, 'params'),
  validate(cancelAdminBillSchema),
  controller.cancelBill,
);
router.get(
  '/memberships/:id/ledger',
  validate(membershipIdParamsSchema, 'params'),
  validate(memberLedgerQuerySchema, 'query'),
  controller.ledger,
);

export default router;
