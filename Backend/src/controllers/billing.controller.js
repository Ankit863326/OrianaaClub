import * as billingService from '../services/billing.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const check = asyncHandler(async (request, response) => {
  const data = await billingService.checkMember(request.validated.body);
  response.json({ success: true, data, message: 'Membership details loaded.' });
});

export const redeem = asyncHandler(async (request, response) => {
  const data = await billingService.redeem(request.validated.body, request.billingApiKey._id);
  response.json({ success: true, data, message: 'Points redemption processed.' });
});

export const cancel = asyncHandler(async (request, response) => {
  const data = await billingService.cancelRedemption(request.validated.body);
  response.json({ success: true, data, message: 'Redemption cancellation processed.' });
});

export const balance = asyncHandler(async (request, response) => {
  const data = await billingService.getMemberBalance(request.validated.params.memberCode);
  response.json({ success: true, data, message: 'Member balance loaded.' });
});
