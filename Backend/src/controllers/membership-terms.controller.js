import asyncHandler from '../utils/asyncHandler.js';
import ApiError from '../utils/ApiError.js';
import { getMembershipDraft } from '../services/membership-draft.service.js';
import {
  createTermsConsent,
  getApplicationTermsConsent,
  serializeTermsConsent,
} from '../services/terms.service.js';

function resolveApplication(request) {
  const id = request.validated.params.id;
  const draft = request.membershipDraft;
  const user = request.user;
  const ownerId = draft?._id || user?._id;
  if (!ownerId || String(ownerId) !== id) {
    throw new ApiError(403, 'You do not have access to this membership application.');
  }
  return { applicationId: ownerId, userId: draft ? draft.user : user?._id };
}

export const get = asyncHandler(async (request, response) => {
  const { applicationId } = resolveApplication(request);
  const data = request.membershipDraft
    ? getMembershipDraft(request.membershipDraft)
    : { id: String(applicationId) };
  data.termsConsent = await getApplicationTermsConsent(applicationId);
  response.json({ success: true, data, message: 'Membership application loaded.' });
});

export const createConsent = asyncHandler(async (request, response) => {
  const { applicationId, userId } = resolveApplication(request);
  const ipAddress = request.ip || request.socket.remoteAddress;
  if (!ipAddress) throw new ApiError(503, 'The server could not determine the request IP address.');
  const record = await createTermsConsent({
    applicationId,
    userId,
    ...request.validated.body,
    ipAddress,
    userAgent: request.get('user-agent') || '',
  });
  response.status(201).json({
    success: true,
    data: serializeTermsConsent(record),
    message: 'Membership agreement consent saved.',
  });
});
