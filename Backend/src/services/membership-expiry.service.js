import mongoose from 'mongoose';
import Membership from '../models/Membership.js';
import { expireMembershipPoints } from './point-change.service.js';

const transactionUnsupported = (error) => [20, 303].includes(error?.code)
  || /transaction numbers are only allowed|transactions are not supported|replica set|mongos/i.test(error?.message || '');

export async function runMembershipExpiry(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('Expiry processing requires a valid date.');
  }
  const expiredMemberships = await Membership.updateMany(
    { status: 'active', membershipExpireAt: { $lte: now } },
    { $set: { status: 'expired' } },
  );
  let expiredPointsCount = 0;
  const memberships = await Membership.find({
    pointsExpireAt: { $lte: now },
    $or: [
      { pointsBalance: { $gt: 0 } },
      { pointsExpiryPendingAmount: { $gt: 0 } },
    ],
  }).select('_id');

  for (const { _id } of memberships) {
  const pending = await Membership.exists({
    _id,
    pointsExpiryPendingAmount: { $gt: 0 },
    pointsExpireAt: { $lte: now },
  });
  if (pending) {
    if (await expireMembershipPoints(_id, now)) expiredPointsCount += 1;
    continue;
  }
  const session = await mongoose.startSession();
  try {
    let processed = false;
    try {
      await session.withTransaction(async () => {
        processed = await expireMembershipPoints(_id, now, session);
      });
    } catch (error) {
      if (!transactionUnsupported(error)) throw error;
      processed = await expireMembershipPoints(_id, now);
    }
      if (processed) expiredPointsCount += 1;
    } finally {
      await session.endSession();
    }
  }

  return {
    membershipsExpired: expiredMemberships.modifiedCount,
    balancesExpired: expiredPointsCount,
  };
}

export async function listMembershipsWithPointsExpiring(withinDays) {
  if (![30, 90].includes(withinDays)) {
    throw new RangeError('The points-expiry window must be 30 or 90 days.');
  }
  const now = new Date();
  const expiresBefore = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  return Membership.find({
    status: 'active',
    pointsBalance: { $gt: 0 },
    pointsExpireAt: { $gt: now, $lte: expiresBefore },
  })
    .select('_id user plan memberCode pointsBalance pointsExpireAt membershipExpireAt')
    .populate('plan', 'name title')
    .sort({ pointsExpireAt: 1 })
    .lean();
}
