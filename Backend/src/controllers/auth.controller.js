// Phase 1: Translate auth HTTP requests into service calls and cookie responses.
import * as authService from '../services/auth.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

const cookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: '/api',
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
};

function setSessionCookies(response, session) {
  response.cookie('oc_access', session.accessToken, {
    ...cookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  response.cookie('oc_refresh', session.refreshToken, {
    ...cookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookies(response) {
  response.clearCookie('oc_access', cookieOptions);
  response.clearCookie('oc_refresh', cookieOptions);
}

function setOnboardingCookie(response, token) {
  response.cookie('oc_onboarding', token, {
    ...cookieOptions,
    maxAge: 4 * 60 * 60 * 1000,
  });
}

function clearOnboardingCookie(response) {
  response.clearCookie('oc_onboarding', cookieOptions);
}

export const register = asyncHandler(async (request, response) => {
  const result = await authService.registerAccount(request.validated.body);
  response.status(202).json(result);
});

export const resendActivation = asyncHandler(async (request, response) => {
  const result = await authService.resendActivation(request.validated.body.email);
  response.status(202).json(result);
});

export const requestOnboardingPasswordLink = asyncHandler(async (request, response) => {
  const result = await authService.requestOnboardingPasswordLink(
    request.user._id,
    request.validated.body.email,
  );
  response.status(202).json(result);
});

export const verifyActivation = asyncHandler(async (request, response) => {
  const result = await authService.inspectActivation(request.validated.query.token);
  response.json(result);
});

export const activate = asyncHandler(async (request, response) => {
  const result = await authService.activateAccount(request.validated.body);
  clearOnboardingCookie(response);
  setSessionCookies(response, result);
  response.json({ user: result.user });
});

export const onboardingMe = asyncHandler(async (request, response) => {
  response.json({ user: authService.publicUser(request.user) });
});

export const setOnboardingPassword = asyncHandler(async (request, response) => {
  const session = await authService.setOnboardingPassword(request.user._id, request.validated.body);
  clearOnboardingCookie(response);
  setSessionCookies(response, session);
  response.json({ user: session.user });
});

export const login = asyncHandler(async (request, response) => {
  const session = await authService.login(request.validated.body);
  setSessionCookies(response, session);
  response.json({ user: session.user });
});

export const logout = (request, response) => {
  clearSessionCookies(response);
  clearOnboardingCookie(response);
  response.json({ message: 'You have been logged out.' });
};

export const me = (request, response) => {
  response.json({ user: authService.publicUser(request.user) });
};

export const refresh = asyncHandler(async (request, response) => {
  const session = await authService.refreshSession(request.cookies?.oc_refresh);
  setSessionCookies(response, session);
  response.json({ user: session.user });
});

export const forgotPassword = asyncHandler(async (request, response) => {
  const result = await authService.requestPasswordReset(request.validated.body.email);
  response.status(202).json(result);
});

export const resetPassword = asyncHandler(async (request, response) => {
  const result = await authService.resetPassword(request.validated.body);
  response.json(result);
});
