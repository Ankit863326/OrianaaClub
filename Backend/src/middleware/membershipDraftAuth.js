import { createHash } from 'node:crypto';
import MembershipDraft from '../models/MembershipDraft.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export default asyncHandler(async (request, response, next) => {
  const token = request.cookies?.oc_membership_draft;
  if (!token || !/^[a-f\d]{64}$/i.test(token)) {
    throw new ApiError(401, 'Your membership application session has expired. Start again to continue.');
  }
  const draft = await MembershipDraft.findOne({
    tokenHash: hashToken(token),
    status: { $in: ['draft', 'payment_submitted', 'paid'] },
    expiresAt: { $gt: new Date() },
  }).select('+tokenHash +otpHash +otpSalt +identity.panCiphertext +identity.idCiphertext +identity.aadhaarLast4 +identity.aadhaarHash');
  if (!draft) throw new ApiError(401, 'Your membership application session has expired. Start again to continue.');
  request.membershipDraft = draft;
  next();
});
