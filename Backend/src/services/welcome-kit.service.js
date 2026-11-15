import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import Membership from '../models/Membership.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import WelcomeKit from '../models/WelcomeKit.js';
import ApiError from '../utils/ApiError.js';
import { sendMail } from './mail.service.js';

const maxCodeAttempts = 5;

function hashCode(kitId, code) {
  return createHash('sha256').update(`${kitId}:${code}`).digest();
}

export function addWorkingDays(date, days) {
  const result = new Date(date);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    if (result.getDay() !== 0 && result.getDay() !== 6) remaining -= 1;
  }
  return result;
}

function safeKit(kit, member = {}, now = new Date()) {
  return {
    _id: String(kit._id),
    membership: String(kit.membership),
    status: kit.status,
    codeAttempts: kit.codeAttempts,
    locked: kit.status === 'dispatched' && kit.codeAttempts >= maxCodeAttempts,
    assignedStaff: kit.assignedStaff,
    dueAt: kit.dueAt,
    dispatchedAt: kit.dispatchedAt,
    deliveredAt: kit.deliveredAt,
    deliveredBy: kit.deliveredBy ? String(kit.deliveredBy) : null,
    notHomeNote: kit.notHomeNote,
    overdue: kit.status !== 'delivered' && kit.dueAt <= now,
    member,
  };
}

export async function createWelcomeKit(membership, approvedAt = new Date()) {
  if (!membership || membership.memberType !== 'primary' || membership.previousMembership
    || Number(membership.termNumber || 1) !== 1) return null;

  const kitId = new mongoose.Types.ObjectId();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const kit = await WelcomeKit.create({
    _id: kitId,
    membership: membership._id,
    user: membership.user || membership.customer,
    codeHash: hashCode(kitId, code).toString('hex'),
    dueAt: addWorkingDays(approvedAt, 5),
  });
  return { kit, code };
}

export async function listWelcomeKits({ status, search = '', page = 1, limit = 100 } = {}, now = new Date()) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 100));
  const filter = {};
  if (status) filter.status = status;

  const normalizedSearch = String(search).trim();
  if (normalizedSearch) {
    const escapedSearch = normalizedSearch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const memberships = await Membership.find({
      $or: ['memberId', 'memberCode', 'memberNo'].map((field) => ({
        [field]: { $regex: escapedSearch, $options: 'i' },
      })),
    }).select('_id').lean();
    filter.membership = { $in: memberships.map(({ _id }) => _id) };
  }

  const [kits, total, overdueCount] = await Promise.all([
    WelcomeKit.find(filter).select('-codeHash').sort({ dueAt: 1, _id: 1 })
      .skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    WelcomeKit.countDocuments(filter),
    filter.status === 'delivered'
      ? 0
      : WelcomeKit.countDocuments({
        ...filter,
        ...(filter.status ? {} : { status: { $ne: 'delivered' } }),
        dueAt: { $lte: now },
      }),
  ]);
  const memberships = kits.length
    ? await Membership.find({ _id: { $in: kits.map((kit) => kit.membership) } })
      .select('_id user customer memberId memberCode memberNo').lean()
    : [];
  const membershipById = new Map(memberships.map((membership) => [String(membership._id), membership]));
  const userIds = [...new Set(memberships.map((membership) => String(membership.user || membership.customer)).filter(Boolean))];
  const [profiles, users] = userIds.length
    ? await Promise.all([
      Profile.find({ user: { $in: userIds } }).select('user fullName mobile').lean(),
      User.find({ _id: { $in: userIds } }).select('firstName').lean(),
    ])
    : [[], []];
  const profilesByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  return {
    items: kits.map((kit) => {
      const membership = membershipById.get(String(kit.membership));
      const userId = String(membership?.user || membership?.customer || '');
      const profile = profilesByUser.get(userId);
      return safeKit(kit, {
        name: profile?.fullName || usersById.get(userId)?.firstName || 'Member',
        memberId: membership?.memberId || membership?.memberCode || membership?.memberNo || '',
        mobile: profile?.mobile || '',
      }, now);
    }),
    total,
    overdueCount,
    page: safePage,
    limit: safeLimit,
    pages: Math.ceil(total / safeLimit),
  };
}

export async function dispatchWelcomeKit(id, staff, now = new Date()) {
  const kit = await WelcomeKit.findOneAndUpdate(
    { _id: id, status: { $in: ['pending', 'not_home'] } },
    {
      $set: {
        status: 'dispatched',
        assignedStaff: staff.trim(),
        dispatchedAt: now,
        codeAttempts: 0,
        notHomeNote: '',
      },
    },
    { new: true, runValidators: true },
  ).select('-codeHash').lean();
  if (!kit) throw new ApiError(409, 'This welcome kit cannot be dispatched in its current state.');
  return safeKit(kit);
}

export async function markWelcomeKitNotHome(id, note = '') {
  const kit = await WelcomeKit.findOneAndUpdate(
    { _id: id, status: 'dispatched' },
    { $set: { status: 'not_home', notHomeNote: note.trim() } },
    { new: true, runValidators: true },
  ).select('-codeHash').lean();
  if (!kit) throw new ApiError(409, 'This welcome kit is not currently dispatched.');
  return safeKit(kit);
}

export async function verifyWelcomeKitDelivery(id, code, deliveredBy, now = new Date()) {
  const kit = await WelcomeKit.findById(id).select('+codeHash');
  if (!kit) throw new ApiError(404, 'Welcome kit was not found.');
  if (kit.status !== 'dispatched') throw new ApiError(409, 'This welcome kit is not currently dispatched.');
  if (kit.codeAttempts >= maxCodeAttempts) throw new ApiError(423, 'This welcome kit is locked. Dispatch it again to reset code attempts.');

  const providedHash = hashCode(kit._id, code);
  const storedHash = Buffer.from(kit.codeHash, 'hex');
  const matches = storedHash.length === providedHash.length && timingSafeEqual(storedHash, providedHash);
  if (!matches) {
    const updated = await WelcomeKit.findOneAndUpdate(
      { _id: id, status: 'dispatched', codeAttempts: { $lt: maxCodeAttempts } },
      { $inc: { codeAttempts: 1 } },
      { new: true },
    ).select('codeAttempts').lean();
    if (!updated) {
      const current = await WelcomeKit.findById(id).select('status codeAttempts').lean();
      if (current?.status === 'dispatched' && current.codeAttempts >= maxCodeAttempts) {
        throw new ApiError(423, 'This welcome kit is locked. Dispatch it again to reset code attempts.');
      }
      throw new ApiError(409, 'This welcome kit was already updated.');
    }
    if (updated.codeAttempts >= maxCodeAttempts) {
      throw new ApiError(423, 'This welcome kit is locked. Dispatch it again to reset code attempts.');
    }
    throw new ApiError(400, 'The delivery code is incorrect.');
  }

  const delivered = await WelcomeKit.findOneAndUpdate(
    { _id: id, status: 'dispatched', codeAttempts: { $lt: maxCodeAttempts }, codeHash: kit.codeHash },
    { $set: { status: 'delivered', deliveredAt: now, deliveredBy } },
    { new: true, runValidators: true },
  ).select('-codeHash').lean();
  if (!delivered) {
    const current = await WelcomeKit.findById(id).select('status codeAttempts').lean();
    if (current?.status === 'dispatched' && current.codeAttempts >= maxCodeAttempts) {
      throw new ApiError(423, 'This welcome kit is locked. Dispatch it again to reset code attempts.');
    }
    throw new ApiError(409, 'This welcome kit was already updated.');
  }

  try {
    const [membership, user] = await Promise.all([
      Membership.findById(delivered.membership).select('memberId memberCode memberNo').lean(),
      User.findById(delivered.user).select('firstName email').lean(),
    ]);
    if (!user?.email) throw new Error('No member email is available.');
    await sendMail({
      to: user.email,
      subject: 'Your OrianaaClub welcome kit has been delivered',
      template: 'welcome-kit-delivered',
      data: {
        firstName: user.firstName || 'Member',
        memberId: membership?.memberId || membership?.memberCode || membership?.memberNo || '',
        deliveredDate: now.toLocaleDateString('en-IN'),
      },
    });
  } catch (error) {
    console.error(`[welcome-kit] Delivered email failed for kit ${id}: ${error?.name || 'Error'}:${error?.code || 'unknown'}`);
  }
  return safeKit(delivered);
}
