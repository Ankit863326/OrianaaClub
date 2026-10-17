import Membership from '../models/Membership.js';
import MembershipPlan from '../models/MembershipPlan.js';
import '../models/Plan.js';
import FamilyMember from '../models/FamilyMember.js';
import PointLedger from '../models/PointLedger.js';
import Redemption from '../models/Redemption.js';
import { getSettings } from '../models/Setting.js';
import { formatMemberCode, getMembershipMemberCode } from '../utils/memberCode.js';
import ApiError from '../utils/ApiError.js';

const visibleMembershipStatuses = [
  'draft',
  'pending_payment',
  'pending_verification',
  'active',
  'expired',
];

async function latestMemberMembership(userId) {
  const membership = await Membership.findOne({
    user: userId,
    status: { $in: visibleMembershipStatuses },
  })
    .sort({ createdAt: -1 })
    .populate('plan')
    .lean();
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  return membership;
}

export async function getMyMemberCode(userId) {
  const membership = await Membership.findOne({
    user: userId,
    status: { $in: visibleMembershipStatuses },
  })
    .sort({ createdAt: -1 })
    .select('memberCode memberNumber')
    .lean();
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const memberCode = getMembershipMemberCode(membership);
  if (!memberCode) throw new ApiError(409, 'A member code is not assigned yet.');
  return memberCode;
}

function membershipStatus(membership, now) {
  if (
    membership.status === 'active'
    && membership.membershipExpireAt
    && membership.membershipExpireAt <= now
  ) return 'expired';
  return membership.status;
}

export async function getMyMembership(userId) {
  const [membership, settings] = await Promise.all([
    latestMemberMembership(userId),
    getSettings(),
  ]);
  const now = new Date();
  const status = membershipStatus(membership, now);
  const pointsExpired = !membership.pointsExpireAt || membership.pointsExpireAt <= now;
  const pointsBalance = Number.isSafeInteger(membership.pointsBalance) ? membership.pointsBalance : 0;
  const canRenew = ['active', 'expired'].includes(status) && (pointsBalance === 0 || pointsExpired);
  const [nominee, plans] = await Promise.all([
    membership.nominee
      ? FamilyMember.findOne({
        _id: membership.nominee,
        membership: membership._id,
        status: 'active',
        type: 'adult',
      }).select('name fullName relation relationship').lean()
      : null,
    canRenew
      ? MembershipPlan.find({ isActive: true })
        .select('name price renewalPoints sortOrder')
        .sort({ sortOrder: 1 })
        .lean()
      : [],
  ]);
  const memberCode = getMembershipMemberCode(membership);
  return {
    tier: membership.plan?.name || membership.plan?.title || '',
    status,
    memberCode,
    formattedMemberCode: memberCode ? formatMemberCode(memberCode) : '',
    pointsBalance,
    pointsExpireAt: membership.pointsExpireAt,
    membershipExpireAt: membership.membershipExpireAt,
    earlyBirdApplied: Boolean(membership.earlyBirdApplied),
    discountPercent: status === 'active' ? settings.discountPercent : 0,
    nominee: nominee ? {
      id: String(nominee._id),
      name: nominee.name || nominee.fullName || '',
      relation: nominee.relation || nominee.relationship || '',
    } : null,
    canRenew,
    renewalPlans: canRenew ? plans.map((plan) => ({
      id: String(plan._id),
      name: plan.name,
      price: plan.price,
      renewalPoints: plan.renewalPoints,
    })) : [],
  };
}

function pagination(query) {
  return {
    page: query.page,
    limit: query.limit,
    skip: (query.page - 1) * query.limit,
  };
}

function dateRange(from, to) {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return range;
}

export async function getMyRedemptions(userId, query) {
  const membership = await latestMemberMembership(userId);
  const { page, limit, skip } = pagination(query);
  const filter = { membership: membership._id };
  if (query.status) filter.status = query.status;
  const createdAt = dateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;
  const [items, total] = await Promise.all([
    Redemption.find(filter)
      .select('createdAt serviceType bookingId billId billAmount discountedAmount pointsUsed balanceAfter status refundedPoints')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Redemption.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      date: item.createdAt,
      service: item.serviceType,
      bookingId: item.bookingId,
      billId: item.billId,
      billAmount: item.billAmount,
      discountedAmount: item.discountedAmount,
      pointsUsed: item.pointsUsed,
      balanceAfter: item.balanceAfter,
      status: item.status,
      refundedPoints: item.refundedPoints,
    })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function getMyPointsHistory(userId, query) {
  const membership = await latestMemberMembership(userId);
  const { page, limit, skip } = pagination(query);
  const filter = { membership: membership._id };
  if (query.type) filter.type = query.type;
  const createdAt = dateRange(query.from, query.to);
  if (createdAt) filter.createdAt = createdAt;
  const [items, total] = await Promise.all([
    PointLedger.find(filter)
      .select('type amount direction balanceAfter note channel createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PointLedger.countDocuments(filter),
  ]);
  return {
    items: items.map((item) => ({
      type: item.type,
      amount: item.amount,
      direction: item.direction,
      balanceAfter: item.balanceAfter,
      note: item.note,
      channel: item.channel || 'billing_counter',
      date: item.createdAt,
    })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}
