// Admin sign-in and password recovery are kept separate from member sessions.
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import {
  consumeEmailToken,
  createEmailToken,
  signAdminAccessToken,
  signAdminRefreshToken,
  verifyRefreshToken,
} from './token.service.js';
import { sendMail } from './mail.service.js';
import { recordAdminAction, recordAdminAuthAttempt } from './audit.service.js';

const passwordCost = 12;
export const ADMIN_LOGIN_ERROR = 'Email or password is incorrect.';
export const ADMIN_FORGOT_MESSAGE = 'If the address can be used, instructions will be sent shortly.';

export function publicAdmin(user) {
  return {
    id: String(user._id),
    firstName: user.firstName,
    email: user.email,
    role: user.role,
  };
}

function createAdminSession(user) {
  return {
    admin: publicAdmin(user),
    accessToken: signAdminAccessToken(user._id),
    refreshToken: signAdminRefreshToken(user._id),
  };
}

export async function login({ email, password }, ip) {
  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;
  const isActiveAdmin = user
    && user.deletedAt === null
    && user.status === 'active'
    && user.role === 'admin';

  if (!matches || !isActiveAdmin) {
    await recordAdminAuthAttempt({
      adminId: user?.role === 'admin' ? user._id : null,
      success: false,
      ip,
    });
    throw new ApiError(401, ADMIN_LOGIN_ERROR);
  }

  user.lastLoginAt = new Date();
  await user.save();
  await recordAdminAuthAttempt({ adminId: user._id, success: true, ip });
  return createAdminSession(user);
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) throw new ApiError(401, 'Your administrator session has expired. Please log in again.');

  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findOne({
    _id: payload.sub,
    role: 'admin',
    status: 'active',
    deletedAt: null,
  });
  if (!user) {
    throw new ApiError(401, 'Your administrator session is no longer active. Please log in again.');
  }
  return createAdminSession(user);
}

export async function requestPasswordReset(email) {
  const user = await User.findOne({
    email,
    role: 'admin',
    status: 'active',
    deletedAt: null,
  });

  if (user) {
    const token = await createEmailToken(user._id, 'admin-reset');
    const link = `${env.adminUrl}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await sendMail({
        to: user.email,
        subject: 'Reset your OrianaaClub admin password',
        template: 'reset',
        data: { firstName: user.firstName, link, expiry: '1 hour', admin: true },
      });
    } catch (error) {
      // The same response is used for every address; log only the error type, not secrets.
      console.error(`[admin-auth] Could not send password reset email (${error?.name || 'Error'}).`);
    }
  }

  return { message: ADMIN_FORGOT_MESSAGE };
}

export async function resetPassword({ token, password }) {
  const record = await consumeEmailToken(token, 'admin-reset');
  if (
    !record.user
    || record.user.role !== 'admin'
    || record.user.status !== 'active'
    || record.user.deletedAt !== null
  ) {
    throw new ApiError(400, 'This password reset link is no longer valid. Request a new link to continue.');
  }

  const passwordHash = await bcrypt.hash(password, passwordCost);
  const result = await User.updateOne(
    { _id: record.user._id, role: 'admin', status: 'active', deletedAt: null },
    { $set: { passwordHash } },
  );
  if (!result.matchedCount) {
    throw new ApiError(400, 'This password reset link is no longer valid. Request a new link to continue.');
  }
  await recordAdminAction({
    adminId: record.user._id,
    action: 'password_reset',
    entityType: 'authentication',
    entityId: String(record.user._id),
    summary: 'Administrator password was reset.',
  });
  return { message: 'Your password has been reset. You can now log in.' };
}
