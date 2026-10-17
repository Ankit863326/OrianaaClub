import { Router } from 'express';
import * as paymentController from '../controllers/payment.controller.js';
import auth from '../middleware/auth.js';
import { memberAccessAuth } from '../middleware/membershipOnboardingAuth.js';
import validate from '../middleware/validate.js';
import { familyPhotoUpload } from '../middleware/upload.js';
import * as familyController from '../controllers/family.controller.js';
import {
  familyMemberParamsSchema,
  familyMemberSchema,
  nomineeSchema,
} from '../validators/family.schema.js';
import * as memberReadController from '../controllers/member-read.controller.js';
import {
  emptyQuerySchema,
  memberPointsHistoryQuerySchema,
  memberRedemptionsQuerySchema,
} from '../validators/member-read.schema.js';
import { paymentReceiptParamsSchema } from '../validators/membership-purchase.schema.js';

const router = Router();

router.get('/membership', memberAccessAuth, validate(emptyQuerySchema, 'query'), memberReadController.membership);
router.use(auth);
router.get('/membership/qr', validate(emptyQuerySchema, 'query'), memberReadController.membershipQr);
router.get(
  '/redemptions',
  validate(memberRedemptionsQuerySchema, 'query'),
  memberReadController.redemptions,
);
router.get(
  '/points-history',
  validate(memberPointsHistoryQuerySchema, 'query'),
  memberReadController.pointsHistory,
);
router.get('/payments', paymentController.listMyPayments);
router.get(
  '/payments/:paymentId/receipt',
  validate(paymentReceiptParamsSchema, 'params'),
  paymentController.downloadReceipt,
);
router.get('/family', familyController.listMine);
router.post('/family', familyPhotoUpload, validate(familyMemberSchema), familyController.requestAdd);
router.delete(
  '/family/:familyId',
  validate(familyMemberParamsSchema, 'params'),
  familyController.requestRemove,
);
router.patch('/nominee', validate(nomineeSchema), familyController.requestNominee);

export default router;
