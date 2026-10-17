import * as identityService from '../services/identity-verification.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const getMine = asyncHandler(async (request, response) => {
  const data = await identityService.getMemberIdentityVerification(request.user._id);
  response.json({ success: true, data, message: 'Identity verification status loaded.' });
});

export const submitMine = asyncHandler(async (request, response) => {
  try {
    const data = await identityService.submitMemberIdentityVerification(
      request.user._id,
      request.validated.body,
      request.identityDocuments,
    );
    response.status(201).json({ success: true, data, message: 'Identity documents submitted for review.' });
  } catch (error) {
    await identityService.discardUncommittedIdentityDocuments(request.identityDocuments);
    throw error;
  }
});
