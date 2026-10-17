import * as authService from '../services/auth.service.js';
import { verifyOnboardingToken } from '../services/token.service.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import auth from './auth.js';

export const membershipOnboardingAuth = asyncHandler(async (request, response, next) => {
  const token = request.cookies?.oc_onboarding;
  if (!token) throw new ApiError(401, 'Please verify your email to continue membership setup.');
  const payload = verifyOnboardingToken(token);
  request.user = await authService.getOnboardingUser(payload.sub);
  next();
});

export const memberAccessAuth = asyncHandler(async (request, response, next) => {
  if (request.cookies?.oc_access) {
    return auth(request, response, next);
  }
  return membershipOnboardingAuth(request, response, next);
});
