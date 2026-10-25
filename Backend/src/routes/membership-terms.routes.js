import { Router } from 'express';
import * as termsController from '../controllers/membership-terms.controller.js';
import membershipDraftAuth from '../middleware/membershipDraftAuth.js';
import membershipDraftOpen from '../middleware/membershipDraftOpen.js';
import { memberAccessAuth } from '../middleware/membershipOnboardingAuth.js';
import validate from '../middleware/validate.js';
import { membershipApplicationIdSchema, termsConsentSchema } from '../validators/terms.schema.js';

const router = Router();

router.use((request, response, next) => (
  request.cookies?.oc_access || request.cookies?.oc_onboarding
    ? memberAccessAuth(request, response, next)
    : membershipDraftAuth(request, response, next)
));
router.get('/:id', validate(membershipApplicationIdSchema, 'params'), termsController.get);
router.post(
  '/:id/terms-consent',
  (request, response, next) => (request.membershipDraft
    ? membershipDraftOpen(request, response, next)
    : next()),
  validate(membershipApplicationIdSchema, 'params'),
  validate(termsConsentSchema),
  termsController.createConsent,
);

export default router;
