import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import IdentityVerification from '../models/IdentityVerification.js';
import MembershipPlan from '../models/MembershipPlan.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import PointLedger from '../models/PointLedger.js';
import Redemption from '../models/Redemption.js';
import Setting, { getSettings } from '../models/Setting.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { formatMemberCode, getMembershipMemberCode } from '../utils/memberCode.js';
import { findMemberMatches } from './member-search.service.js';
import { listMembershipsWithPointsExpiring } from './membership-expiry.service.js';
import { groupFamily } from './family.service.js';

function pagination(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export async function listMembershipPlans() {
  const [items, setting, earlyBirdUsed] = await Promise.all([
    MembershipPlan.find().sort({ sortOrder: 1 }).lean(),
    getSettings(),
    Membership.countDocuments({ earlyBirdApplied: true }),
  ]);
  return {
    items,
    earlyBird: {
      used: earlyBirdUsed,
      limit: setting.earlyBirdLimit,
      remaining: Math.max(0, setting.earlyBirdLimit - earlyBirdUsed),
    },
  };
}

export async function getEarlyBirdCounter() {
  const [setting, used] = await Promise.all([
    getSettings(),
    Membership.countDocuments({ earlyBirdApplied: true }),
  ]);
  return {
    used,
    limit: setting.earlyBirdLimit,
    remaining: Math.max(0, setting.earlyBirdLimit - used),
  };
}

export async function updateMembershipPlan(planId, values) {
  const plan = await MembershipPlan.findByIdAndUpdate(
    planId,
    { $set: values },
    { new: true, runValidators: true },
  );
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  return plan;
}

export async function getMembershipSettings() {
  const settings = await getSettings();
  return {
    discountPercent: settings.discountPercent,
    gstEnabled: settings.gstEnabled,
    gstRate: settings.gstRate,
    gstLabel: settings.gstLabel,
    gstin: settings.gstin || '',
    pointsValidityYears: settings.pointsValidityYears,
    membershipValidityYears: settings.membershipValidityYears,
    maxFamilyMembers: settings.maxFamilyMembers,
    childAgeLimit: settings.childAgeLimit,
    earlyBirdLimit: settings.earlyBirdLimit,
    receiptCompanyName: settings.receiptCompanyName || 'Orianaa by Saptagiri Hospitality & Lifestyle Pvt. Ltd.',
    receiptAddress: settings.receiptAddress || '',
    receiptGstin: settings.receiptGstin || '',
    receiptFooterNote: settings.receiptFooterNote || '',
  };
}

export async function updateMembershipSettings(values) {
  const settings = await Setting.findById('global');
  if (!settings) throw new Error('Membership settings are not seeded. Run npm run seed:membership.');
  Object.assign(settings, values);
  await settings.save();
  return getMembershipSettings();
}

export async function listMemberships(query) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  const userFilter = {};
  if (query.status) filter.status = query.status;
  if (query.documentsPending) {
    const verifiedUsers = await IdentityVerification.find({ status: 'verified' }).distinct('user');
    userFilter.$nin = verifiedUsers;
    if (!query.status) filter.status = 'pending_verification';
  }
  if (query.notActivated) {
    const pendingUsers = await User.find({ role: 'member', status: 'pending', deletedAt: null }).distinct('_id');
    userFilter.$in = pendingUsers;
  }
  if (Object.keys(userFilter).length) filter.user = userFilter;
  if (query.tier) {
    if (/^[a-f\d]{24}$/i.test(query.tier)) {
      filter.plan = query.tier;
    } else {
      const [catalogPlan, membershipPlans] = await Promise.all([
        Plan.findOne({ slug: query.tier.toLowerCase() }).select('_id').lean(),
        MembershipPlan.find().select('_id name').lean(),
      ]);
      const membershipPlanIds = membershipPlans
        .filter((plan) => String(plan.name || '').toLowerCase()
          .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') === query.tier.toLowerCase())
        .map((plan) => plan._id);
      const planFilters = [
        ...(catalogPlan ? [{ plan: catalogPlan._id, planModel: 'Plan' }] : []),
        ...(membershipPlanIds.length
          ? [{ plan: { $in: membershipPlanIds }, planModel: 'MembershipPlan' }]
          : []),
      ];
      if (planFilters.length) filter.$or = planFilters;
      else filter._id = { $in: [] };
    }
  }
  if (query.search) {
    const matches = await findMemberMatches(query.search);
    filter._id = { $in: matches.memberships.map((membership) => membership._id) };
  }
  const [memberships, total, plans] = await Promise.all([
    Membership.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('plan', 'name title price sortOrder')
      .populate('user', 'firstName email status activationEmailStatus activationEmailSentAt')
      .lean(),
    Membership.countDocuments(filter),
    MembershipPlan.find().select('name').lean(),
  ]);
  const ids = memberships.map((membership) => membership.user?._id).filter(Boolean);
  const profiles = await Profile.find({ user: { $in: ids } }).select('user fullName mobile').lean();
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const items = memberships.map((membership) => ({
    ...membership,
    applicationState: membership.user?.status === 'active' ? 'Active'
      : membership.status === 'draft' ? 'Draft'
        : membership.status === 'pending_payment' ? 'Payment pending'
          : ['active', 'pending_verification'].includes(membership.status) ? 'Paid'
            : 'Password not set',
    memberCode: getMembershipMemberCode(membership),
    formattedMemberCode: getMembershipMemberCode(membership)
      ? formatMemberCode(getMembershipMemberCode(membership))
      : '',
    profile: profileByUser.get(String(membership.user?._id)) || null,
  }));
  return {
    items,
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
    tiers: plans,
  };
}

export async function getMembershipDetails(membershipId) {
  const membership = await Membership.findById(membershipId)
    .populate('plan')
    .populate('user', 'firstName email status activationEmailStatus activationEmailSentAt')
    .populate('previousMembership', 'memberCode memberNumber termNumber status')
    .lean();
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const [profile, family, payments, nominee, settings] = await Promise.all([
    Profile.findOne({ user: membership.user?._id }).select('fullName mobile dob photoUrl').lean(),
    FamilyMember.find({ membership: membership._id }).sort({ createdAt: 1 }).lean(),
    Payment.find({ membership: membership._id })
      .select('amount baseAmount gstRate gstEnabled gstLabel gstAmount totalAmount method status reference note createdAt confirmedBy plan planModel')
      .sort({ createdAt: -1 }).populate('plan', 'name title').lean(),
    membership.nominee
      ? FamilyMember.findOne({ _id: membership.nominee, membership: membership._id, status: 'active' })
        .select('name fullName relation relationship type').lean()
      : null,
    getSettings(),
  ]);
  const now = new Date();
  const pointsBalance = Number.isSafeInteger(membership.pointsBalance) ? membership.pointsBalance : 0;
  const canRenew = ['active', 'expired'].includes(membership.status)
    && (pointsBalance === 0 || !membership.pointsExpireAt || membership.pointsExpireAt <= now);
  const [plans, recentRedemptions, ledger] = await Promise.all([
    canRenew ? MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1 }).lean() : [],
    Redemption.find({ membership: membership._id }).sort({ createdAt: -1 }).limit(20).lean(),
    PointLedger.find({ membership: membership._id }).sort({ createdAt: -1 }).limit(20).lean(),
  ]);
  const safeDocs = (membership.verificationDocs || []).map((doc) => ({
    id: doc.id,
    originalName: doc.originalName,
    mimeType: doc.mimeType,
    uploadedAt: doc.uploadedAt,
  }));
  return {
    membership: {
      ...membership,
      memberCode: getMembershipMemberCode(membership),
      formattedMemberCode: getMembershipMemberCode(membership)
        ? formatMemberCode(getMembershipMemberCode(membership))
        : '',
      verificationDocs: safeDocs,
      pointsBalance,
    },
    profile,
    family: groupFamily(family),
    payments,
    nominee: nominee ? {
      id: String(nominee._id),
      name: nominee.name || nominee.fullName,
      relation: nominee.relation || nominee.relationship,
      type: nominee.type,
    } : null,
    companyDetails: membership.companyDetails,
    canRenew,
    renewalPlans: plans.map((plan) => ({
      id: String(plan._id),
      name: plan.name,
      price: plan.price,
      renewalPoints: plan.renewalPoints,
    })),
    gstSettings: {
      enabled: settings.gstEnabled,
      rate: settings.gstRate,
      label: settings.gstLabel,
    },
    discountPercent: membership.status === 'active' ? settings.discountPercent : 0,
    redemptions: recentRedemptions,
    ledger,
  };
}

export async function getMembershipQueue(query = {}) {
  const { page, limit, skip } = pagination(query);
  const membershipFilter = { status: { $in: ['pending_verification', 'pending_payment'] } };
  const [memberships, membershipCount, familyRequests] = await Promise.all([
    Membership.find(membershipFilter)
      .sort({ updatedAt: 1 })
      .skip(skip)
      .limit(limit)
      .populate('user', 'firstName email')
      .populate('plan', 'name price')
      .lean(),
    Membership.countDocuments(membershipFilter),
    FamilyMember.find({ pendingAction: { $in: ['add', 'update', 'remove', 'nominee'] } })
      .sort({ updatedAt: 1 })
      .limit(limit)
      .populate({ path: 'membership', select: 'memberCode memberNumber user', populate: { path: 'user', select: 'firstName' } })
      .lean(),
  ]);
  const payments = await Payment.find({ status: 'pending', membership: { $in: memberships.map((m) => m._id) } })
    .select('_id membership method totalAmount amount reference createdAt')
    .sort({ createdAt: 1 })
    .lean();
  return {
    memberships,
    membershipPagination: { page, limit, total: membershipCount, pages: Math.ceil(membershipCount / limit) },
    payments,
    familyRequests,
  };
}

export async function getMembershipReports() {
  const now = new Date();
  const [issued, redeemed, expiring30, expiring90, paymentMethods, refunds, settings, earlyBirdUsed] = await Promise.all([
    PointLedger.aggregate([
      { $match: { type: { $in: ['credit_joining', 'credit_renewal', 'refund', 'admin_adjust'] }, direction: '+' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    PointLedger.aggregate([
      { $match: { type: 'debit_redeem', direction: '-' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]),
    listMembershipsWithPointsExpiring(30),
    listMembershipsWithPointsExpiring(90),
    Payment.aggregate([
      { $match: { status: { $in: ['confirmed', 'paid'] } } },
      { $group: { _id: '$method', totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Redemption.aggregate([
      { $match: { status: 'cancelled' } },
      { $group: { _id: null, refundedPoints: { $sum: '$refundedPoints' }, count: { $sum: 1 } } },
    ]),
    getSettings(),
    Membership.countDocuments({ earlyBirdApplied: true }),
  ]);
  return {
    points: { issued: issued[0]?.total || 0, redeemed: redeemed[0]?.total || 0 },
    expiring30: { count: expiring30.length, totalPoints: expiring30.reduce((sum, item) => sum + item.pointsBalance, 0), items: expiring30 },
    expiring90: { count: expiring90.length, totalPoints: expiring90.reduce((sum, item) => sum + item.pointsBalance, 0), items: expiring90 },
    paymentsByMethod: paymentMethods,
    refunds: refunds[0] || { refundedPoints: 0, count: 0 },
    earlyBird: {
      used: earlyBirdUsed,
      limit: settings.earlyBirdLimit,
      remaining: Math.max(0, settings.earlyBirdLimit - earlyBirdUsed),
    },
    generatedAt: now,
  };
}

function reportDateFilter(from, to, field = 'createdAt') {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999Z`);
  return { [field]: range };
}

async function addMemberNames(memberships) {
  const userIds = [...new Set(
    memberships.filter((membership) => membership.user).map((membership) => String(membership.user)),
  )];
  if (!userIds.length) return memberships.map((membership) => ({ ...membership, memberName: '—' }));
  const [profiles, users] = await Promise.all([
    Profile.find({ user: { $in: userIds } }).select('user fullName').lean(),
    User.find({ _id: { $in: userIds } }).select('firstName email').lean(),
  ]);
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const userById = new Map(users.map((user) => [String(user._id), user]));
  return memberships.map((membership) => {
    const id = String(membership.user);
    const profile = profileByUser.get(id);
    const user = userById.get(id);
    return {
      ...membership,
      memberName: profile?.fullName || user?.firstName || user?.email || '—',
    };
  });
}

export async function getMembershipOperationsReport(query = {}) {
  const [
    pointTotals,
    pointsRedeemedByChannel,
    expiring30,
    expiring90,
    paymentsByMethod,
    cancellations,
    settings,
    earlyBirdUsed,
  ] = await Promise.all([
    PointLedger.aggregate([
      { $match: {
        ...reportDateFilter(query.from, query.to),
        type: { $in: ['credit_joining', 'credit_renewal', 'debit_redeem', 'expire', 'admin_adjust'] },
      } },
      { $group: { _id: { type: '$type', direction: '$direction' }, total: { $sum: '$amount' } } },
    ]),
    Redemption.aggregate([
      { $match: reportDateFilter(query.from, query.to) },
      {
        $group: {
          _id: { $ifNull: ['$channel', 'billing_counter'] },
          count: { $sum: 1 },
          totalPoints: { $sum: '$pointsUsed' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    listMembershipsWithPointsExpiring(30),
    listMembershipsWithPointsExpiring(90),
    Payment.aggregate([
      { $match: {
        ...reportDateFilter(query.from, query.to),
        status: { $in: ['confirmed', 'paid'] },
      } },
      { $group: { _id: '$method', totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Redemption.aggregate([
      { $match: {
        status: 'cancelled',
        ...reportDateFilter(query.from, query.to, 'cancelledAt'),
      } },
      { $group: { _id: null, refundedPoints: { $sum: '$refundedPoints' }, count: { $sum: 1 } } },
    ]),
    getSettings(),
    Membership.countDocuments({ earlyBirdApplied: true }),
  ]);

  const totalFor = (type, direction) => pointTotals
    .find((item) => item._id.type === type && item._id.direction === direction)?.total || 0;
  const expiringMembers = await addMemberNames([...expiring30, ...expiring90]);
  const byId = new Map(expiringMembers.map((membership) => [String(membership._id), membership]));

  return {
    points: {
      issued: ['credit_joining', 'credit_renewal', 'admin_adjust']
        .reduce((sum, type) => sum + totalFor(type, '+'), 0),
      redeemed: totalFor('debit_redeem', '-'),
      expired: totalFor('expire', '-'),
    },
    pointsRedeemedByChannel,
    expiring30: {
      count: expiring30.length,
      totalPoints: expiring30.reduce((sum, item) => sum + item.pointsBalance, 0),
      items: expiring30.map((item) => byId.get(String(item._id))),
    },
    expiring90: {
      count: expiring90.length,
      totalPoints: expiring90.reduce((sum, item) => sum + item.pointsBalance, 0),
      items: expiring90.map((item) => byId.get(String(item._id))),
    },
    earlyBird: {
      used: earlyBirdUsed,
      limit: settings.earlyBirdLimit,
      remaining: Math.max(0, settings.earlyBirdLimit - earlyBirdUsed),
    },
    paymentsByMethod,
    cancellations: cancellations[0] || { count: 0, refundedPoints: 0 },
    generatedAt: new Date(),
    range: { from: query.from || null, to: query.to || null },
  };
}

export async function createRenewal(adminId, membershipId, { planId, paymentMethod, companyDetails }) {
  const membership = await Membership.findById(membershipId).select('user status');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  return (await import('./payment.service.js')).renewMembership(
    membership.user,
    { planId, paymentMethod, companyDetails },
  );
}

export { formatMemberCode };
