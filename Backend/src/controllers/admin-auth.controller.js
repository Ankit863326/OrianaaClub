// Admin auth endpoints set only admin-specific cookies.
import * as adminAuthService from '../services/admin-auth.service.js';
import asyncHandler from '../utils/asyncHandler.js';
import { env } from '../config/env.js';

const accessCookieOptions = {
  httpOnly: true,
  secure: env.cookieSecure,
  sameSite: env.cookieSameSite,
  path: '/api/admin',
  ...(env.cookieDomain ? { domain: env.cookieDomain } : {}),
};
const refreshCookieOptions = { ...accessCookieOptions, path: '/api/admin/auth' };

function setSessionCookies(response, session) {
  response.cookie('oc_admin_access', session.accessToken, {
    ...accessCookieOptions,
    maxAge: 15 * 60 * 1000,
  });
  response.cookie('oc_admin_refresh', session.refreshToken, {
    ...refreshCookieOptions,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function clearSessionCookies(response) {
  response.clearCookie('oc_admin_access', accessCookieOptions);
  response.clearCookie('oc_admin_refresh', refreshCookieOptions);
}

export const login = asyncHandler(async (request, response) => {
  const session = await adminAuthService.login(request.validated.body, request.ip);
  setSessionCookies(response, session);
  response.json(session.admin);
});

export const logout = (request, response) => {
  clearSessionCookies(response);
  response.json({ message: 'You have been logged out.' });
};

export const refresh = asyncHandler(async (request, response) => {
  const session = await adminAuthService.refreshSession(request.cookies?.oc_admin_refresh);
  setSessionCookies(response, session);
  response.json(session.admin);
});

export const me = (request, response) => {
  response.json(adminAuthService.publicAdmin(request.user));
};

export const forgotPassword = asyncHandler(async (request, response) => {
  response.status(202).json(await adminAuthService.requestPasswordReset(request.validated.body.email));
});

export const resetPassword = asyncHandler(async (request, response) => {
  response.json(await adminAuthService.resetPassword(request.validated.body));
});
