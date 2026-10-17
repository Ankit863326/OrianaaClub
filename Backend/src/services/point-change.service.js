import Membership from '../models/Membership.js';
import PointLedger from '../models/PointLedger.js';
import ApiError from '../utils/ApiError.js';

const channels = ['admin_manual', 'billing_counter', 'app', 'card'];

function validateChange({ amount, direction, channel }) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ApiError(400, 'Points amount must be a positive integer.');
  }
  if (!['+', '-'].includes(direction)) {
    throw new ApiError(400, 'Points direction must be + or -.');
  }
  if (!channels.includes(channel)) {
    throw new ApiError(400, 'Points channel is not supported.');
  }
}

async function findExistingEntry(idempotencyKey, session) {
  if (!idempotencyKey) return null;
  const query = PointLedger.findOne({ idempotencyKey });
  if (session) query.session(session);
  return query;
}

export async function applyPointsChange({
  membershipId,
  direction,
  amount,
  channel = 'billing_counter',
  type,
  actor = 'billing',
  billId = '',
  bookingId = '',
  reason = '',
  idempotencyKey,
  skipIdempotencyLookup = false,
  requireActive = false,
  requireUnexpired = false,
  requireMembershipUnexpired = false,
  failureMessage,
  insufficientMessage = 'Insufficient points.',
  balanceChangedMessage = 'Points balance changed before the adjustment.',
  expiresAt,
  expectedBalance,
  setBalanceTo,
  recordOnly = false,
  balanceAfter: recordedBalance,
  session,
}) {
  validateChange({ amount, direction, channel });
  if (!skipIdempotencyLookup) {
    const existing = await findExistingEntry(idempotencyKey, session);
    if (existing) return existing;
  }

  let balanceAfter = recordedBalance;
  let changedBalance = false;
  if (!recordOnly) {
    const filter = { _id: membershipId };
    if (requireActive) filter.status = 'active';
    if (direction === '-') filter.pointsBalance = { $gte: amount };
    else filter.pointsBalance = { $lte: Number.MAX_SAFE_INTEGER - amount };
    if (expectedBalance !== undefined) filter.pointsBalance = expectedBalance;
    if (requireUnexpired) filter.pointsExpireAt = { $gt: new Date() };
    if (requireMembershipUnexpired) filter.membershipExpireAt = { $gt: new Date() };
    if (expiresAt) filter.pointsExpireAt = { $lte: expiresAt };

    const update = setBalanceTo === undefined
      ? { $inc: { pointsBalance: direction === '+' ? amount : -amount } }
      : { $set: { pointsBalance: setBalanceTo } };
    const membership = await Membership.findOneAndUpdate(
      filter,
      update,
      { new: true, runValidators: true, ...(session ? { session } : {}) },
    );
    if (!membership) {
      const currentQuery = Membership.findById(membershipId).select(
        'status pointsBalance pointsExpireAt membershipExpireAt',
      );
      if (session) currentQuery.session(session);
      const current = await currentQuery;
      if (!current) throw new ApiError(404, 'Membership was not found.');
      if (requireActive && current.status !== 'active') {
        throw new ApiError(409, failureMessage || 'Membership is not active.');
      }
      if (requireUnexpired && (!current.pointsExpireAt || current.pointsExpireAt <= new Date())) {
        throw new ApiError(409, failureMessage || 'Membership points have expired.');
      }
      if (requireMembershipUnexpired && (!current.membershipExpireAt || current.membershipExpireAt <= new Date())) {
        throw new ApiError(409, failureMessage || 'Membership is not active or has expired.');
      }
      if (direction === '-' && current.pointsBalance < amount) {
        throw new ApiError(409, insufficientMessage);
      }
      throw new ApiError(409, failureMessage || balanceChangedMessage);
    }
    balanceAfter = membership.pointsBalance;
    changedBalance = true;
  }

  try {
    const ledgerEntry = {
      membership: membershipId,
      type,
      amount,
      direction,
      channel,
      balanceAfter,
      ...(billId ? { billId } : {}),
      ...(bookingId ? { bookingId } : {}),
      ...(idempotencyKey ? { idempotencyKey } : {}),
      note: String(reason || '').trim(),
      createdBy: actor,
    };
    if (session) {
      const [entry] = await PointLedger.create([ledgerEntry], { session });
      return entry;
    }
    return await PointLedger.create(ledgerEntry);
  } catch (error) {
    if (!session && changedBalance && setBalanceTo === undefined) {
      const compensation = direction === '+' ? -amount : amount;
      const restored = await Membership.findByIdAndUpdate(
        membershipId,
        { $inc: { pointsBalance: compensation } },
        { new: true },
      );
      if (!restored) {
        throw new Error(`Points change failed and balance compensation could not be applied: ${error.message}`);
      }
    }
    throw error;
  }
}

async function recordPendingExpiry(membership) {
  if (membership.pointsExpiryPendingAmount <= 0) return false;
  const idempotencyKey = `points-expiry:${membership._id}:${new Date(membership.pointsExpireAt).getTime()}`;
  await applyPointsChange({
    membershipId: membership._id,
    direction: '-',
    amount: membership.pointsExpiryPendingAmount,
    type: 'expire',
    actor: 'system',
    reason: 'Points expired according to membership settings.',
    idempotencyKey,
    recordOnly: true,
    balanceAfter: 0,
  });
  await Membership.updateOne(
    { _id: membership._id, pointsExpiryPendingAmount: membership.pointsExpiryPendingAmount },
    { $set: { pointsExpiryPendingAmount: 0 } },
  );
  return true;
}

async function expireInTransaction(membershipId, now, session) {
  const membership = await Membership.findOne({
    _id: membershipId,
    pointsBalance: { $gt: 0 },
    pointsExpireAt: { $lte: now },
  }).session(session);
  if (!membership) return false;

  await applyPointsChange({
    membershipId,
    direction: '-',
    amount: membership.pointsBalance,
    type: 'expire',
    actor: 'system',
    reason: 'Points expired according to membership settings.',
    idempotencyKey: `points-expiry:${membership._id}:${new Date(membership.pointsExpireAt).getTime()}`,
    expiresAt: now,
    expectedBalance: membership.pointsBalance,
    setBalanceTo: 0,
    session,
  });
  return true;
}

async function expireWithoutTransaction(membershipId, now) {
  const pending = await Membership.findOne({
    _id: membershipId,
    pointsExpiryPendingAmount: { $gt: 0 },
    pointsExpireAt: { $lte: now },
  });
  if (pending) return recordPendingExpiry(pending);

  const membership = await Membership.findOne({
    _id: membershipId,
    pointsBalance: { $gt: 0 },
    pointsExpireAt: { $lte: now },
  }).select('_id pointsBalance pointsExpireAt');
  if (!membership) return false;

  const lostBalance = membership.pointsBalance;
  const claimed = await Membership.findOneAndUpdate(
    {
      _id: membership._id,
      pointsBalance: lostBalance,
      pointsExpireAt: { $lte: now },
      pointsExpiryPendingAmount: 0,
    },
    { $set: { pointsBalance: 0, pointsExpiryPendingAmount: lostBalance } },
    { new: true },
  );
  if (!claimed) return false;
  return recordPendingExpiry(claimed);
}

export async function expireMembershipPoints(membershipId, now, session) {
  if (session) return expireInTransaction(membershipId, now, session);
  return expireWithoutTransaction(membershipId, now);
}
