// Atomically allow at most one activation or reset email per address in its cooldown window.
import EmailCooldown from '../models/EmailCooldown.js';
import { env } from '../config/env.js';

export async function reserveEmailCooldown(email, type) {
  const cooldownSeconds = type === 'activation'
    ? Math.max(env.emailCooldownSeconds, 60)
    : env.emailCooldownSeconds;
  if (cooldownSeconds === 0) return new Date();

  const normalizedEmail = email.trim().toLowerCase();
  const now = new Date();
  const cutoff = new Date(now.getTime() - cooldownSeconds * 1000);

  try {
    const reservation = await EmailCooldown.findOneAndUpdate(
      {
        email: normalizedEmail,
        type,
        $or: [
          { sentAt: { $lte: cutoff } },
          { sentAt: { $exists: false } },
        ],
      },
      {
        $set: {
          sentAt: now,
          expiresAt: new Date(now.getTime() + cooldownSeconds * 1000),
        },
        $setOnInsert: { email: normalizedEmail, type },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    return reservation ? now : null;
  } catch (error) {
    if (error.code === 11000) return null;
    throw error;
  }
}

export async function releaseEmailCooldown(email, type, reservedAt) {
  if (!reservedAt) return;
  await EmailCooldown.deleteOne({
    email: email.trim().toLowerCase(),
    type,
    sentAt: reservedAt,
  });
}
