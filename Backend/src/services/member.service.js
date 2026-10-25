// Phase 2: Apply ownership-scoped profile, draft plan, and family rules.
import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import Plan from '../models/Plan.js';
import MembershipPlan from '../models/MembershipPlan.js';
import { getSettings } from '../models/Setting.js';
import Payment from '../models/Payment.js';
import Profile from '../models/Profile.js';
import ApiError from '../utils/ApiError.js';
import { invalidateVerificationAfterProfileChange } from './family-verification.service.js';
import { getPayableAmount } from '../utils/money.js';
import { publicMediaDirectory } from '../utils/uploadDirectories.js';
import { calculateFamilyPriceQuotes } from './pricing.service.js';
import {
  normalizeFamilyProfile,
  validateFamilyProfileSet,
} from './family-profile-rules.service.js';

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

async function savePhoto(file) {
  if (!file) return '';
  const extension = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[file.mimetype];
  if (!extension) throw new ApiError(400, 'Only JPG, PNG, and WebP photos are allowed.');

  await mkdir(publicMediaDirectory, { recursive: true, mode: 0o750 });
  const filename = `${randomBytes(16).toString('hex')}${extension}`;
  await writeFile(path.join(publicMediaDirectory, filename), file.buffer, { flag: 'wx', mode: 0o640 });
  return `/media/${filename}`;
}

async function removeUploadedPhoto(photoUrl) {
  if (!photoUrl?.startsWith('/media/')) return;
  const filename = path.basename(photoUrl);
  try {
    await unlink(path.join(publicMediaDirectory, filename));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

async function discardNewPhoto(photoUrl, originalError) {
  try {
    await removeUploadedPhoto(photoUrl);
  } catch (cleanupError) {
    console.error(`[member] Could not clean up a failed photo upload: ${cleanupError.message}`);
  }
  throw originalError;
}

async function currentMembership(userId) {
  return Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
    status: { $in: visibleMembershipStatuses },
  })
    .populate('plan');
}

function memberSafeObject(value) {
  if (Array.isArray(value)) return value.map(memberSafeObject);
  if (!value || typeof value !== 'object' || value instanceof Date) return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/expire|expiry|earlybird|approvalseq|multiplier/i.test(key))
    .map(([key, nested]) => [key, memberSafeObject(nested)]));
}

export async function getMemberOverview(user) {
  const [profile, membership] = await Promise.all([
    Profile.findOne({ user: user._id }).lean(),
    currentMembership(user._id),
  ]);
  const family = membership
    ? await FamilyMember.find({ membership: membership._id }).sort({ createdAt: 1 }).lean()
    : [];

  return {
    profile,
    membership: membership ? memberSafeObject(membership.toObject()) : null,
    family: memberSafeObject(family),
  };
}

export async function saveProfile(userId, values, photo) {
  const previous = await Profile.findOne({ user: userId });
  const photoUrl = photo ? await savePhoto(photo) : previous?.photoUrl || '';
  let profile;
  try {
    profile = await Profile.findOneAndUpdate(
      { user: userId },
      { $set: { ...values, photoUrl } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (photo) await discardNewPhoto(photoUrl, error);
    throw error;
  }

  if (photo && previous?.photoUrl) await removeUploadedPhoto(previous.photoUrl);
  return profile;
}

export async function saveDraftPlan(userId, planId) {
  let plan = await Plan.findOne({ _id: planId, isActive: true });
  let planModel = 'Plan';
  if (!plan) {
    plan = await MembershipPlan.findOne({ _id: planId, isActive: true });
    planModel = 'MembershipPlan';
  }
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');

  const existing = await Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
    status: { $in: visibleMembershipStatuses },
  });
  if (existing?.status === 'active') {
    throw new ApiError(409, 'Your active membership plan cannot be changed.');
  }
  if (existing?.status === 'pending_verification') {
    throw new ApiError(409, 'Your membership is pending document verification.');
  }

  if (existing) {
    existing.plan = plan._id;
    existing.planModel = planModel;
    existing.status = 'draft';
    await existing.save();
    return existing.populate('plan');
  }

  const membership = await Membership.create({
    user: userId,
    customer: userId,
    plan: plan._id,
    planModel,
    status: 'draft',
  });
  return membership.populate('plan');
}

export async function startMembershipPayment(userId, planId) {
  const plan = await Plan.findOne({ _id: planId, isActive: true });
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');

  const activeMembership = await Membership.findOne({ user: userId, status: 'active' }).select('_id');
  if (activeMembership) {
    throw new ApiError(409, 'You already have an active membership.');
  }

  let membership = await Membership.findOne({
    user: userId,
    status: { $in: ['draft', 'pending_payment'] },
  });
  if (!membership) {
    membership = await Membership.create({
      user: userId,
      plan: plan._id,
      status: 'pending_payment',
    });
  } else {
    membership.plan = plan._id;
    membership.status = 'pending_payment';
    await membership.save();
  }

  return membership.populate('plan');
}

export async function getMembershipCheckoutQuote(planId) {
  let plan = await Plan.findOne({ _id: planId, isActive: true });
  let planModel = 'Plan';
  if (!plan) {
    plan = await MembershipPlan.findOne({ _id: planId, isActive: true });
    planModel = 'MembershipPlan';
  }
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');

  const settings = await getSettings();
  const amount = getPayableAmount(plan, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  return {
    planId: String(plan._id),
    planFee: amount.baseAmount,
    gstEnabled: amount.gstEnabled,
    gstPercent: amount.gstRate,
    gstLabel: amount.gstLabel,
    gst: amount.gstAmount,
    total: amount.totalAmount,
    currency: amount.currency,
  };
}

export async function getFamilyPriceBreakdown(planId) {
  let plan = await Plan.findOne({ _id: planId, isActive: true }).lean();
  if (!plan) plan = await MembershipPlan.findOne({ _id: planId, isActive: true }).lean();
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  return calculateFamilyPriceQuotes(plan);
}

export async function getPaymentMembership(userId, membershipId) {
  const membership = await Membership.findOne({ _id: membershipId, user: userId }).populate('plan');
  if (!membership) throw new ApiError(404, 'Membership was not found.');

  const [payment, settings] = await Promise.all([
    Payment.findOne({ membership: membership._id }).sort({ createdAt: -1 }).lean(),
    getSettings(),
  ]);
  const currentAmount = getPayableAmount(membership.plan, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  const amount = payment ? {
    baseAmount: payment.baseAmount,
    gstAmount: payment.gstAmount,
    totalAmount: payment.totalAmount,
    gstRate: payment.gstRate ?? (payment.baseAmount
      ? Math.round((payment.gstAmount / payment.baseAmount) * 10000) / 100
      : 0),
    gstEnabled: payment.gstEnabled ?? payment.gstAmount > 0,
    gstLabel: payment.gstLabel || settings.gstLabel || 'GST',
    currency: payment.currency || 'INR',
  } : {
    ...currentAmount,
    gstRate: currentAmount.gstRate,
  };
  return {
    id: String(membership._id),
    status: membership.status,
    plan: {
      id: String(membership.plan._id),
      name: membership.plan.name || membership.plan.title,
    },
    amount: amount.totalAmount,
    planFee: amount.baseAmount,
    gst: amount.gstAmount,
    gstRate: amount.gstRate,
    gstEnabled: amount.gstEnabled,
    gstLabel: amount.gstLabel,
    currency: amount.currency,
    verificationDocumentUploaded: membership.verificationDocs.length > 0,
    payment: payment ? {
      id: String(payment._id),
      status: payment.status,
      method: payment.method,
      orderId: payment.razorpayOrderId,
      amount: payment.totalAmount,
      planFee: payment.baseAmount,
      gst: payment.gstAmount,
      gstRate: amount.gstRate,
      gstEnabled: amount.gstEnabled,
      gstLabel: amount.gstLabel,
    } : null,
  };
}

async function requireEditableMembership(userId) {
  const membership = await currentMembership(userId);
  if (!membership) throw new ApiError(409, 'Select a membership plan before adding family members.');
  return membership;
}

async function requireDraftMembership(userId) {
  const membership = await requireEditableMembership(userId);
  if (['active', 'pending_verification'].includes(membership.status)) {
    throw new ApiError(409, 'Family members cannot be changed after payment submission.');
  }
  return membership;
}

export async function listFamilyMembers(userId) {
  const membership = await requireEditableMembership(userId);
  return FamilyMember.find({ membership: membership._id }).sort({ createdAt: 1 }).lean();
}

export async function addFamilyMember(userId, values, photo) {
  const membership = await requireDraftMembership(userId);
  const currentMembers = await FamilyMember.find({ membership: membership._id }).lean();
  const profileValues = normalizeFamilyProfile(values);
  await validateFamilyProfileSet({
    plan: membership.plan,
    members: [...currentMembers, profileValues],
  });
  const photoUrl = await savePhoto(photo);
  try {
    return await FamilyMember.create({ ...profileValues, photoUrl, membership: membership._id });
  } catch (error) {
    if (photo) await discardNewPhoto(photoUrl, error);
    throw error;
  }
}

export async function updateFamilyMember(userId, memberId, values, photo) {
  const membership = await requireDraftMembership(userId);
  const member = await FamilyMember.findOne({ _id: memberId, membership: membership._id });
  if (!member) throw new ApiError(404, 'Family member was not found.');

  const previousPhotoUrl = member.photoUrl;
  const before = member.toObject();
  const profileValues = normalizeFamilyProfile(values);
  const currentMembers = await FamilyMember.find({
    membership: membership._id,
    _id: { $ne: member._id },
  }).lean();
  await validateFamilyProfileSet({
    plan: membership.plan,
    members: [...currentMembers, profileValues],
  });
  const photoUrl = photo ? await savePhoto(photo) : previousPhotoUrl;
  Object.assign(member, profileValues, { photoUrl });
  try {
    await member.save();
  } catch (error) {
    if (photo) await discardNewPhoto(photoUrl, error);
    throw error;
  }
  await invalidateVerificationAfterProfileChange(member, before, userId, 'member');
  if (photo && previousPhotoUrl) await removeUploadedPhoto(previousPhotoUrl);
  return member;
}

export async function deleteFamilyMember(userId, memberId) {
  const membership = await requireDraftMembership(userId);
  const member = await FamilyMember.findOneAndDelete({ _id: memberId, membership: membership._id });
  if (!member) throw new ApiError(404, 'Family member was not found.');
  await removeUploadedPhoto(member.photoUrl);
}
