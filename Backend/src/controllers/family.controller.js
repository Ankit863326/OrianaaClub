import * as familyService from '../services/family.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verificationDocumentPath } from '../utils/verificationDocumentStorage.js';

export const listMine = asyncHandler(async (request, response) => {
  const data = await familyService.listOwnedFamily(request.user._id);
  response.json({ success: true, data, message: 'Family members loaded.' });
});

export const requestAdd = asyncHandler(async (request, response) => {
  const member = await familyService.requestAddFamilyMember(
    request.user._id, request.validated.body, request.file,
  );
  response.status(201).json({ success: true, data: member, message: 'Family member request submitted.' });
});

export const requestUpdate = asyncHandler(async (request, response) => {
  const member = await familyService.requestUpdateFamilyMember(
    request.user._id,
    request.validated.params.familyId,
    request.validated.body,
  );
  response.json({ success: true, data: member, message: 'Family member update request submitted.' });
});

export const requestRemove = asyncHandler(async (request, response) => {
  const member = await familyService.requestRemoveFamilyMember(request.user._id, request.validated.params.familyId);
  response.json({ success: true, data: member, message: 'Family removal request submitted.' });
});

export const requestNominee = asyncHandler(async (request, response) => {
  const data = await familyService.requestNominee(request.user._id, request.validated.body.familyMemberId);
  response.json({ success: true, data, message: 'Nominee request submitted for approval.' });
});

export const listMembershipFamily = asyncHandler(async (request, response) => {
  const data = await familyService.adminListFamily(request.validated.params.id);
  response.json({ success: true, data, message: 'Family members loaded.' });
});

export const addMembershipFamily = asyncHandler(async (request, response) => {
  const member = await familyService.adminAddFamilyMember(
    request.user._id, request.validated.params.id, request.validated.body, request.file,
  );
  response.status(201).json({ success: true, data: member, message: 'Family member added.' });
});

export const updateFamily = asyncHandler(async (request, response) => {
  const member = await familyService.updateAdminFamilyMember(
    request.user._id,
    request.validated.params.familyId,
    request.validated.body,
    request.file,
  );
  response.json({ success: true, data: member, message: 'Family member updated.' });
});

export const removeFamily = asyncHandler(async (request, response) => {
  const member = await familyService.removeAdminFamilyMember(
    request.user._id, request.validated.params.familyId, request.validated.body?.reason || '',
  );
  response.json({ success: true, data: member, message: 'Family member removed.' });
});

export const setNominee = asyncHandler(async (request, response) => {
  const membership = await familyService.setAdminNominee(
    request.user._id,
    request.validated.params.id,
    request.validated.body.familyMemberId,
  );
  response.json({ success: true, data: membership, message: 'Membership nominee updated.' });
});

export const listRequests = asyncHandler(async (request, response) => {
  const data = await familyService.listFamilyRequests(request.validated.query);
  response.json({ success: true, data, message: 'Family requests loaded.' });
});

export const decideRequest = (approve) => asyncHandler(async (request, response) => {
  const member = await familyService.decideFamilyRequest(
    request.user._id,
    request.validated.params.familyId,
    approve,
    request.validated.body.reason,
  );
  response.json({
    success: true,
    data: member,
    message: approve ? 'Family request approved.' : 'Family request rejected.',
  });
});

export const transferToNominee = asyncHandler(async (request, response) => {
  const membership = await familyService.transferToNominee(
    request.user._id,
    request.validated.params.id,
    { reason: request.validated.body.reason, document: request.file },
  );
  response.json({ success: true, data: membership, message: 'Membership transferred to nominee.' });
});

export const getFamilyIdProof = asyncHandler(async (request, response, next) => {
  const document = await familyService.getFamilyIdProof(request.validated.params.familyId);
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': document.mimeType,
    'Content-Disposition': `attachment; filename="${document.originalName.replace(/["\r\n]/g, '_')}"`,
  });
  response.sendFile(verificationDocumentPath(document.storageKey), (error) => {
    if (error) next(error);
  });
});

export const getTransferDocument = asyncHandler(async (request, response, next) => {
  const document = await familyService.getTransferDocument(request.validated.params.id);
  response.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, private',
    'X-Content-Type-Options': 'nosniff',
    'Content-Type': document.mimeType,
    'Content-Disposition': `attachment; filename="${document.originalName.replace(/["\r\n]/g, '_')}"`,
  });
  response.sendFile(verificationDocumentPath(document.storageKey), (error) => {
    if (error) next(error);
  });
});
