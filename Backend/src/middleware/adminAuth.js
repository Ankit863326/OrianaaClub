// Admin APIs use a separate cookie so a member session cannot grant admin access.
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../services/token.service.js';

export default asyncHandler(async (request, response, next) => {
  const accessToken = request.cookies?.oc_admin_access;

  if (!accessToken) {
    const memberToken = request.cookies?.oc_access;
    if (memberToken) {
      const memberPayload = verifyAccessToken(memberToken);
      const member = await User.findOne({ _id: memberPayload.sub, deletedAt: null });
      if (member?.status === 'active' && member.role === 'member') {
        throw new ApiError(403, 'You do not have permission to access administrator resources.');
      }
    }
    throw new ApiError(401, 'Please log in as an administrator to continue.');
  }

  const payload = verifyAccessToken(accessToken);
  const user = await User.findOne({ _id: payload.sub, deletedAt: null });

  if (!user || user.status !== 'active' || user.role !== 'admin') {
    throw new ApiError(401, 'Your administrator session is no longer active. Please log in again.');
  }

  request.user = user;
  next();
});
