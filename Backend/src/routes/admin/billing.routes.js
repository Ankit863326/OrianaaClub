import { Router } from 'express';
import * as billingController from '../../controllers/admin/billing.controller.js';
import validate from '../../middleware/validate.js';
import {
  adminCancelSchema,
  apiKeyCreateSchema,
  apiKeyParamsSchema,
  membershipAdjustmentParamsSchema,
  membershipLookupQuerySchema,
  membershipLedgerParamsSchema,
  pointsAdjustmentSchema,
  redemptionsQuerySchema,
  redemptionParamsSchema,
} from '../../validators/billing.schema.js';
import { memberLedgerQuerySchema } from '../../validators/membership-admin.schema.js';

const router = Router();
router.post('/api-keys', validate(apiKeyCreateSchema), billingController.createApiKey);
router.get('/api-keys', billingController.listApiKeys);
router.patch('/api-keys/:id/revoke', validate(apiKeyParamsSchema, 'params'), billingController.revokeApiKey);
router.get(
  '/memberships/lookup',
  validate(membershipLookupQuerySchema, 'query'),
  billingController.lookupMembership,
);
router.post(
  '/memberships/:id/adjust-points',
  validate(membershipAdjustmentParamsSchema, 'params'),
  validate(pointsAdjustmentSchema),
  billingController.adjustPoints,
);
router.get(
  '/memberships/:id/ledger',
  validate(membershipLedgerParamsSchema, 'params'),
  validate(memberLedgerQuerySchema, 'query'),
  billingController.membershipLedger,
);
router.get('/redemptions', validate(redemptionsQuerySchema, 'query'), billingController.listRedemptions);
router.post(
  '/redemptions/:id/cancel',
  validate(redemptionParamsSchema, 'params'),
  validate(adminCancelSchema),
  billingController.cancelRedemption,
);

export default router;
