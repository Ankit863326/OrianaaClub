// Phase 2: Define authenticated, ownership-scoped profile and family routes.
import { Router } from 'express';
import * as memberController from '../controllers/member.controller.js';
import * as identityController from '../controllers/identity-verification.controller.js';
import { getMyPoints } from '../controllers/points.controller.js';
import { memberAccessAuth } from '../middleware/membershipOnboardingAuth.js';
import identityDocumentLimiter from '../middleware/identityDocumentLimiter.js';
import { familyPhotoUpload, identityDocumentUpload, profilePhotoUpload } from '../middleware/upload.js';
import validate from '../middleware/validate.js';
import { familyIdSchema, familyMemberSchema, planSelectionSchema, profileSchema } from '../validators/member.schema.js';
import { pointsHistorySchema } from '../validators/points.schema.js';

const router = Router();
router.use(memberAccessAuth);
router.get('/me', memberController.getMe);
router.get('/identity-verification', identityController.getMine);
router.put('/identity-verification', identityDocumentLimiter, identityDocumentUpload, identityController.submitMine);
router.get('/points', validate(pointsHistorySchema, 'query'), getMyPoints);
router.put('/profile', profilePhotoUpload, validate(profileSchema), memberController.saveProfile);
router.put('/plan', validate(planSelectionSchema), memberController.savePlan);
router.post('/checkout/quote', validate(planSelectionSchema), memberController.getMembershipCheckoutQuote);
router.post('/checkout', validate(planSelectionSchema), memberController.startMembershipPayment);
router.get('/family', memberController.listFamily);
router.post('/family', familyPhotoUpload, validate(familyMemberSchema), memberController.addFamily);
router.put('/family/:id', familyPhotoUpload, validate(familyIdSchema, 'params'), validate(familyMemberSchema), memberController.updateFamily);
router.delete('/family/:id', validate(familyIdSchema, 'params'), memberController.deleteFamily);

export default router;
