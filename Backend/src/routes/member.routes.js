// Phase 2: Define authenticated, ownership-scoped profile and family routes.
import { Router } from 'express';
import * as memberController from '../controllers/member.controller.js';
import * as identityController from '../controllers/identity-verification.controller.js';
import { getMyPoints } from '../controllers/points.controller.js';
import { memberAccessAuth } from '../middleware/membershipOnboardingAuth.js';
import identityDocumentLimiter from '../middleware/identityDocumentLimiter.js';
import { familyPhotoUpload, identityDocumentUpload, profilePhotoUpload } from '../middleware/upload.js';
import validate from '../middleware/validate.js';
import {
  familyIdSchema,
  familyMemberSchema,
  familyPriceQuerySchema,
  planSelectionSchema,
  profileSchema,
} from '../validators/member.schema.js';
import { pointsHistorySchema } from '../validators/points.schema.js';
import * as familyVerificationController from '../controllers/family-verification.controller.js';
import { familyVerificationDocumentUpload } from '../middleware/upload.js';
import {
  familyVerificationCodeSchema,
  familyVerificationDraftSchema,
  familyVerificationParamsSchema,
  familyVerificationSubmitSchema,
} from '../validators/family-verification.schema.js';
import rateLimit from 'express-rate-limit';
import * as familyCheckoutController from '../controllers/family-checkout.controller.js';
import { verifyPaymentSchema } from '../validators/payment.schema.js';

const router = Router();
router.use(memberAccessAuth);
const verificationCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: false,
  legacyHeaders: false,
  message: { success: false, message: 'Too many verification code requests. Please try again later.' },
});
router.get('/me', memberController.getMe);
router.get('/identity-verification', identityController.getMine);
router.put('/identity-verification', identityDocumentLimiter, identityDocumentUpload, identityController.submitMine);
router.get('/points', validate(pointsHistorySchema, 'query'), getMyPoints);
router.put('/profile', profilePhotoUpload, validate(profileSchema), memberController.saveProfile);
router.put('/plan', validate(planSelectionSchema), memberController.savePlan);
router.post('/checkout/quote', validate(planSelectionSchema), memberController.getMembershipCheckoutQuote);
router.get('/family-prices', validate(familyPriceQuerySchema, 'query'), memberController.getFamilyPriceBreakdown);
router.post('/checkout', validate(planSelectionSchema), memberController.startMembershipPayment);
router.get('/family', memberController.listFamily);
router.post('/family', familyPhotoUpload, validate(familyMemberSchema), memberController.addFamily);
router.put('/family/:id', familyPhotoUpload, validate(familyIdSchema, 'params'), validate(familyMemberSchema), memberController.updateFamily);
router.delete('/family/:id', validate(familyIdSchema, 'params'), memberController.deleteFamily);
router.post(
  '/family/:familyId/verification/code',
  verificationCodeLimiter,
  validate(familyVerificationParamsSchema, 'params'),
  familyVerificationController.sendCode,
);
router.post(
  '/family/:familyId/verification/code/confirm',
  validate(familyVerificationParamsSchema, 'params'),
  validate(familyVerificationCodeSchema),
  familyVerificationController.confirmCode,
);
router.put(
  '/family/:familyId/verification/draft',
  validate(familyVerificationParamsSchema, 'params'),
  validate(familyVerificationDraftSchema),
  familyVerificationController.saveDraft,
);
router.post(
  '/family/:familyId/verification/documents',
  validate(familyVerificationParamsSchema, 'params'),
  familyVerificationDocumentUpload,
  validate(familyVerificationSubmitSchema),
  familyVerificationController.submitDocuments,
);
router.get(
  '/family/:familyId/verification',
  validate(familyVerificationParamsSchema, 'params'),
  familyVerificationController.getMine,
);
const familyCheckoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many family payment attempts. Please try again later.' },
});
router.get(
  '/family/:familyId/checkout',
  validate(familyVerificationParamsSchema, 'params'),
  familyCheckoutController.getQuote,
);
router.post(
  '/family/:familyId/checkout',
  familyCheckoutLimiter,
  validate(familyVerificationParamsSchema, 'params'),
  familyCheckoutController.start,
);
router.post(
  '/family/:familyId/checkout/order',
  familyCheckoutLimiter,
  validate(familyVerificationParamsSchema, 'params'),
  familyCheckoutController.createOrder,
);
router.post(
  '/family/:familyId/checkout/confirm',
  familyCheckoutLimiter,
  validate(familyVerificationParamsSchema, 'params'),
  validate(verifyPaymentSchema),
  familyCheckoutController.verify,
);

export default router;
