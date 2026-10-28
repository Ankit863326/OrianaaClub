// Phase 1: Apply account registration, activation, login, and password-reset rules.
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import MembershipDraft from '../models/MembershipDraft.js';
import EmailLog from '../models/EmailLog.js';
import AuditLog from '../models/AuditLog.js';
import ApiError from '../utils/ApiError.js';
import { env } from '../config/env.js';
import { createEmailToken, consumeEmailToken, signAccessToken, signOnboardingToken, signRefreshToken, verifyEmailToken, verifyOnboardingToken, verifyRefreshToken } from './token.service.js';
import { sendMail } from './mail.service.js';
import { verifyRecaptcha } from './recaptcha.service.js';
import { releaseEmailCooldown, reserveEmailCooldown } from './email-cooldown.service.js';

export const GENERIC_EMAIL_MESSAGE = 'If the address can be used, instructions will be sent shortly.';
const passwordCost = 12;

export function publicUser(user) {
  return {
    id: String(user._id),
    firstName: user.firstName,
    email: user.email,
    role: user.role,
    status: user.status,
    emailVerified: user.emailVerified,
    passwordSet: Boolean(user.passwordHash),
    onboarding: user.status === 'pending' && user.emailVerified && !user.passwordHash,
  };
}

export function createSession(user) {
  return {
    user: publicUser(user),
    accessToken: signAccessToken(user._id),
    refreshToken: signRefreshToken(user._id),
  };
}

async function hasSubmittedMembershipPayment(userId) {
  const membership = await Membership.findOne({
    user: userId,
    status: { $in: ['pending_payment', 'payment_pending', 'pending_verification', 'pending_approval', 'active'] },
  }).select('_id');
  return Boolean(membership && await Payment.exists({
    membership: membership._id,
    status: { $in: ['pending', 'confirmed', 'paid'] },
  }));
}

async function hasApprovedMembership(userId) {
  return Membership.exists({ user: userId, status: 'active' });
}

async function sendAccountLink(user, type, token) {
  const path = type === 'activation' ? '/set-password' : '/reset-password';
  const link = `${env.frontendUrl.replace(/\/+$/, '')}${path}?token=${encodeURIComponent(token.trim())}`;
  if (env.nodeEnv !== 'production') {
    console.log(`[mail:dev] ${type === 'activation' ? 'Password setup' : 'Password reset'} email prepared for ${maskEmail(user.email)}.`);
  }
  const subject = type === 'activation'
    ? 'Set your OrianaaClub password'
    : 'Reset your OrianaaClub password';
  const expiryValue = type === 'activation' ? env.activationTokenDays : env.resetTokenHours;
  const expiryUnit = type === 'activation' ? 'day' : 'hour';
  const expiry = `${expiryValue} ${expiryValue === 1 ? expiryUnit : `${expiryUnit}s`}`;

  await sendMail({
    to: user.email,
    subject,
    template: type,
    data: { firstName: user.firstName, link, expiry },
  });
  return true;
}

async function issueAccountLink(user, type, { bypassCooldown = false } = {}) {
  const reservation = bypassCooldown
    ? new Date()
    : await reserveEmailCooldown(user.email, type);
  if (!reservation) {
    await logPasswordLinkAttempt({
      email: user.email,
      userId: user._id,
      reason: 'email_cooldown_active',
      template: type,
      action: type === 'activation' ? 'password_link' : 'password_reset_link',
    });
    return false;
  }

  try {
    const token = await createEmailToken(user._id, type);
    console.log(`[auth] ${type} link prepared for ${maskEmail(user.email)}.`);
    const emailed = await sendAccountLink(user, type, token);
    console.log(
      `[auth] ${type} ${emailed ? 'email sent' : 'URL logged in development'} for ${maskEmail(user.email)}.`,
    );
    if (type === 'activation' && emailed) {
      await User.updateOne({ _id: user._id }, {
        $set: {
          activationEmailStatus: ['sent', 'resent'].includes(user.activationEmailStatus) ? 'resent' : 'sent',
          activationEmailSentAt: new Date(),
        },
      });
    }
    return true;
  } catch (error) {
    if (type === 'activation') {
      await User.updateOne({ _id: user._id }, { $set: { activationEmailStatus: 'failed' } });
    }
    await logPasswordLinkAttempt({
      email: user.email,
      userId: user._id,
      reason: `smtp_delivery_failed:${error?.name || 'Error'}:${error?.code || 'unknown'}`,
      status: 'delivery_failed',
      template: type,
      action: type === 'activation' ? 'password_link' : 'password_reset_link',
    });
    try {
      await releaseEmailCooldown(user.email, type, reservation);
    } catch (releaseError) {
      console.error(`[auth] Failed to release ${type} email cooldown after delivery failure.`, releaseError);
    }
    throw error;
  }
}

export async function sendMembershipActivation(userId) {
  const user = await User.findOne({
    _id: userId,
    role: 'member',
    deletedAt: null,
  }).select('+passwordHash');
  if (!user) {
    await logPasswordLinkAttempt({ email: '', userId, reason: 'user_not_found' });
    return false;
  }
  if (user.status !== 'pending') {
    await logPasswordLinkAttempt({ email: user.email, userId: user._id, reason: 'user_not_pending' });
    return false;
  }
  if (!user.emailVerified) {
    await logPasswordLinkAttempt({ email: user.email, userId: user._id, reason: 'email_not_verified' });
    return false;
  }
  if (user.passwordHash) {
    await logPasswordLinkAttempt({ email: user.email, userId: user._id, reason: 'password_already_set' });
    return false;
  }
  if (!await hasSubmittedMembershipPayment(user._id)) {
    await logPasswordLinkAttempt({ email: user.email, userId: user._id, reason: 'payment_not_submitted' });
    return false;
  }
  return issueAccountLink(user, 'activation');
}

export async function sendAdminActivation(userId) {
  const user = await User.findOne({
    _id: userId,
    role: 'member',
    deletedAt: null,
  }).select('+passwordHash');
  if (!user) throw new ApiError(404, 'Member was not found.');
  if (user.status !== 'pending') throw new ApiError(409, 'Only members who have not set a password can receive a password link.');
  if (user.passwordHash) throw new ApiError(409, 'A password has already been set for this member.');
  if (!await hasSubmittedMembershipPayment(user._id)) {
    throw new ApiError(409, 'A password link can be sent after payment is submitted.');
  }
  return issueAccountLink(user, 'activation', { bypassCooldown: true });
}

export async function registerAccount({ firstName, email, recaptchaToken }) {
  await verifyRecaptcha(recaptchaToken);

  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    if (existingUser.role === 'member' && existingUser.status === 'pending' && !existingUser.deletedAt) {
      await issueAccountLink(existingUser, 'activation');
    } else if (existingUser.role === 'member' && existingUser.status === 'active' && !existingUser.deletedAt && env.nodeEnv === 'development') {
      console.log('[dev] account already active, no link sent');
    }
    return { message: GENERIC_EMAIL_MESSAGE };
  }

  try {
    const user = await User.create({ firstName, email: normalizedEmail });
    await issueAccountLink(user, 'activation');
  } catch (error) {
    if (error.code !== 11000) throw error;
  }

  return { message: GENERIC_EMAIL_MESSAGE };
}

export async function resendActivation(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail, status: 'pending', deletedAt: null, role: 'member' });
  if (user && await hasSubmittedMembershipPayment(user._id)) {
    try {
      await issueAccountLink(user, 'activation');
    } catch {
      console.error('[auth] Password setup email resend failed.');
    }
  }
  return { message: GENERIC_EMAIL_MESSAGE };
}

function maskEmail(email) {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***';
  return `${localPart[0]}***@${domain}`;
}

async function logPasswordLinkAttempt({
  email,
  userId = null,
  reason,
  status = 'skipped',
  template = 'activation',
  action = 'password_link',
}) {
  const recipient = String(email || 'unknown@invalid.local').trim().toLowerCase();
  const writes = [
    AuditLog.create({
      actorType: 'system',
      action: `${action}.${status}`,
      entityType: 'membership_password_link',
      entityId: String(userId || 'unknown'),
      summary: `Password setup email ${status} for ${maskEmail(recipient)}.`,
      reason,
    }),
  ];
  if (status === 'skipped') {
    writes.push(EmailLog.create({
      to: recipient,
      template,
      status: 'failed',
      error: `Password-link skipped: ${reason}`,
    }));
  }
  await Promise.all(writes);
}

async function updatePaidPendingEmail(user, email) {
  const normalizedEmail = email.trim().toLowerCase();
  if (normalizedEmail === user.email) return false;

  const existing = await User.findOne({ email: normalizedEmail, deletedAt: null }).select('_id role status');
  if (existing && String(existing._id) !== String(user._id)) {
    if (existing.status === 'active') {
      const error = new ApiError(409, 'This email is already registered. Please log in.');
      error.code = 'PASSWORD_LINK_EMAIL_ALREADY_REGISTERED';
      throw error;
    }
    throw new ApiError(409, 'This email is already in use. Please use another email address.');
  }

  const previousEmail = user.email;
  try {
    user.email = normalizedEmail;
    await user.save();
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'This email is already in use. Please use another email address.');
    }
    throw error;
  }

  await MembershipDraft.updateMany(
    { user: user._id, status: { $in: ['payment_pending', 'payment_submitted', 'paid'] } },
    { $set: { email: normalizedEmail } },
  );
  await AuditLog.create({
    actorType: 'member',
    actorId: user._id,
    action: 'membership_password_email_changed',
    entityType: 'member',
    entityId: String(user._id),
    summary: 'Member changed the email address for password setup.',
    before: { email: previousEmail },
    after: { email: normalizedEmail },
  });
  return true;
}

async function requestPaidPendingPasswordLink(user, email) {
  if (!user) {
    await logPasswordLinkAttempt({ email, reason: 'user_not_found' });
    return { message: GENERIC_EMAIL_MESSAGE, sent: false };
  }
  if (user.status !== 'pending') {
    await logPasswordLinkAttempt({ email: user.email, userId: user._id, reason: 'user_not_pending' });
    return { message: GENERIC_EMAIL_MESSAGE, sent: false };
  }
  if (!user.emailVerified) {
    await logPasswordLinkAttempt({ email: user.email, userId: user._id, reason: 'email_not_verified' });
    return { message: GENERIC_EMAIL_MESSAGE, sent: false };
  }
  if (user.passwordHash) {
    await logPasswordLinkAttempt({ email: user.email, userId: user._id, reason: 'password_already_set' });
    return { message: GENERIC_EMAIL_MESSAGE, sent: false };
  }
  if (!await hasSubmittedMembershipPayment(user._id)) {
    await logPasswordLinkAttempt({ email: user.email, userId: user._id, reason: 'payment_not_submitted' });
    return { message: GENERIC_EMAIL_MESSAGE, sent: false };
  }

  await updatePaidPendingEmail(user, email);
  const sent = await issueAccountLink(user, 'activation');
  if (sent) {
    await MembershipDraft.updateMany(
      { $or: [{ user: user._id }, { email: user.email }] },
      { $set: { status: 'password_pending', currentStep: 6, lastEmailError: '' } },
    );
  }
  return { message: GENERIC_EMAIL_MESSAGE, sent, maskedEmail: maskEmail(user.email) };
}

export async function requestOnboardingPasswordLink(userId, email) {
  const user = await getOnboardingUser(userId);
  return requestPaidPendingPasswordLink(user, email);
}

export async function requestDraftPasswordLink(draft, email) {
  if (!draft.user) {
    await logPasswordLinkAttempt({ email, reason: 'draft_has_no_user' });
    return { message: GENERIC_EMAIL_MESSAGE, sent: false };
  }
  if (!['payment_pending', 'payment_submitted', 'paid'].includes(draft.status)) {
    await logPasswordLinkAttempt({
      email,
      userId: draft.user,
      reason: `draft_status_${draft.status || 'missing'}`,
    });
    return { message: GENERIC_EMAIL_MESSAGE, sent: false };
  }
  const user = await User.findOne({
    _id: draft.user,
    role: 'member',
    deletedAt: null,
  }).select('+passwordHash');
  const result = await requestPaidPendingPasswordLink(user, email);
  if (user && result.maskedEmail) {
    draft.email = user.email;
    await draft.save();
  }
  return result;
}

export async function inspectActivation(token) {
  const record = await verifyEmailToken(token, 'activation');
  if (record.user.status !== 'pending') {
    throw new ApiError(400, 'This password link is invalid, expired, or already used. Request a new link to continue.');
  }
  if (record.user.activationRequiresMembershipPayment
    && !await hasSubmittedMembershipPayment(record.user._id)) {
    await logPasswordLinkAttempt({
      email: record.user.email,
      userId: record.user._id,
      reason: 'activation_requires_membership_payment',
    });
    throw new ApiError(409, 'Submit your membership payment before setting a password.');
  }
  return { firstName: record.user.firstName, email: record.user.email };
}

export async function activateAccount({ token, password }) {
  const pending = await verifyEmailToken(token, 'activation');
  if (pending.user.activationRequiresMembershipPayment
    && !await hasSubmittedMembershipPayment(pending.user._id)) {
    await logPasswordLinkAttempt({
      email: pending.user.email,
      userId: pending.user._id,
      reason: 'activation_requires_membership_payment',
    });
    throw new ApiError(409, 'Submit your membership payment before setting a password.');
  }
  const record = await consumeEmailToken(token, 'activation');
  if (record.user.status !== 'pending') {
    throw new ApiError(400, 'This password link is invalid, expired, or already used. Request a new link to continue.');
  }

  const membershipApproved = !pending.user.activationRequiresMembershipPayment
    || await hasApprovedMembership(record.user._id);
  const accountStatus = membershipApproved ? 'active' : 'pending';
  const user = await User.findOneAndUpdate(
    { _id: record.user._id, status: 'pending', passwordHash: { $exists: false } },
    {
      $set: {
        passwordHash: await bcrypt.hash(password, passwordCost),
        emailVerified: true,
        status: accountStatus,
        ...(membershipApproved ? { activatedAt: new Date(), lastLoginAt: new Date() } : {}),
        activationEmailStatus: 'sent',
        activationRequiresMembershipPayment: !membershipApproved,
      },
    },
    { new: true },
  ).select('+passwordHash');

  if (!user) throw new ApiError(400, 'This password link is invalid, expired, or already used. Request a new link to continue.');
  await MembershipDraft.updateMany(
    { $or: [{ user: user._id }, { email: user.email }] },
    { $set: { status: user.status === 'active' ? 'active' : 'password_pending', currentStep: 6, lastEmailError: '' } },
  );
  if (user.status === 'pending') {
    return {
      user: publicUser(user),
      awaitingApproval: true,
    };
  }
  return createSession(user);
}

export async function getOnboardingUser(userId) {
  const user = await User.findOne({
    _id: userId,
    role: 'member',
    status: 'pending',
    emailVerified: true,
    passwordHash: { $exists: false },
    deletedAt: null,
  }).select('+passwordHash');
  if (!user) throw new ApiError(401, 'Your membership setup session has expired. Verify your email again.');
  return user;
}

export async function setOnboardingPassword(userId, { password }) {
  const user = await getOnboardingUser(userId);
  if (!await hasSubmittedMembershipPayment(user._id)) {
    throw new ApiError(409, 'Complete or submit your membership payment before setting a password.');
  }
  const passwordHash = await bcrypt.hash(password, passwordCost);
  const activated = await User.findOneAndUpdate(
    {
      _id: user._id,
      status: 'pending',
      emailVerified: true,
      passwordHash: { $exists: false },
    },
    { $set: { passwordHash, status: 'active', lastLoginAt: new Date() } },
    { new: true },
  ).select('+passwordHash');
  if (!activated) throw new ApiError(409, 'A password has already been set for this account.');
  await MembershipDraft.updateMany(
    { $or: [{ user: activated._id }, { email: activated.email }] },
    { $set: { status: 'active', currentStep: 6, lastEmailError: '' } },
  );
  return createSession(activated);
}

export async function login({ email, password }) {
  const user = await User.findOne({ email, deletedAt: null }).select('+passwordHash');
  const matches = user?.passwordHash ? await bcrypt.compare(password, user.passwordHash) : false;

  if (!matches) {
    throw new ApiError(401, 'Email or password is incorrect.');
  }
  if (user.status === 'suspended') {
    throw new ApiError(403, 'This account has been suspended. Please contact OrianaaClub support.');
  }
  if (user.status !== 'active') {
    throw new ApiError(403, 'Please verify your email address before logging in.');
  }

  user.lastLoginAt = new Date();
  await user.save();
  return createSession(user);
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) throw new ApiError(401, 'Your session has expired. Please log in again.');

  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findOne({ _id: payload.sub, deletedAt: null }).select('+passwordHash');
  if (!user || user.status !== 'active') {
    throw new ApiError(401, 'Your session is no longer active. Please log in again.');
  }
  return createSession(user);
}

export async function requestPasswordReset(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({
    email: normalizedEmail,
    status: { $in: ['active', 'pending'] },
    emailVerified: true,
    deletedAt: null,
    role: 'member',
  }).select('+passwordHash');
  if (!user) {
    await logPasswordLinkAttempt({
      email: normalizedEmail,
      reason: 'user_not_found',
      template: 'reset',
      action: 'password_reset_link',
    });
    return { message: GENERIC_EMAIL_MESSAGE };
  }

  if (user.status === 'pending' && !await hasSubmittedMembershipPayment(user._id)) {
    await logPasswordLinkAttempt({
      email: user.email,
      userId: user._id,
      reason: 'payment_not_submitted',
      template: 'activation',
      action: 'password_link',
    });
    return { message: GENERIC_EMAIL_MESSAGE };
  }
  if (user.status === 'pending' && user.passwordHash) {
    await logPasswordLinkAttempt({
      email: user.email,
      userId: user._id,
      reason: 'password_already_set',
      template: 'activation',
      action: 'password_link',
    });
    return { message: GENERIC_EMAIL_MESSAGE };
  }

  const type = user.status === 'pending' ? 'activation' : 'reset';
  console.log(`[auth] ${type} link requested for ${maskEmail(user.email)}.`);
  await issueAccountLink(user, type);
  return { message: GENERIC_EMAIL_MESSAGE };
}

export async function resetPassword({ token, password }) {
  const verified = await verifyEmailToken(token, 'reset');
  if (!['active', 'pending'].includes(verified.user.status) || !verified.user.emailVerified) {
    throw new ApiError(400, 'This password reset link is no longer valid. Request a new link to continue.');
  }
  if (verified.user.status === 'pending' && !await hasSubmittedMembershipPayment(verified.user._id)) {
    throw new ApiError(409, 'Submit a membership payment before setting your password.');
  }
  const record = await consumeEmailToken(token, 'reset');
  if (!['active', 'pending'].includes(record.user.status) || !record.user.emailVerified) {
    throw new ApiError(400, 'This password reset link is no longer valid. Request a new link to continue.');
  }

  const passwordHash = await bcrypt.hash(password, passwordCost);
  await User.updateOne(
    { _id: record.user._id },
    { $set: { passwordHash, status: 'active' } },
  );
  return { message: 'Your password has been reset. You can now log in.' };
}
