// Phase 1: Authenticate a request using its HTTP-only access-token cookie.
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { verifyAccessToken } from '../services/token.service.js';

export default asyncHandler(async (request, response, next) => {
  const accessToken = request.cookies?.oc_access;

  if (!accessToken) {
    throw new ApiError(401, 'Please log in to continue.');
  }

  const payload = verifyAccessToken(accessToken);
  const user = await User.findOne({ _id: payload.sub, deletedAt: null }).select('+passwordHash');

  if (!user || user.status !== 'active') {
    throw new ApiError(401, 'Your session is no longer active. Please log in again.');
  }

  request.user = user;
  next();
});
