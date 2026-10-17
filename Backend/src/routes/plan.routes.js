// Phase 2: Define public read-only routes for active membership plans.
import { Router } from 'express';
import { getPlan, listPlans } from '../controllers/plan.controller.js';

const router = Router();

router.use((request, response, next) => {
  response.set('Cache-Control', 'no-store');
  next();
});

router.get('/', listPlans);
router.get('/:slug', getPlan);

export default router;
