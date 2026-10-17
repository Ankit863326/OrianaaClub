// Phase 1: Create single-use email tokens and sign or verify session JWTs.
import { createHash, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';
import EmailToken from '../models/EmailToken.js';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';

const emailTokenLifetime = {
  activation: env.activationTokenDays * 24 * 60 * 60 * 1000,
  reset: env.resetTokenHours * 60 * 60 * 1000,
  'admin-reset': 60 * 60 * 1000,
};

function normalizeEmailToken(token) {
  return typeof token === 'string' ? token.trim().toLowerCase() : '';
}

function invalidEmailTokenMessage(type) {
  return type === 'activation'
    ? 'This password link is invalid, expired, or already used. Request a new link to continue.'
    : 'This password reset link is invalid, expired, or already used. Request a new link to continue.';
}

const hashToken = (token) => createHash('sha256')
  .update(Buffer.from(normalizeEmailToken(token), 'utf8'))
  .digest('hex');

function requireSecret(secret, name) {
  if (!secret) {
    throw new Error(`${name} is required before account authentication can be used.`);
  }

  return secret;
}

export async function createEmailToken(userId, type) {
  const lifetime = emailTokenLifetime[type];
  if (!lifetime) throw new Error(`Unsupported email token type: ${type}`);

  await EmailToken.deleteMany({ user: userId, type });

  const token = randomBytes(32).toString('hex');
  await EmailToken.create({
    user: userId,
    type,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + lifetime),
  });

  return token;
}

export async function verifyEmailToken(token, type) {
  const normalizedToken = normalizeEmailToken(token);
  if (!/^[a-f0-9]{64}$/.test(normalizedToken)) {
    throw new ApiError(400, invalidEmailTokenMessage(type));
  }

  const record = await EmailToken.findOne({
    tokenHash: hashToken(normalizedToken),
    type,
    expiresAt: { $gt: new Date() },
    usedAt: null,
  }).populate('user');

  if (!record?.user) {
    throw new ApiError(400, invalidEmailTokenMessage(type));
  }

  return record;
}

export async function consumeEmailToken(token, type) {
  const normalizedToken = normalizeEmailToken(token);
  if (!/^[a-f0-9]{64}$/.test(normalizedToken)) {
    throw new ApiError(400, invalidEmailTokenMessage(type));
  }

  const record = await EmailToken.findOneAndUpdate({
    tokenHash: hashToken(normalizedToken),
    type,
    expiresAt: { $gt: new Date() },
    usedAt: null,
  }, { $set: { usedAt: new Date() } }, { new: true }).populate('user');

  if (!record?.user) {
    throw new ApiError(400, invalidEmailTokenMessage(type));
  }

  return record;
}

function signToken(userId, tokenUse, secret, expiresIn, secretName) {
  return jwt.sign({ tokenUse }, requireSecret(secret, secretName), {
    subject: String(userId),
    expiresIn,
  });
}

export function signAccessToken(userId) {
  return signToken(userId, 'access', env.jwtAccessSecret, env.jwtAccessExpiresIn, 'JWT_ACCESS_SECRET');
}

export function signRefreshToken(userId) {
  return signToken(userId, 'refresh', env.jwtRefreshSecret, env.jwtRefreshExpiresIn, 'JWT_REFRESH_SECRET');
}

export function signOnboardingToken(userId) {
  return signToken(userId, 'onboarding', env.jwtAccessSecret, '4h', 'JWT_ACCESS_SECRET');
}

// Admin sessions keep their requested lifetimes even if member token settings change.
export function signAdminAccessToken(userId) {
  return signToken(userId, 'access', env.jwtAccessSecret, '15m', 'JWT_ACCESS_SECRET');
}

export function signAdminRefreshToken(userId) {
  return signToken(userId, 'refresh', env.jwtRefreshSecret, '7d', 'JWT_REFRESH_SECRET');
}

function verifyToken(token, tokenUse, secret, secretName) {
  try {
    const payload = jwt.verify(token, requireSecret(secret, secretName));
    if (typeof payload === 'string' || payload.tokenUse !== tokenUse || !payload.sub) {
      throw new ApiError(401, 'Your session is invalid. Please log in again.');
    }
    return payload;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error.message.includes('is required before account authentication')) throw error;
    throw new ApiError(401, 'Your session has expired. Please log in again.');
  }
}

export function verifyAccessToken(token) {
  return verifyToken(token, 'access', env.jwtAccessSecret, 'JWT_ACCESS_SECRET');
}

export function verifyRefreshToken(token) {
  return verifyToken(token, 'refresh', env.jwtRefreshSecret, 'JWT_REFRESH_SECRET');
}

export function verifyOnboardingToken(token) {
  return verifyToken(token, 'onboarding', env.jwtAccessSecret, 'JWT_ACCESS_SECRET');
}
