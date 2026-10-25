// Phase 0/1: Expose health status and mount the account API.
import { Router } from 'express';
import mongoose from 'mongoose';
import authRoutes from './auth.routes.js';
import planRoutes from './plan.routes.js';
import memberRoutes from './member.routes.js';
import adminRoutes from './admin/index.js';
import contentRoutes from './content.routes.js';
import enquiriesRoutes from './enquiries.routes.js';
import paymentRoutes from './payment.routes.js';
import webhookRoutes from './webhook.routes.js';
import membershipPurchaseRoutes from './membership-purchase.routes.js';
import membershipWebhookRoutes from './membership-webhook.routes.js';
import meRoutes from './me.routes.js';
import billingRoutes from './billing.routes.js';
import membershipDraftRoutes from './membership-draft.routes.js';
import termsRoutes from './terms.routes.js';
import membershipTermsRoutes from './membership-terms.routes.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/health', (request, response) => {
  const readyState = mongoose.connection.readyState;
  if (env.nodeEnv === 'production') {
    const isReady = readyState === 1;
    response.status(isReady ? 200 : 503).json({ status: isReady ? 'ok' : 'unavailable' });
    return;
  }
  response.json({
    status: 'ok',
    database: readyState === 1 ? 'connected' : readyState === 2 ? 'connecting' : 'disconnected',
  });
});

router.use('/auth', authRoutes);
router.use('/me', meRoutes);
router.use('/billing', billingRoutes);
router.use('/plans', planRoutes);
router.use('/member', memberRoutes);
router.use('/payments/webhook', webhookRoutes);
router.use('/payments', paymentRoutes);
router.use('/membership/draft', membershipDraftRoutes);
router.use('/terms', termsRoutes);
router.use('/membership/applications', membershipTermsRoutes);
router.use('/membership', membershipPurchaseRoutes);
router.use('/webhooks/razorpay', membershipWebhookRoutes);
router.use(contentRoutes);
router.use('/enquiries', enquiriesRoutes);
router.use('/admin', adminRoutes);

export default router;
