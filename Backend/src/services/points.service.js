// Phase 3: Own every points-balance update and its matching ledger transaction.
import mongoose from 'mongoose';
import Membership from '../models/Membership.js';
import Plan from '../models/Plan.js';
import PointsTransaction from '../models/PointsTransaction.js';
import ApiError from '../utils/ApiError.js';
import { getPointsTier } from './membership.service.js';

const categories = ['membership_award', 'food', 'dance_floor', 'stay', 'spa', 'event', 'other', 'adjustment', 'refund'];

function validateAmount(amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new ApiError(400, 'Points amount must be a positive integer.');
  }
}

function normalizeHistoryOptions(options = {}) {
  const page = Math.max(1, Number.parseInt(options.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(options.limit, 10) || 20));
  const filter = {};
  if (options.type) filter.type = options.type;
  if (options.category) filter.category = options.category;
  if (options.from || options.to) {
    filter.createdAt = {};
    if (options.from) filter.createdAt.$gte = new Date(options.from);
    if (options.to) {
      const end = new Date(options.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(options.to)) end.setUTCHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  return { page, limit, filter };
}

async function createPointsTransaction(type, input, requireActive = false) {
  const {
    membershipId, amount, category, reason, reference = '', createdBy = null, idempotencyKey,
  } = input;
  validateAmount(amount);
  if (!categories.includes(category)) throw new ApiError(400, 'Points category is not supported.');
  if (typeof reason !== 'string' || !reason.trim()) throw new ApiError(400, 'A reason is required.');

  if (idempotencyKey) {
    const existing = await PointsTransaction.findOne({ idempotencyKey });
    if (existing) return existing;
  }

  const session = await mongoose.startSession();
  let transaction;
  try {
    await session.withTransaction(async () => {
      if (idempotencyKey) {
        const existing = await PointsTransaction.findOne({ idempotencyKey }).session(session);
        if (existing) {
          transaction = existing;
          return;
        }
      }

      const membershipFilter = { _id: membershipId };
      if (requireActive) membershipFilter.status = 'active';
      if (type === 'debit') membershipFilter.pointsBalance = { $gte: amount };
      if (type === 'credit') {
        membershipFilter.$or = [
          { pointsBalance: { $lte: Number.MAX_SAFE_INTEGER - amount } },
          { pointsBalance: { $exists: false } },
        ];
      }
      const change = type === 'credit' ? amount : -amount;
      const membership = await Membership.findOneAndUpdate(
        membershipFilter,
        { $inc: { pointsBalance: change } },
        { new: true, session, runValidators: true },
      );
      if (!membership) {
        const exists = await Membership.exists({ _id: membershipId }).session(session);
        if (!exists) throw new ApiError(404, 'Membership was not found.');
        if (requireActive) {
          const active = await Membership.exists({ _id: membershipId, status: 'active' }).session(session);
          if (!active) throw new ApiError(409, 'Points can only be changed for active memberships.');
        }
        if (type === 'credit') throw new ApiError(409, 'Points balance would exceed the supported integer range.');
        throw new ApiError(409, 'There are not enough points for this debit.');
      }

      [transaction] = await PointsTransaction.create([{
        user: membership.user,
        membership: membership._id,
        type,
        amount,
        category,
        reason: reason.trim(),
        reference: String(reference || '').trim(),
        createdBy,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        balanceAfter: membership.pointsBalance,
      }], { session });
    });
    return transaction;
  } catch (error) {
    if (idempotencyKey && error?.code === 11000) {
      const existing = await PointsTransaction.findOne({ idempotencyKey });
      if (existing) return existing;
    }
    throw error;
  } finally {
    await session.endSession();
  }
}

export function credit(input) {
  return createPointsTransaction('credit', input);
}

export function debit(input) {
  return createPointsTransaction('debit', input);
}

export function creditActiveMembership(input) {
  return createPointsTransaction('credit', input, true);
}

export function debitActiveMembership(input) {
  return createPointsTransaction('debit', input, true);
}

export async function getBalance(membershipId) {
  const membership = await Membership.findById(membershipId).select('pointsBalance');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  return membership.pointsBalance || 0;
}

export async function getHistory(membershipId, options = {}) {
  const { page, limit, filter } = normalizeHistoryOptions(options);
  const query = { membership: membershipId, ...filter };
  const [items, total] = await Promise.all([
    PointsTransaction.find(query).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    PointsTransaction.countDocuments(query),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function awardMembershipPoints(membershipId) {
  const membership = await Membership.findById(membershipId).populate('plan');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const memberNumber = Number.parseInt(membership.memberNumber, 10);
  if (!Number.isSafeInteger(memberNumber) || memberNumber < 1) {
    throw new ApiError(409, 'A valid member number is required before awarding membership points.');
  }
  const tier = getPointsTier(membership.plan, memberNumber);
  if (!tier) throw new ApiError(409, 'No points tier is configured for this membership plan.');

  return credit({
    membershipId: membership._id,
    amount: tier.points,
    category: 'membership_award',
    reason: `Membership points award: ${tier.label}`,
    idempotencyKey: `membership-award-${membership._id}`,
  });
}

export async function getMemberPoints(userId, options = {}) {
  const membership = await Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
    status: { $in: ['draft', 'profile_only', 'pending_payment', 'payment_pending', 'pending_verification', 'pending_approval', 'active', 'expired'] },
  }).sort({ createdAt: -1 }).populate('plan').lean();
  if (!membership) {
    return {
      balance: 0,
      membership: null,
      history: { items: [], page: 1, limit: 20, total: 0, pages: 0 },
    };
  }
  if (membership.status !== 'active') {
    return {
      balance: null,
      membership: {
        id: String(membership._id),
        status: membership.status,
        tier: membership.plan?.name || membership.plan?.title || '',
        memberNo: membership.memberNo || '',
      },
      history: { items: [], page: 1, limit: 20, total: 0, pages: 0 },
    };
  }
  const [balance, history] = await Promise.all([
    getBalance(membership._id),
    getHistory(membership._id, options),
  ]);
  return {
    balance,
    membership: {
      id: String(membership._id),
      status: membership.status,
      tier: membership.plan?.name || membership.plan?.title || '',
      memberNo: membership.memberNo || '',
    },
    history: {
      ...history,
      items: history.items.map(({ expiresAt, pointsExpireAt, earlyBird, earlyBirdApplied, approvalSeq, multiplier, phase, ...item }) => item),
    },
  };
}

export async function getActiveMemberPoints(userId, options = {}) {
  const membership = await Membership.findOne({ user: userId, status: 'active' }).sort({ createdAt: -1 }).lean();
  if (!membership) throw new ApiError(404, 'No active membership exists for this account.');
  const [balance, history] = await Promise.all([
    getBalance(membership._id),
    getHistory(membership._id, options),
  ]);
  return { balance, membership, history };
}

export async function getAdminPointsForUser(userId, options = {}) {
  const membership = await Membership.findOne({ user: userId, status: 'active' })
    .sort({ createdAt: -1 })
    .select('_id user plan status memberNumber memberId pointsBalance startDate endDate')
    .populate('plan', 'title slug')
    .lean();
  if (!membership) throw new ApiError(404, 'No active membership exists for this account.');
  const [balance, history] = await Promise.all([
    getBalance(membership._id),
    getHistory(membership._id, options),
  ]);
  return { balance, membership, history };
}

export async function bulkCredit({ membershipIds, filter, amount, reason, createdBy }) {
  validateAmount(amount);
  const query = { status: 'active' };
  if (membershipIds?.length) query._id = { $in: membershipIds };
  else if (filter?.planSlug) {
    const plan = await Plan.findOne({ slug: filter.planSlug, isActive: true }).select('_id').lean();
    if (!plan) return { results: [], total: 0, succeeded: 0 };
    query.plan = plan._id;
  }
  const memberships = await Membership.find(query).select('_id').limit(501).lean();
  if (memberships.length > 500) {
    throw new ApiError(400, 'Bulk points credit is limited to 500 memberships per request.');
  }
  const eligibleIds = new Set(memberships.map((membership) => String(membership._id)));
  const requestedIds = membershipIds?.length
    ? [...new Set(membershipIds.map((id) => id.toLowerCase()))]
    : memberships.map((membership) => membership._id);
  const results = [];

  for (const membershipId of requestedIds) {
    if (!eligibleIds.has(String(membershipId))) {
      results.push({ membershipId, success: false, message: 'Membership was not found or is not active.' });
      continue;
    }
    try {
      const transaction = await creditActiveMembership({
        membershipId,
        amount,
        category: 'adjustment',
        reason,
        createdBy,
      });
      results.push({ membershipId, success: true, transaction });
    } catch (error) {
      results.push({ membershipId, success: false, message: error.message });
    }
  }
  return { results, total: results.length, succeeded: results.filter((result) => result.success).length };
}

export async function reconcileBalances() {
  const totals = await PointsTransaction.aggregate([
    {
      $group: {
        _id: '$membership',
        balance: {
          $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', { $multiply: ['$amount', -1] }] },
        },
      },
    },
  ]);
  const ledgerBalances = new Map(totals.map((row) => [String(row._id), row.balance]));
  const mismatches = [];
  const cursor = Membership.find({}).select('_id pointsBalance').lean().cursor();

  for await (const membership of cursor) {
    const ledgerBalance = ledgerBalances.get(String(membership._id)) || 0;
    const storedBalance = membership.pointsBalance || 0;
    if (storedBalance !== ledgerBalance) {
      mismatches.push({ membershipId: String(membership._id), storedBalance, ledgerBalance });
    }
    ledgerBalances.delete(String(membership._id));
  }

  for (const [membershipId, ledgerBalance] of ledgerBalances) {
    mismatches.push({ membershipId, storedBalance: 0, ledgerBalance, missingMembership: true });
  }
  return { mismatchCount: mismatches.length, mismatches };
}
