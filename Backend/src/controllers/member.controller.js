// Phase 2: Keep member endpoints thin and use only the authenticated account ID.
import * as memberService from '../services/member.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getMe = asyncHandler(async (request, response) => {
  const data = await memberService.getMemberOverview(request.user);
  response.json({ success: true, data, message: 'Member information loaded.' });
});

export const saveProfile = asyncHandler(async (request, response) => {
  const data = await memberService.saveProfile(request.user._id, request.validated.body, request.file);
  response.json({ success: true, data, message: 'Profile saved.' });
});

export const savePlan = asyncHandler(async (request, response) => {
  const data = await memberService.saveDraftPlan(request.user._id, request.validated.body.planId);
  response.json({ success: true, data, message: 'Draft membership plan saved.' });
});

export const startMembershipPayment = asyncHandler(async (request, response) => {
  const data = await memberService.startMembershipPayment(
    request.user._id,
    request.validated.body.planId,
  );
  response.status(201).json({ success: true, data, message: 'Membership saved as pending payment.' });
});

export const getMembershipCheckoutQuote = asyncHandler(async (request, response) => {
  const data = await memberService.getMembershipCheckoutQuote(request.validated.body.planId);
  response.json({ success: true, data, message: 'Membership payment details loaded.' });
});

export const getFamilyPriceBreakdown = asyncHandler(async (request, response) => {
  const data = await memberService.getFamilyPriceBreakdown(request.validated.query.planId);
  response.json({ success: true, data, message: 'Family prices loaded.' });
});

export const listFamily = asyncHandler(async (request, response) => {
  const data = await memberService.listFamilyMembers(request.user._id);
  response.json({ success: true, data, message: 'Family members loaded.' });
});

export const addFamily = asyncHandler(async (request, response) => {
  const data = await memberService.addFamilyMember(request.user._id, request.validated.body, request.file);
  response.status(201).json({ success: true, data, message: 'Family member added.' });
});

export const updateFamily = asyncHandler(async (request, response) => {
  const data = await memberService.updateFamilyMember(
    request.user._id,
    request.validated.params.id,
    request.validated.body,
    request.file,
  );
  response.json({ success: true, data, message: 'Family member updated.' });
});

export const deleteFamily = asyncHandler(async (request, response) => {
  await memberService.deleteFamilyMember(request.user._id, request.validated.params.id);
  response.json({ success: true, data: null, message: 'Family member deleted.' });
});
