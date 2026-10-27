import Membership from '../models/Membership.js';
import MembershipPlan from '../models/MembershipPlan.js';
import '../models/Plan.js';
import FamilyMember from '../models/FamilyMember.js';
import PointLedger from '../models/PointLedger.js';
import PointsLedger from '../models/PointsLedger.js';
import { getBalance, getMemberSafeLedger } from './points-ledger.service.js';
import Redemption from '../models/Redemption.js';
import { getSettings } from '../models/Setting.js';
import { getFamilyTier } from './family-tier.service.js';
import Verification from '../models/Verification.js';
import { formatMemberCode, getMembershipMemberCode, isMemberId } from '../utils/memberCode.js';
import ApiError from '../utils/ApiError.js';

const visibleMembershipStatuses = [
  'draft',
  'profile_only',
  'pending_payment',
  'payment_pending',
  'pending_verification',
  'pending_approval',
  'active',
  'expired',
];

async function latestMemberMembership(userId) {
  const membership = await Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
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
    memberType: 'primary',
    linkedTo: null,
    status: { $in: visibleMembershipStatuses },
  })
    .sort({ createdAt: -1 })
    .select('memberNo memberCode memberId legacyMemberCode memberNumber')
    .lean();
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const memberCode = getMembershipMemberCode(membership);
  if (!memberCode) throw new ApiError(409, 'A Member ID is not assigned yet.');
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

function wholeYearsBetween(startValue, endValue) {
  if (!startValue || !endValue) return null;
  const start = new Date(startValue);
  const end = new Date(endValue);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  let years = end.getUTCFullYear() - start.getUTCFullYear();
  if (
    end.getUTCMonth() < start.getUTCMonth()
    || (end.getUTCMonth() === start.getUTCMonth() && end.getUTCDate() < start.getUTCDate())
  ) years -= 1;
  return years > 0 ? years : null;
}

export async function getMyMembership(userId) {
  const [membership, settings] = await Promise.all([
    latestMemberMembership(userId),
    getSettings(),
  ]);
  const now = new Date();
  const status = membershipStatus(membership, now);
  const pointsExpired = !membership.pointsExpireAt || membership.pointsExpireAt <= now;
  const [ledgerBalance, hasPointsLedger] = await Promise.all([
    getBalance(membership._id),
    PointsLedger.exists({ memberId: membership._id }),
  ]);
  const pointsBalance = hasPointsLedger
    ? ledgerBalance
    : Number.isSafeInteger(membership.pointsBalance) ? membership.pointsBalance : 0;
  const canRenew = ['active', 'expired'].includes(status) && (pointsBalance === 0 || pointsExpired);
  const [nominee, plans, familyProfiles] = await Promise.all([
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
    FamilyMember.find({ membership: membership._id, status: { $ne: 'removed' }, isPrimary: { $ne: true } })
      .select('_id name fullName relation relationship type status memberType memberNo isNominee nomineeRole designation emailConfirmedAt paymentConfirmedAt discountPct parentSide isPrimary phone dob dateOfBirth anniversaryDate photo photoUrl pendingAction pendingChanges')
      .sort({ createdAt: 1 })
      .lean(),
  ]);
  const memberCode = getMembershipMemberCode(membership);
  const activatedAt = membership.activatedAt || membership.startDate || membership.approvedAt || null;
  const membershipExpireAt = membership.membershipExpireAt || membership.endDate || null;
  const pointsExpireAt = membership.pointsExpireAt || null;
  const membershipValidityYears = wholeYearsBetween(activatedAt, membershipExpireAt)
    ?? (membershipExpireAt ? settings.membershipValidityYears : null);
  const pointsValidityYears = wholeYearsBetween(activatedAt, pointsExpireAt)
    ?? (pointsExpireAt ? settings.pointsValidityYears : null);
  const familyIds = familyProfiles.map((member) => member._id);
  const [familyMemberships, verifications] = await Promise.all([
    familyIds.length
      ? Membership.find({ familyMember: { $in: familyIds } })
        .select('_id familyMember status memberNo memberCode memberId')
        .lean()
      : [],
    familyIds.length
      ? Verification.find({ memberId: { $in: familyIds } }).select('memberId status').lean()
      : [],
  ]);
  const familyMembershipById = new Map(familyMemberships.map((item) => [String(item.familyMember), item]));
  const verificationByMemberId = new Map(verifications.map((item) => [String(item.memberId), item.status]));
  const familyMemberViews = await Promise.all(familyProfiles.map(async (member) => {
    const linkedMembership = familyMembershipById.get(String(member._id));
    const isNominee = Boolean(member.isNominee || member.memberType?.startsWith('nominee'));
    const isApproved = !isNominee && linkedMembership?.status === 'active';
    const storedFamilyCode = linkedMembership?.memberId || linkedMembership?.memberCode
      || linkedMembership?.memberNo || member.memberId || member.memberNo || '';
    return {
      id: String(member._id),
      name: member.name || member.fullName || '',
      relation: member.relation || member.relationship || '',
      parentSide: member.parentSide || 'member',
      type: member.type,
      status: member.status,
      dob: member.dob || member.dateOfBirth || null,
      anniversaryDate: member.anniversaryDate || null,
      phone: member.phone || '',
      photo: member.photo || member.photoUrl || '',
      pendingAction: member.pendingAction || '',
      pendingChanges: member.pendingChanges || null,
      memberNo: !isNominee && isMemberId(storedFamilyCode) ? storedFamilyCode : '',
      memberId: !isNominee && isMemberId(storedFamilyCode) ? storedFamilyCode : '',
      verificationStatus: isNominee
        ? (member.emailConfirmedAt ? 'verified' : 'not_added')
        : verificationByMemberId.get(String(member._id)) || 'not_added',
      emailConfirmed: Boolean(member.emailConfirmedAt),
      isNominee,
      nomineeRole: member.nomineeRole || member.designation || '',
      memberStatus: linkedMembership?.status || '',
      ...(isApproved ? { pointsBalance: await getBalance(linkedMembership._id) } : {}),
    };
  }));
  const familyConfig = settings.familyMembership;
  const tierConfig = getFamilyTier(membership.plan, familyConfig.tiers);
  const family = {
    adults: familyMemberViews.filter((member) => member.type === 'adult' && !member.isNominee),
    children: familyMemberViews.filter((member) => member.type === 'child' && !member.isNominee),
    nominees: familyMemberViews.filter((member) => member.isNominee).map(({ pointsBalance, ...member }) => member),
  };
  return {
    tier: membership.plan?.name || membership.plan?.title || '',
    status,
    memberNo: memberCode,
    memberCode,
    memberId: memberCode,
    formattedMemberCode: memberCode ? formatMemberCode(memberCode) : '',
    ...(membershipExpireAt ? {
      membershipExpireAt,
      membershipValidityYears,
    } : {}),
    ...(pointsExpireAt ? {
      pointsExpireAt,
      pointsValidityYears,
    } : {}),
    ...(status === 'active' ? { pointsBalance } : {}),
    ...(status === 'active' ? { pointsCredited: hasPointsLedger } : {}),
    discountPercent: status === 'active' ? settings.discountPercent : 0,
    paymentConfirmedAt: membership.paymentConfirmedAt || null,
    approvedAt: membership.approvedAt || null,
    family,
    familyPolicy: {
      enabled: tierConfig?.familyEnabled !== false,
      discounts: familyConfig.discounts,
      limits: familyConfig.limits,
      maxNominees: tierConfig?.maxNominees ?? 0,
    },
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
  const [legacyItems, legacyTotal, safeLedger] = await Promise.all([
    PointLedger.find(filter)
      .select('type amount direction balanceAfter note channel createdAt')
      .sort({ createdAt: -1, _id: -1 })
      .limit(skip + limit)
      .lean(),
    PointLedger.countDocuments(filter),
    getMemberSafeLedger(membership._id),
  ]);
  const newItems = query.type && query.type !== 'credit_joining'
    ? []
    : safeLedger
      .filter((entry) => !createdAt || (
        entry.creditedAt >= createdAt.$gte || !createdAt.$gte
      ) && (
        entry.creditedAt <= createdAt.$lte || !createdAt.$lte
      ))
      .map((entry) => ({
        points: entry.points,
        amountBasis: entry.pointsBasis,
        date: entry.creditedAt,
        status: entry.status,
      }));
  const items = [
    ...legacyItems.map((item) => ({
      points: item.direction === 'debit' || item.direction === '-' ? -item.amount : item.amount,
      amountBasis: null,
      date: item.createdAt,
      status: item.type === 'expire' ? 'expired' : 'active',
    })),
    ...newItems,
  ]
    .sort((left, right) => right.date - left.date)
    .slice(skip, skip + limit);
  const total = legacyTotal + newItems.length;
  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}
