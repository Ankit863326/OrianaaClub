import mongoose from 'mongoose';
import Membership from '../models/Membership.js';
import MembershipPlan from '../models/MembershipPlan.js';
import Plan from '../models/Plan.js';
import Payment from '../models/Payment.js';
import PointsLedger from '../models/PointsLedger.js';
import PointLedger from '../models/PointLedger.js';
import AuditLog from '../models/AuditLog.js';
import { getSettings } from '../models/Setting.js';
import { calculatePoints, creditPoints } from './points-ledger.service.js';
import ApiError from '../utils/ApiError.js';
import { getPayableAmount, paiseToRupees } from '../utils/money.js';

export const UPGRADE_EXCLUDED_TIERS = Object.freeze([]);
const UPGRADE_MINIMUM_MONTHS = 3;

function addUtcMonths(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

function normalizedTier(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function membershipIsEligible(membership, now) {
  const activatedAt = membership.activatedAt || membership.startDate || membership.approvedAt;
  const endDate = membership.endDate || membership.membershipExpireAt;
  const eligibleFrom = activatedAt ? addUtcMonths(new Date(activatedAt), UPGRADE_MINIMUM_MONTHS) : null;
  const excluded = UPGRADE_EXCLUDED_TIERS.includes(normalizedTier(membership.tier));
  return {
    eligible: membership.status === 'active'
      && membership.memberType === 'primary'
      && endDate
      && new Date(endDate) > now
      && eligibleFrom
      && eligibleFrom <= now
      && !excluded,
    eligibleFrom,
    excluded,
  };
}

function pointsFor(baseDifference, multiplier) {
  if (!Number.isSafeInteger(baseDifference) || baseDifference < 0) {
    throw new ApiError(409, 'The selected plan price is invalid.');
  }
  try {
    return calculatePoints(baseDifference, multiplier);
  } catch {
    throw new ApiError(409, 'The upgrade points exceed the supported range.');
  }
}

async function loadPlan(modelName, planId, session) {
  const Model = modelName === 'MembershipPlan' ? MembershipPlan : Plan;
  const query = Model.findById(planId);
  if (session) query.session(session);
  const plan = await query.lean();
  if (!plan) throw new ApiError(409, 'A membership plan could not be found.');
  return plan;
}

export async function quoteMembershipUpgrade(userId, now = new Date()) {
  const membership = await Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
  }).sort({ createdAt: -1 }).lean();
  if (!membership) throw new ApiError(404, 'Membership was not found.');

  const [currentPlan, plans, settings, pendingPayment] = await Promise.all([
    loadPlan(membership.planModel, membership.plan),
    MembershipPlan.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean(),
    getSettings(),
    Payment.findOne({
      membership: membership._id,
      purpose: 'upgrade',
      status: 'pending',
    }).populate('plan', 'name').lean(),
  ]);
  const eligibility = membershipIsEligible(membership, now);
  const earlyBird = membership.earlyBird === true || membership.earlyBirdApplied === true;
  const multiplier = earlyBird
    ? settings.familyMembership.multipliers.earlyBird
    : settings.familyMembership.multipliers.default;
  const pointsBalance = Number.isSafeInteger(membership.pointsBalance) ? membership.pointsBalance : 0;
  const currentName = currentPlan.title || currentPlan.name || membership.tier || 'Current plan';
  const planRows = plans.map((plan) => {
    const isCurrent = membership.planModel === 'MembershipPlan'
      ? String(plan._id) === String(membership.plan)
      : normalizedTier(plan.name) === normalizedTier(currentName) && plan.price === currentPlan.price;
    const baseDifference = plan.price - currentPlan.price;
    const isUpgradeAllowed = !isCurrent
      && baseDifference > 0
      && eligibility.eligible;
    const breakdown = baseDifference > 0
      ? getPayableAmount({ price: baseDifference }, {
        enabled: settings.gstEnabled,
        rate: settings.gstRate,
        label: settings.gstLabel,
      })
      : {
        baseAmount: 0,
        gstRate: settings.gstRate,
        gstEnabled: settings.gstEnabled,
        gstLabel: settings.gstLabel,
        gstAmount: 0,
        totalAmount: 0,
        currency: 'INR',
      };
    const upgradePoints = baseDifference > 0 ? pointsFor(baseDifference, multiplier) : 0;
    const displayPoints = [
      { points: plan.earlyBirdPoints, label: `First ${settings.earlyBirdLimit} members` },
      { points: plan.defaultPoints, label: 'Standard joining points' },
      { points: plan.renewalPoints, label: 'Renewal points' },
    ];
    return {
      _id: String(plan._id),
      id: String(plan._id),
      planModel: 'MembershipPlan',
      name: plan.name,
      title: plan.name,
      subtitle: `${settings.membershipValidityYears} year membership`,
      price: plan.price,
      sortOrder: plan.sortOrder,
      isCurrent,
      isUpgradeAllowed,
      baseDifference,
      gstAmount: paiseToRupees(breakdown.gstAmount),
      gstRate: breakdown.gstRate,
      totalPayable: paiseToRupees(breakdown.totalAmount),
      upgradePoints,
      newBalance: pointsBalance + upgradePoints,
      earlyBirdPoints: plan.earlyBirdPoints,
      defaultPoints: plan.defaultPoints,
      renewalPoints: plan.renewalPoints,
      points: displayPoints,
      benefitsTitle: plan.name,
      benefits: displayPoints,
      termYears: settings.membershipValidityYears,
      isFeatured: false,
    };
  });

  if (!planRows.some((plan) => plan.isCurrent)) {
    planRows.push({
      _id: String(currentPlan._id),
      id: String(currentPlan._id),
      planModel: membership.planModel || 'Plan',
      name: currentName,
      title: currentName,
      subtitle: `${settings.membershipValidityYears} year membership`,
      price: currentPlan.price,
      sortOrder: Number(currentPlan.sortOrder || currentPlan.displayOrder || 0),
      isCurrent: true,
      isUpgradeAllowed: false,
      baseDifference: 0,
      gstAmount: 0,
      gstRate: settings.gstRate,
      totalPayable: 0,
      upgradePoints: 0,
      newBalance: pointsBalance,
      earlyBirdPoints: currentPlan.earlyBirdPoints || 0,
      defaultPoints: currentPlan.defaultPoints || 0,
      renewalPoints: currentPlan.renewalPoints || 0,
      points: (currentPlan.pointsTiers || currentPlan.benefits || []).map((row) => ({
        points: row.points ?? row.amount ?? 0,
        label: row.label || '',
      })),
      benefits: (currentPlan.pointsTiers || currentPlan.benefits || []).map((row) => ({
        points: row.points ?? row.amount ?? 0,
        label: row.label || '',
      })),
      isFeatured: Boolean(currentPlan.isFeatured),
    });
    planRows.sort((first, second) => first.sortOrder - second.sortOrder);
  }

  return {
    membershipId: String(membership._id),
    eligibility: eligibility.eligible,
    eligibleFrom: eligibility.eligibleFrom,
    excludedTier: eligibility.excluded,
    currentPlan: {
      id: String(membership.plan),
      planModel: membership.planModel,
      name: currentName,
      price: currentPlan.price,
      tier: membership.tier,
    },
    earlyBird,
    multiplier,
    pointsBalance,
    gst: { enabled: settings.gstEnabled, rate: settings.gstRate, label: settings.gstLabel },
    plans: planRows,
    pendingUpgrade: pendingPayment ? {
      paymentId: String(pendingPayment._id),
      status: pendingPayment.status,
      planName: pendingPayment.plan?.name || 'Selected plan',
      targetPlanId: String(pendingPayment.targetPlan || pendingPayment.plan),
      baseDifference: paiseToRupees(pendingPayment.baseDifference ?? pendingPayment.baseAmount),
      gstAmount: paiseToRupees(pendingPayment.gstAmount),
      gstRate: pendingPayment.gstRate,
      totalPayable: paiseToRupees(pendingPayment.totalAmount),
      upgradePoints: pendingPayment.upgradePoints,
    } : null,
  };
}

export async function createMembershipUpgrade(userId, targetPlanId) {
  const now = new Date();
  const membership = await Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
  }).sort({ createdAt: -1 });
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const eligibility = membershipIsEligible(membership, now);
  if (!eligibility.eligible) {
    throw new ApiError(409, eligibility.eligibleFrom
      ? `Your membership is not eligible to upgrade until ${eligibility.eligibleFrom.toISOString().slice(0, 10)}.`
      : 'Your membership is not eligible to upgrade.');
  }
  if (UPGRADE_EXCLUDED_TIERS.includes(normalizedTier(membership.tier))) {
    throw new ApiError(409, 'Your membership tier is not eligible for upgrades.');
  }
  if (await Payment.exists({ membership: membership._id, purpose: 'upgrade', status: 'pending' })) {
    throw new ApiError(409, 'An upgrade payment is already pending for this membership.');
  }
  if (!mongoose.isValidObjectId(targetPlanId)) throw new ApiError(400, 'The selected plan is invalid.');

  const [currentPlan, targetPlan, settings] = await Promise.all([
    loadPlan(membership.planModel, membership.plan),
    MembershipPlan.findOne({ _id: targetPlanId, isActive: true }).lean(),
    getSettings(),
  ]);
  if (!targetPlan) throw new ApiError(404, 'The selected membership plan was not found.');
  const baseDifference = targetPlan.price - currentPlan.price;
  if (baseDifference <= 0) throw new ApiError(400, 'Only a higher-priced plan can be selected for an upgrade.');
  const paymentBreakdown = getPayableAmount({ price: baseDifference }, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  const earlyBirdApplied = membership.earlyBird === true || membership.earlyBirdApplied === true;
  const multiplier = earlyBirdApplied
    ? settings.familyMembership.multipliers.earlyBird
    : settings.familyMembership.multipliers.default;
  const upgradePoints = pointsFor(baseDifference, multiplier);

  try {
    const [payment] = await Payment.create([{
      user: userId,
      membership: membership._id,
      plan: targetPlan._id,
      planModel: 'MembershipPlan',
      targetPlan: targetPlan._id,
      targetPlanModel: 'MembershipPlan',
      oldPlan: membership.plan,
      oldPlanModel: membership.planModel,
      purpose: 'upgrade',
      amount: baseDifference,
      method: 'bank_transfer',
      status: 'pending',
      baseDifference: paymentBreakdown.baseAmount,
      upgradePoints,
      earlyBirdApplied,
      ...paymentBreakdown,
    }]);
    return {
      paymentId: String(payment._id),
      status: payment.status,
      planName: targetPlan.name,
      baseDifference,
      gstAmount: paiseToRupees(payment.gstAmount),
      totalPayable: paiseToRupees(payment.totalAmount),
      upgradePoints,
      paymentMethod: payment.method,
    };
  } catch (error) {
    if (error.code === 11000) {
      throw new ApiError(409, 'An upgrade payment is already pending for this membership.');
    }
    throw error;
  }
}

export async function applyMembershipUpgrade(session, payment, membership, adminId, now = new Date()) {
  if (!session?.inTransaction()) throw new TypeError('Membership upgrades must be confirmed inside a transaction.');
  if (payment.purpose !== 'upgrade') return null;
  const eligibility = membershipIsEligible(membership, now);
  if (!eligibility.eligible) throw new ApiError(409, 'This membership is no longer eligible for an upgrade.');
  if (await PointsLedger.exists({ payment: payment._id }).session(session)) {
    throw new ApiError(409, 'This upgrade has already credited points.');
  }

  const [oldPlan, targetPlan, settings] = await Promise.all([
    loadPlan(payment.oldPlanModel || membership.planModel, payment.oldPlan || membership.plan, session),
    loadPlan(payment.targetPlanModel || payment.planModel, payment.targetPlan || payment.plan, session),
    getSettings({ forceRefresh: true }),
  ]);
  const baseDifference = targetPlan.price - oldPlan.price;
  if (baseDifference <= 0) throw new ApiError(409, 'The target plan is no longer a higher-priced plan.');
  const breakdown = getPayableAmount({ price: baseDifference }, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  const earlyBirdApplied = membership.earlyBird === true || membership.earlyBirdApplied === true;
  const multiplier = earlyBirdApplied
    ? settings.familyMembership.multipliers.earlyBird
    : settings.familyMembership.multipliers.default;
  const upgradePoints = pointsFor(baseDifference, multiplier);
  if (
    payment.baseDifference !== breakdown.baseAmount
    || payment.baseAmount !== breakdown.baseAmount
    || payment.gstAmount !== breakdown.gstAmount
    || payment.totalAmount !== breakdown.totalAmount
    || payment.upgradePoints !== upgradePoints
    || payment.earlyBirdApplied !== earlyBirdApplied
  ) {
    throw new ApiError(409, 'The upgrade payment no longer matches the current plan and GST settings.');
  }
  const currentPrice = oldPlan.price;
  const nextPlanModel = payment.targetPlanModel || payment.planModel;
  const ledgerMembership = {
    ...membership.toObject(),
    baseAmount: (membership.baseAmount || 0) + baseDifference,
    totalPaid: (membership.totalPaid || 0) + paiseToRupees(breakdown.totalAmount),
  };
  const ledgerEntry = await creditPoints(session, ledgerMembership, membership.approvalSeq || 1, {
    pointsBasis: baseDifference,
    multiplier,
    phase: earlyBirdApplied ? 'early_bird' : 'default',
    source: 'upgrade',
    paymentId: payment._id,
  });
  const updatedMembership = await Membership.updateOne({
    _id: membership._id,
    status: 'active',
    plan: membership.plan,
    planModel: membership.planModel,
  }, {
    $set: {
      plan: payment.targetPlan || payment.plan,
      planModel: nextPlanModel,
      tier: targetPlan.name || targetPlan.title,
      baseAmount: (membership.baseAmount || 0) + baseDifference,
      gstAmount: (membership.gstAmount || 0) + paiseToRupees(breakdown.gstAmount),
      totalPaid: (membership.totalPaid || 0) + paiseToRupees(breakdown.totalAmount),
      pointsBalance: (membership.pointsBalance || 0) + upgradePoints,
      pointsGranted: (membership.pointsGranted || 0) + upgradePoints,
      pointsExpireAt: new Date(Math.max(
        membership.pointsExpireAt ? new Date(membership.pointsExpireAt).getTime() : 0,
        new Date(ledgerEntry.expiresAt).getTime(),
      )),
    },
  }, { session, runValidators: true });
  if (updatedMembership.modifiedCount !== 1) {
    throw new ApiError(409, 'The membership changed before the upgrade could be applied.');
  }
  if (ledgerEntry.points > 0) {
    await PointLedger.create([{
      membership: membership._id,
      type: 'upgrade',
      amount: ledgerEntry.points,
      direction: '+',
      channel: 'app',
      balanceAfter: (membership.pointsBalance || 0) + ledgerEntry.points,
      idempotencyKey: `membership-upgrade:${payment._id}`,
      note: `Membership plan upgrade points · ${oldPlan.title || oldPlan.name} to ${targetPlan.title || targetPlan.name}`,
      createdBy: 'admin',
    }], { session, ordered: true });
  }
  await AuditLog.create([{
    actorType: 'admin',
    actorId: adminId,
    admin: adminId,
    action: 'membership.plan.upgrade',
    entityType: 'membership',
    entityId: String(membership._id),
    summary: `Upgraded membership from ${oldPlan.title || oldPlan.name} to ${targetPlan.title || targetPlan.name}.`,
    before: {
      plan: String(membership.plan),
      planModel: membership.planModel,
      tier: membership.tier,
      pointsBalance: membership.pointsBalance,
      price: currentPrice,
    },
    after: {
      plan: String(payment.targetPlan || payment.plan),
      planModel: nextPlanModel,
      tier: targetPlan.name || targetPlan.title,
      pointsBalance: (membership.pointsBalance || 0) + upgradePoints,
      baseDifference,
      gstAmount: paiseToRupees(breakdown.gstAmount),
      upgradePoints: ledgerEntry.points,
    },
  }, {
    actorType: 'admin',
    actorId: adminId,
    admin: adminId,
    action: 'payment.upgrade.confirm',
    entityType: 'payment',
    entityId: String(payment._id),
    summary: 'Confirmed an offline membership plan upgrade payment.',
    before: { status: payment.status },
    after: { status: 'confirmed', totalAmount: payment.totalAmount },
  }], { session, ordered: true });
  return { targetPlan, upgradePoints, newBalance: (membership.pointsBalance || 0) + upgradePoints };
}

export function getUpgradeEligibility(membership, now = new Date()) {
  return membershipIsEligible(membership, now);
}
