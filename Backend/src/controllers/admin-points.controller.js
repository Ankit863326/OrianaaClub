// Phase 3: Record admin identities on ledger actions and return standard API envelopes.
import * as pointsService from '../services/points.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { recordRequestAction } from '../services/audit.service.js';

export const credit = asyncHandler(async (request, response) => {
  const data = await pointsService.creditActiveMembership({
    ...request.validated.body,
    createdBy: request.user._id,
  });
  await recordRequestAction(request, {
    action: 'points.credit',
    entityType: 'membership',
    entityId: request.validated.body.membershipId,
    summary: `Credited ${request.validated.body.amount} points: ${request.validated.body.reason}`,
  });
  response.json({ success: true, data, message: 'Points credited.' });
});

export const debit = asyncHandler(async (request, response) => {
  const data = await pointsService.debitActiveMembership({
    ...request.validated.body,
    createdBy: request.user._id,
  });
  await recordRequestAction(request, {
    action: 'points.debit',
    entityType: 'membership',
    entityId: request.validated.body.membershipId,
    summary: `Debited ${request.validated.body.amount} points: ${request.validated.body.reason}`,
  });
  response.json({ success: true, data, message: 'Points debited.' });
});

export const bulkCredit = asyncHandler(async (request, response) => {
  const data = await pointsService.bulkCredit({
    ...request.validated.body,
    createdBy: request.user._id,
  });
  await recordRequestAction(request, {
    action: 'points.bulk_credit',
    entityType: 'membership',
    entityId: 'bulk',
    summary: `Bulk points credit: ${data.succeeded}/${data.total} memberships received ${request.validated.body.amount} points. Reason: ${request.validated.body.reason}`,
  });
  response.json({ success: true, data, message: 'Bulk points credit completed.' });
});

export const getUserPoints = asyncHandler(async (request, response) => {
  const data = await pointsService.getAdminPointsForUser(
    request.validated.params.userId,
    request.validated.query,
  );
  response.json({ success: true, data, message: 'Member points history loaded.' });
});
