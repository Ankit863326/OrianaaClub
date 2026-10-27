import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import ApiKey from '../models/ApiKey.js';
import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import '../models/MembershipPlan.js';
import '../models/Plan.js';
import PointLedger from '../models/PointLedger.js';
import Profile from '../models/Profile.js';
import Redemption from '../models/Redemption.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { getMembershipMemberCode } from '../utils/memberCode.js';
import { getSettings } from '../models/Setting.js';
import { applyPointsChange } from './point-change.service.js';
import { findMemberMatches, memberSearchError } from './member-search.service.js';

const hashApiKey = (key) => createHash('sha256').update(key).digest('hex');
const legacyCodePattern = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.length >= 8
    ? new RegExp(`^${digits.split('').join('\\s*')}$`, 'i')
    : /$a/;
};
const ledgerChannel = (channel = 'counter') => (
  channel === 'counter' ? 'billing_counter' : channel
);
const transactionUnsupported = (error) => [20, 303].includes(error?.code)
  || /transaction numbers are only allowed|transactions are not supported|replica set|mongos/i.test(error?.message || '');

async function executeWithTransaction(work, fallback) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (transactionUnsupported(error)) return fallback();
    throw error;
  } finally {
    await session.endSession();
  }
}

function datesEqual(left, right) {
  return new Date(left).getTime() === new Date(right).getTime();
}

function sameRedemption(redemption, membershipId, input) {
  return String(redemption.membership) === String(membershipId)
    && redemption.bookingId === (input.bookingId || '')
    && redemption.serviceType === input.serviceType
    && datesEqual(redemption.eventDate, input.eventDate)
    && redemption.billAmount === input.billAmount
    && redemption.pointsUsed === input.pointsToUse
    && String(redemption.familyMemberId || '') === String(input.familyMemberId || '');
}

async function findMembership({ memberCode, phone }) {
  let byCode = null;
  let byPhone = null;
  if (memberCode) {
    const matches = await findMemberMatches(memberCode);
    byCode = selectBillableMembership(matches);
  }
  if (phone) {
    const matches = await findMemberMatches(phone);
    byPhone = selectBillableMembership(matches);
  }
  if (byCode && byPhone && String(byCode._id) !== String(byPhone._id)) {
    throw new ApiError(409, 'The Member ID and phone number refer to different memberships.');
  }
  const membership = byCode || byPhone;
  if (!membership) throw new ApiError(404, 'Active membership was not found.');
  return membership;
}

function selectBillableMembership(matches) {
  if (!matches.memberships.length) throw memberSearchError(matches);
  if (matches.memberships.length > 1) {
    throw new ApiError(409, 'Multiple members found; refine your search.');
  }
  const membership = matches.memberships.find((item) => ['active', 'expired'].includes(item.status));
  if (!membership) throw new ApiError(404, 'Active membership was not found.');
  return membership;
}

function currentValidity(membership, now = new Date()) {
  return membership.status === 'active'
    && membership.membershipExpireAt instanceof Date
    && membership.membershipExpireAt > now;
}

function priceAfterDiscount(billAmount, discountPercent) {
  const discount = Number((BigInt(billAmount) * BigInt(discountPercent)) / 100n);
  return billAmount - discount;
}

export async function checkMember(input) {
  const [membership, settings] = await Promise.all([
    findMembership(input),
    getSettings(),
  ]);
  const now = new Date();
  const valid = currentValidity(membership, now);
  const discountedAmount = valid
    ? priceAfterDiscount(input.billAmount, settings.discountPercent)
    : input.billAmount;
  const pointsValid = valid && membership.pointsExpireAt instanceof Date && membership.pointsExpireAt > now;
  const pointsBalance = Number.isSafeInteger(membership.pointsBalance) ? membership.pointsBalance : 0;
  const [profile, family] = await Promise.all([
    Profile.findOne({ user: membership.user }).select('fullName').lean(),
    FamilyMember.find({ membership: membership._id, status: 'active' }).select(
      'name fullName relation relationship type photo photoUrl',
    ).sort({ createdAt: 1 }).lean(),
  ]);
  return {
    valid,
    memberName: profile?.fullName || '',
    tier: membership.plan?.name || membership.plan?.title || '',
    discountPercent: valid ? settings.discountPercent : 0,
    discountedAmount,
    pointsBalance,
    maxPointsUsable: pointsValid ? Math.min(pointsBalance, discountedAmount) : 0,
    pointsExpireAt: membership.pointsExpireAt,
    membershipExpireAt: membership.membershipExpireAt,
    familyMembers: family.map((member) => ({
      id: String(member._id),
      name: member.name || member.fullName,
      relation: member.relation || member.relationship,
      type: member.type,
      photoUrl: member.photoUrl || member.photo || '',
    })),
  };
}

async function validateRedemption(membership, input, session = null) {
  const now = new Date();
  if (!currentValidity(membership, now)) throw new ApiError(409, 'Membership is not active or has expired.');
  if (!membership.pointsExpireAt || membership.pointsExpireAt <= now) {
    throw new ApiError(409, 'Membership points have expired.');
  }
  const settings = await getSettings();
  const discountedAmount = priceAfterDiscount(input.billAmount, settings.discountPercent);
  if (input.pointsToUse > discountedAmount) {
    throw new ApiError(400, 'Points used cannot exceed the discounted bill amount.');
  }
  if (input.familyMemberId) {
    const familyMember = await FamilyMember.findOne({
      _id: input.familyMemberId,
      membership: membership._id,
      status: 'active',
    }).session(session);
    if (!familyMember) throw new ApiError(400, 'Selected family member does not belong to this membership.');
  }
  return {
    discountedAmount,
    remainingToPay: discountedAmount - input.pointsToUse,
  };
}

async function existingRedemption(billId, membershipId, input, session = null) {
  const query = Redemption.findOne({ billId });
  if (session) query.session(session);
  const existing = await query;
  if (!existing) return null;
  if (!sameRedemption(existing, membershipId, input)) {
    throw new ApiError(409, 'This bill ID was already used with different redemption details.');
  }
  return {
    success: true,
    discountedAmount: existing.discountedAmount,
    pointsUsed: existing.pointsUsed,
    remainingToPay: existing.remainingToPay,
    newBalance: existing.balanceAfter,
    redemptionId: String(existing._id),
  };
}

async function createRedemptionWrite(membership, input, calculation, apiKeyId, session) {
  const ledger = await applyPointsChange({
    membershipId: membership._id,
    direction: '-',
    amount: input.pointsToUse,
    channel: ledgerChannel(input.channel),
    type: 'debit_redeem',
    actor: 'billing',
    billId: input.billId,
    bookingId: input.bookingId,
    reason: 'Points redeemed at billing.',
    idempotencyKey: input.billId,
    skipIdempotencyLookup: true,
    requireActive: true,
    requireUnexpired: true,
    requireMembershipUnexpired: true,
    failureMessage: 'Membership points are expired or the balance is insufficient.',
    session,
  });
  const balanceAfter = ledger.balanceAfter;
  const [redemption] = await Redemption.create([{
    membership: membership._id,
    memberCode: getMembershipMemberCode(membership),
    billId: input.billId,
    bookingId: input.bookingId,
    channel: ledgerChannel(input.channel),
    serviceType: input.serviceType,
    eventDate: input.eventDate,
    billAmount: input.billAmount,
    discountPercent: calculation.discountPercent,
    discountedAmount: calculation.discountedAmount,
    pointsUsed: input.pointsToUse,
    remainingToPay: calculation.remainingToPay,
    balanceAfter,
    familyMemberId: input.familyMemberId || null,
    createdByApiKey: apiKeyId,
  }], session ? { session } : undefined);
  return {
    success: true,
    discountedAmount: calculation.discountedAmount,
    pointsUsed: input.pointsToUse,
    remainingToPay: calculation.remainingToPay,
    newBalance: balanceAfter,
    redemptionId: String(redemption._id),
  };
}

async function redeemWithoutTransaction(membershipId, input, calculation, apiKeyId, memberCode) {
  const debit = await applyPointsChange({
    membershipId,
    direction: '-',
    amount: input.pointsToUse,
    channel: ledgerChannel(input.channel),
    type: 'debit_redeem',
    actor: 'billing',
    billId: input.billId,
    bookingId: input.bookingId,
    reason: 'Points redeemed at billing.',
    idempotencyKey: input.billId,
    skipIdempotencyLookup: true,
    requireActive: true,
    requireUnexpired: true,
    requireMembershipUnexpired: true,
    failureMessage: 'Membership points are expired or the balance is insufficient.',
  });
  let redemption;
  try {
    redemption = await Redemption.create({
      membership: membershipId,
      memberCode,
      billId: input.billId,
      bookingId: input.bookingId,
      channel: ledgerChannel(input.channel),
      serviceType: input.serviceType,
      eventDate: input.eventDate,
      billAmount: input.billAmount,
      discountPercent: calculation.discountPercent,
      discountedAmount: calculation.discountedAmount,
      pointsUsed: input.pointsToUse,
      remainingToPay: calculation.remainingToPay,
      balanceAfter: debit.balanceAfter,
      familyMemberId: input.familyMemberId || null,
      createdByApiKey: apiKeyId,
    });
    return {
      success: true,
      discountedAmount: calculation.discountedAmount,
      pointsUsed: input.pointsToUse,
      remainingToPay: calculation.remainingToPay,
      newBalance: debit.balanceAfter,
      redemptionId: String(redemption._id),
    };
  } catch (error) {
    if (redemption) await Redemption.deleteOne({ _id: redemption._id });
    try {
      await compensateFailedRedemption(membershipId, input, input.pointsToUse);
    } catch (compensationError) {
      throw new Error(`Redemption write failed and compensation failed: ${compensationError.message}`);
    }
    if (error?.code === 11000) {
      const previous = await existingRedemption(input.billId, membershipId, input);
      if (previous) return previous;
    }
    throw error;
  }
}

async function compensateFailedRedemption(membershipId, input, amount) {
  if (amount <= 0) return;
  try {
    await applyPointsChange({
      membershipId,
      direction: '+',
      amount,
      channel: ledgerChannel(input.channel),
      type: 'refund',
      actor: 'system',
      billId: input.billId,
      reason: 'Compensation for a failed redemption write.',
      idempotencyKey: `compensation:${input.billId}`,
    });
  } catch (error) {
    error.message = `Redemption compensation failed: ${error.message}`;
    throw error;
  }
}

export async function redeem(input, apiKeyId) {
  const membership = await findMembership({ memberCode: input.memberCode });
  const memberCode = getMembershipMemberCode(membership);
  const duplicate = await existingRedemption(input.billId, membership._id, input);
  if (duplicate) return duplicate;
  const validation = await validateRedemption(membership, input);
  const calculation = {
    ...validation,
    discountPercent: (await getSettings()).discountPercent,
  };

  try {
    return await executeWithTransaction(async (session) => {
      const duplicateInTransaction = await existingRedemption(input.billId, membership._id, input, session);
      if (duplicateInTransaction) return duplicateInTransaction;
      const latest = await Membership.findById(membership._id).session(session).lean();
      if (!latest) throw new ApiError(404, 'Membership was not found.');
      const latestCalculation = await validateRedemption(latest, input, session);
      return createRedemptionWrite(
        latest,
        input,
        { ...latestCalculation, discountPercent: calculation.discountPercent },
        apiKeyId,
        session,
      );
    }, async () => {
      const latest = await Membership.findById(membership._id).lean();
      if (!latest) throw new ApiError(404, 'Membership was not found.');
      const latestCalculation = await validateRedemption(latest, input);
      return redeemWithoutTransaction(
        membership._id,
        input,
        { ...latestCalculation, discountPercent: calculation.discountPercent },
        apiKeyId,
        memberCode,
      );
    });
  } catch (error) {
    if (error?.code === 11000) {
      const previous = await existingRedemption(input.billId, membership._id, input);
      if (previous) return previous;
    }
    throw error;
  }
}

async function cancelRedemptionRecord(redemption, cancelledAt, session = null) {
  if (redemption.status === 'cancelled') return redemption;
  if (cancelledAt > redemption.eventDate) throw new ApiError(409, 'A redemption cannot be cancelled after its event date.');
  const updated = await Redemption.findOneAndUpdate(
    { _id: redemption._id, status: 'confirmed' },
    { $set: { status: 'cancelled', cancelledAt } },
    { new: true, session, runValidators: true },
  );
  if (!updated) {
    const currentQuery = Redemption.findById(redemption._id);
    if (session) currentQuery.session(session);
    const current = await currentQuery;
    if (current?.status === 'cancelled') return current;
    throw new ApiError(409, 'Redemption changed while cancellation was being processed.');
  }
  return updated;
}

export async function cancelRedemption({ billId, bookingId, cancelledAt }) {
  const filter = billId ? { billId } : { bookingId };
  const redemption = await Redemption.findOne(filter);
  if (!redemption) throw new ApiError(404, 'Redemption was not found.');
  if (redemption.status === 'cancelled') return redemption;
  return executeWithTransaction(async (session) => {
    const current = await Redemption.findById(redemption._id).session(session);
    if (!current) throw new ApiError(404, 'Redemption was not found.');
    return cancelRedemptionRecord(current, cancelledAt, session);
  }, async () => {
    const current = await Redemption.findById(redemption._id);
    if (!current) throw new ApiError(404, 'Redemption was not found.');
    return cancelRedemptionRecord(current, cancelledAt);
  });
}

export async function getMemberBalance(memberCode) {
  const membership = await findMembership({ memberCode });
  const expiredByDate = membership.membershipExpireAt instanceof Date
    && membership.membershipExpireAt <= new Date();
  return {
    pointsBalance: membership.pointsBalance || 0,
    pointsExpireAt: membership.pointsExpireAt,
    membershipExpireAt: membership.membershipExpireAt,
    status: membership.status === 'active' && expiredByDate ? 'expired' : membership.status,
  };
}

function membershipLookupItem(membership, profiles, users) {
  const userId = String(membership.user?._id || membership.customer || membership.user || '');
  const profile = profiles.get(userId);
  const user = users.get(userId);
  return {
    id: String(membership._id),
    memberCode: membership.memberCode || '',
    name: profile?.fullName || user?.firstName || '',
    email: user?.email || '',
    tier: membership.plan?.name || membership.plan?.title || '',
    status: membership.status,
    pointsBalance: membership.pointsBalance || 0,
  };
}

export async function lookupMembership(query) {
  const results = await findMemberMatches(query);
  if (!results.memberships.length) throw memberSearchError(results);
  const matches = results.memberships.slice(0, 10);
  const userIds = matches.map((membership) => membership.user?._id || membership.customer || membership.user);
  const [profileRows, userRows] = await Promise.all([
    Profile.find({ user: { $in: userIds } }).select('user fullName').lean(),
    User.find({ _id: { $in: userIds } }).select('firstName email').lean(),
  ]);
  const profileMap = new Map(profileRows.map((profile) => [String(profile.user), profile]));
  const userMap = new Map(userRows.map((user) => [String(user._id), user]));
  const result = matches.map((membership) => membershipLookupItem(membership, profileMap, userMap));
  return result.length === 1 ? result[0] : result;
}

async function resolveMembershipId(identifier) {
  const matches = await findMemberMatches(identifier);
  if (!matches.memberships.length) throw memberSearchError(matches);
  if (matches.memberships.length > 1) {
    throw new ApiError(409, 'Multiple members found; refine your search.');
  }
  const membership = matches.memberships[0];
  if (membership.status !== 'active') throw new ApiError(409, 'Membership is not active');
  return membership._id;
}

export async function adjustPoints(membershipId, { amount, direction, reason }) {
  const resolvedId = await resolveMembershipId(membershipId);
  return executeWithTransaction(async (session) => {
    return applyPointsChange({
      membershipId: resolvedId,
      direction,
      amount,
      channel: 'admin_manual',
      type: 'admin_adjust',
      actor: 'admin',
      reason,
      requireActive: true,
      insufficientMessage: 'Insufficient points',
      balanceChangedMessage: 'Points balance changed before adjustment',
      session,
    });
  }, () => applyPointsChange({
    membershipId: resolvedId,
    direction,
    amount,
    channel: 'admin_manual',
    type: 'admin_adjust',
    actor: 'admin',
    reason,
    requireActive: true,
    insufficientMessage: 'Insufficient points',
    balanceChangedMessage: 'Points balance changed before adjustment',
  }));
}

export async function listRedemptions(query) {
  const page = query.page;
  const limit = query.limit;
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.serviceType) filter.serviceType = query.serviceType;
  if (query.channel === 'billing_counter') {
    filter.$or = [{ channel: 'billing_counter' }, { channel: { $exists: false } }];
  } else if (query.channel) {
    filter.channel = query.channel;
  }
  if (query.memberCode) {
    const search = String(query.memberCode).trim();
    const legacyPattern = legacyCodePattern(search);
    const memberships = await Membership.find({
      $or: [
        { memberCode: search },
        { memberNo: search },
        { legacyMemberCode: legacyPattern },
      ],
    }).select('_id').lean();
    const membershipIds = memberships.map((membership) => membership._id);
    if (membershipIds.length) filter.membership = { $in: membershipIds };
    else filter.memberCode = { $in: [search, search.replace(/\s+/g, '')] };
  }
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) end.setUTCHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  const [items, total] = await Promise.all([
    Redemption.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Redemption.countDocuments(filter),
  ]);
  const memberships = items.length
    ? await Membership.find({ _id: { $in: items.map((item) => item.membership) } })
      .select('_id memberCode memberNo memberNumber legacyMemberCode')
      .lean()
    : [];
  const memberCodeById = new Map(memberships.map((membership) => [
    String(membership._id),
    getMembershipMemberCode(membership),
  ]));
  return {
    items: items.map((item) => ({
      ...item,
      displayMemberCode: memberCodeById.get(String(item.membership)) || '',
    })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function getMembershipLedger(membershipId, query) {
  const membership = await Membership.exists({ _id: membershipId });
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const filter = { membership: membershipId };
  if (query.channel === 'billing_counter') {
    filter.$or = [{ channel: 'billing_counter' }, { channel: { $exists: false } }];
  } else if (query.channel) {
    filter.channel = query.channel;
  }
  const [items, total] = await Promise.all([
    PointLedger.find(filter).sort({ createdAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    PointLedger.countDocuments(filter),
  ]);
  return {
    items, page: query.page, limit: query.limit, total,
    pages: Math.ceil(total / query.limit),
  };
}

export async function createBillingApiKey(adminId, name) {
  const rawKey = randomBytes(32).toString('base64url');
  const apiKey = await ApiKey.create({
    name,
    keyHash: hashApiKey(rawKey),
    createdBy: adminId,
  });
  return { id: String(apiKey._id), name: apiKey.name, key: rawKey, createdAt: apiKey.createdAt };
}

export async function listBillingApiKeys() {
  return ApiKey.find().select('name isActive lastUsedAt createdBy createdAt').sort({ createdAt: -1 }).lean();
}

export async function revokeBillingApiKey(id) {
  const key = await ApiKey.findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true })
    .select('name isActive lastUsedAt createdAt');
  if (!key) throw new ApiError(404, 'Billing API key was not found.');
  return key;
}

export async function cancelAdminRedemption(id, cancelledAt) {
  const redemption = await Redemption.findById(id);
  if (!redemption) throw new ApiError(404, 'Redemption was not found.');
  return cancelRedemption({ billId: redemption.billId, cancelledAt });
}
