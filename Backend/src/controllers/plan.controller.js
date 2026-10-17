// Phase 2: Return active plans using the standard API response shape.
import { findActivePlan, listActivePlans } from '../services/plan.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const listPlans = asyncHandler(async (request, response) => {
  const plans = await listActivePlans();
  response.json({ success: true, data: plans, message: 'Membership plans loaded.' });
});

export const getPlan = asyncHandler(async (request, response) => {
  const plan = await findActivePlan(request.params.slug);
  response.json({ success: true, data: plan, message: 'Membership plan loaded.' });
});
