import { Router } from 'express';
import * as draftController from '../controllers/membership-draft.controller.js';
import membershipDraftAuth from '../middleware/membershipDraftAuth.js';
import membershipDraftOpen from '../middleware/membershipDraftOpen.js';
import identityDocumentLimiter from '../middleware/identityDocumentLimiter.js';
import { sensitiveAuthLimiter } from '../middleware/rateLimit.js';
import { familyPhotoUpload, identityDocumentUpload, profilePhotoUpload } from '../middleware/upload.js';
import validate from '../middleware/validate.js';
import {
  membershipDraftFamilyIdSchema,
  membershipDraftFamilyMemberSchema,
  membershipDraftFamilyPriceQuerySchema,
  membershipDraftFamilySchema,
  membershipDraftPaymentVerificationSchema,
  membershipDraftPlanSchema,
  membershipDraftPurchaseSchema,
  startMembershipDraftSchema,
  verifyDraftOtpSchema,
} from '../validators/membership-draft.schema.js';
import { profileSchema } from '../validators/member.schema.js';
import { passwordLinkSchema } from '../validators/auth.schema.js';

const router = Router();

router.post('/start', sensitiveAuthLimiter, validate(startMembershipDraftSchema), draftController.start);
router.get('/bank-details', draftController.bankDetails);
router.use(membershipDraftAuth);
router.get('/', draftController.get);
router.post('/password-link', sensitiveAuthLimiter, validate(passwordLinkSchema), draftController.requestPasswordLink);
router.use(membershipDraftOpen);
router.post('/verify-otp', sensitiveAuthLimiter, validate(verifyDraftOtpSchema), draftController.verifyOtp);
router.post('/resend-otp', sensitiveAuthLimiter, draftController.resendOtp);
router.put('/profile', profilePhotoUpload, validate(profileSchema), draftController.saveProfile);
router.put('/identity-verification', identityDocumentLimiter, identityDocumentUpload, draftController.saveIdentity);
router.put('/plan', validate(membershipDraftPlanSchema), draftController.savePlan);
router.post('/quote', validate(membershipDraftPlanSchema), draftController.quote);
router.get(
  '/family-prices',
  validate(membershipDraftFamilyPriceQuerySchema, 'query'),
  draftController.familyPrices,
);
router.put('/family', validate(membershipDraftFamilySchema), draftController.saveFamily);
router.post('/family', familyPhotoUpload, validate(membershipDraftFamilyMemberSchema), draftController.addFamily);
router.put(
  '/family/:id',
  familyPhotoUpload,
  validate(membershipDraftFamilyIdSchema, 'params'),
  validate(membershipDraftFamilyMemberSchema),
  draftController.updateFamily,
);
router.delete('/family/:id', validate(membershipDraftFamilyIdSchema, 'params'), draftController.deleteFamily);
router.post('/purchase', validate(membershipDraftPurchaseSchema), draftController.purchase);
router.post(
  '/razorpay/verify',
  validate(membershipDraftPaymentVerificationSchema),
  draftController.verifyRazorpay,
);

export default router;
