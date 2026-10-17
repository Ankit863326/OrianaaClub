import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as membershipPurchaseController from '../controllers/membership-purchase.controller.js';
import { memberAccessAuth } from '../middleware/membershipOnboardingAuth.js';
import { verificationDocumentUpload } from '../middleware/upload.js';
import validate from '../middleware/validate.js';
import {
  membershipPaymentVerificationSchema,
  membershipPaymentOrderSchema,
  membershipPurchaseSchema,
  membershipRenewalSchema,
} from '../validators/membership-purchase.schema.js';

const router = Router();
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many payment attempts. Please try again later.' },
});

router.get('/plans', membershipPurchaseController.listPlans);
router.get('/gst-settings', membershipPurchaseController.publicGstSettings);
router.use(memberAccessAuth);
router.get('/bank-details', membershipPurchaseController.bankDetails);
router.post('/purchase', paymentLimiter, validate(membershipPurchaseSchema), membershipPurchaseController.purchase);
router.post('/renew', paymentLimiter, validate(membershipRenewalSchema), membershipPurchaseController.renew);
router.post('/razorpay/order', paymentLimiter, validate(membershipPaymentOrderSchema), membershipPurchaseController.createRazorpayOrder);
router.post('/razorpay/verify', paymentLimiter, validate(membershipPaymentVerificationSchema), membershipPurchaseController.verifyRazorpay);
router.post('/verification-document', verificationDocumentUpload, membershipPurchaseController.uploadVerificationDocument);

export default router;
