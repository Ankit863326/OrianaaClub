import * as familyVerificationService from '../services/family-verification.service.js';
import asyncHandler from '../utils/asyncHandler.js';

export const sendCode = asyncHandler(async (request, response) => {
  const data = await familyVerificationService.sendFamilyVerificationCode(
    request.user._id,
    request.validated.params.familyId,
    request.ip,
  );
  response.json({ success: true, data, message: 'Verification code sent by email.' });
});

export const confirmCode = asyncHandler(async (request, response) => {
  const data = await familyVerificationService.confirmFamilyVerificationCode(
    request.user._id,
    request.validated.params.familyId,
    request.validated.body.code,
  );
  response.json({ success: true, data, message: 'Email confirmed.' });
});

export const saveDraft = asyncHandler(async (request, response) => {
  const data = await familyVerificationService.saveFamilyVerificationDraft(
    request.user._id,
    request.validated.params.familyId,
    request.validated.body,
  );
  response.json({ success: true, data, message: 'Verification draft saved.' });
});

export const submitDocuments = asyncHandler(async (request, response) => {
  const data = await familyVerificationService.submitFamilyVerificationDocuments(
    request.user._id,
    request.validated.params.familyId,
    request.validated.body,
    request.verificationUploads,
  );
  response.status(201).json({
    success: true,
    data: { ...data, nonRefundableNotice: true },
    message: 'Documents submitted for review.',
  });
});

export const getMine = asyncHandler(async (request, response) => {
  const data = await familyVerificationService.getFamilyVerificationStatus(
    request.user._id,
    request.validated.params.familyId,
  );
  response.json({ success: true, data, message: 'Family verification status loaded.' });
});

export const listAdminQueue = asyncHandler(async (request, response) => {
  const data = await familyVerificationService.getAdminFamilyVerificationQueue();
  response.json({ success: true, data, message: 'Family verification queue loaded.' });
});

export const getAdminDetail = asyncHandler(async (request, response) => {
  const data = await familyVerificationService.getAdminFamilyVerificationDetail(
    request.user._id,
    request.validated.params.familyId,
  );
  response.json({ success: true, data, message: 'Family verification detail loaded.' });
});

export const readAdminDocument = asyncHandler(async (request, response) => {
  const document = await familyVerificationService.readSignedFamilyVerificationDocument(
    request.user._id,
    request.validated.query.token,
    request.ip,
  );
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': document.mimeType,
    'Content-Disposition': `attachment; filename="${document.fileName}"`,
  });
  response.send(document.buffer);
});

export const decideAdmin = (decision) => asyncHandler(async (request, response) => {
  const result = await familyVerificationService.decideFamilyVerification(
    request.user._id,
    request.validated.params.familyId,
    decision,
    request.validated.body.reason,
  );
  response.json({ success: true, data: result, message: 'Family verification decision saved.' });
});
