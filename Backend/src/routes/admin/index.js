// Phase 3: Require a logged-in administrator for all administrative APIs.
import { Router } from 'express';
import adminAuth from '../../middleware/adminAuth.js';
import adminCsrf from '../../middleware/adminCsrf.js';
import authRoutes from './auth.routes.js';
import membersRoutes from './members.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import plansRoutes from './plans.routes.js';
import paymentsRoutes from './payments.routes.js';
import pointsRoutes from './points.routes.js';
import contentRoutes from './content.routes.js';
import adminsRoutes from './admins.routes.js';
import operationsRoutes from './operations.routes.js';
import membershipsRoutes from './memberships.routes.js';
import familyRoutes from './family.routes.js';
import billingAdminRoutes from './billing.routes.js';
import membershipConsoleRoutes from './membership-console.routes.js';

const router = Router();

router.use(adminCsrf);
router.use('/auth', authRoutes);
router.use(adminAuth);
router.use('/points', pointsRoutes);
router.use('/members', membersRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/plans', plansRoutes);
router.use('/payments', paymentsRoutes);
router.use('/memberships', membershipsRoutes);
router.use('/', billingAdminRoutes);
router.use('/', familyRoutes);
router.use('/', membershipConsoleRoutes);
router.use('/posts', contentRoutes.posts);
router.use('/events', contentRoutes.events);
router.use('/enquiries', contentRoutes.enquiries);
router.use('/admins', adminsRoutes);
router.use('/', operationsRoutes);

export default router;
