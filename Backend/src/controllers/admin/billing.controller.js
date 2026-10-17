import * as billingService from '../../services/billing.service.js';
import asyncHandler from '../../utils/asyncHandler.js';
import { recordRequestAction } from '../../services/audit.service.js';

export const createApiKey = asyncHandler(async (request, response) => {
  const data = await billingService.createBillingApiKey(request.user._id, request.validated.body.name);
  await recordRequestAction(request, {
    action: 'billing.api_key.create',
    entityType: 'api_key',
    entityId: data.id,
    summary: `Created billing API key "${data.name}".`,
  });
  response.status(201).json({ success: true, data, message: 'API key created. Copy it now; it will not be shown again.' });
});

export const listApiKeys = asyncHandler(async (request, response) => {
  const data = await billingService.listBillingApiKeys();
  response.json({ success: true, data, message: 'Billing API keys loaded.' });
});

export const revokeApiKey = asyncHandler(async (request, response) => {
  const data = await billingService.revokeBillingApiKey(request.validated.params.id);
  await recordRequestAction(request, {
    action: 'billing.api_key.revoke',
    entityType: 'api_key',
    entityId: data._id,
    summary: `Revoked billing API key "${data.name}".`,
  });
  response.json({ success: true, data, message: 'API key revoked.' });
});

export const adjustPoints = asyncHandler(async (request, response) => {
  const data = await billingService.adjustPoints(
    request.validated.params.id,
    request.validated.body,
  );
  await recordRequestAction(request, {
    action: 'membership.points.adjust',
    entityType: 'membership',
    entityId: data.membership,
    summary: `${request.validated.body.direction === '+' ? 'Added' : 'Removed'} ${request.validated.body.amount} points.`,
    after: { balanceAfter: data.balanceAfter },
    reason: request.validated.body.reason,
  });
  response.json({ success: true, data, message: 'Membership points adjusted.' });
});

export const lookupMembership = asyncHandler(async (request, response) => {
  const data = await billingService.lookupMembership(request.validated.query.q);
  response.json({ success: true, data, message: 'Membership lookup completed.' });
});

export const listRedemptions = asyncHandler(async (request, response) => {
  const data = await billingService.listRedemptions(request.validated.query);
  response.json({ success: true, data, message: 'Redemptions loaded.' });
});

export const cancelRedemption = asyncHandler(async (request, response) => {
  const data = await billingService.cancelAdminRedemption(
    request.validated.params.id,
    request.validated.body.cancelledAt,
  );
  await recordRequestAction(request, {
    action: 'redemption.cancel',
    entityType: 'redemption',
    entityId: request.validated.params.id,
    summary: 'Administrator cancelled a points redemption.',
    after: { status: data.status, refundedPoints: data.refundedPoints },
  });
  response.json({ success: true, data, message: 'Redemption cancelled.' });
});

export const membershipLedger = asyncHandler(async (request, response) => {
  const data = await billingService.getMembershipLedger(
    request.validated.params.id,
    request.validated.query,
  );
  response.json({ success: true, data, message: 'Membership points ledger loaded.' });
});
