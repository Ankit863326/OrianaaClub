// Phase 5a: Apply validated plan edits and record them in the audit log.
import * as adminService from '../../services/admin.service.js';
import { recordRequestAction } from '../../services/audit.service.js';
import asyncHandler from '../../utils/asyncHandler.js';

export const list = asyncHandler(async (request, response) => {
  const data = await adminService.listPlans(request.validated.query);
  response.json({ success: true, data, message: 'Plans loaded.' });
});

export const create = asyncHandler(async (request, response) => {
  const plan = await adminService.createPlan(request.validated.body);
  await recordRequestAction(request, {
    action: 'plan.create', entityType: 'plan', entityId: plan._id,
    summary: `Created membership plan ${plan.title}.`,
  });
  response.status(201).json({ success: true, data: plan, message: 'Plan created.' });
});

export const update = asyncHandler(async (request, response) => {
  const plan = await adminService.updatePlan(request.validated.params.id, request.validated.body);
  await recordRequestAction(request, {
    action: 'plan.update', entityType: 'plan', entityId: plan._id,
    summary: `Updated membership plan ${plan.title}; fields: ${Object.keys(request.validated.body).join(', ')}.`,
  });
  response.json({ success: true, data: plan, message: 'Plan updated.' });
});
