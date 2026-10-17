// Phase 5a: Provide paginated administration queries and audited business operations.
import mongoose from 'mongoose';
import Counter from '../models/Counter.js';
import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import MembershipPlan from '../models/MembershipPlan.js';
import Payment from '../models/Payment.js';
import Plan from '../models/Plan.js';
import PointsTransaction from '../models/PointsTransaction.js';
import Profile from '../models/Profile.js';
import { getSettings } from '../models/Setting.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { calculateGst, getPayableAmount } from '../utils/money.js';
import { sendAdminActivation } from './auth.service.js';
import { finalizePayment } from './payment.service.js';
import { findMemberMatches } from './member-search.service.js';
import { getMembershipMemberCode } from '../utils/memberCode.js';

function pagination(query) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

export async function listMembers(query) {
  const { page, limit, skip } = pagination(query);
  const conditions = [{ role: 'member', deletedAt: null }];
  if (query.notActivated) conditions.push({ status: 'pending' });
  const membershipFilter = {};
  if (query.status) membershipFilter.status = query.status;
  if (query.plan) {
    const plan = mongoose.isValidObjectId(query.plan)
      ? await MembershipPlan.findById(query.plan).select('_id')
      : null;
    membershipFilter.planModel = 'MembershipPlan';
    membershipFilter.plan = plan?._id || { $in: [] };
  }
  if (query.search) {
    const matches = await findMemberMatches(query.search);
    conditions.push({ _id: { $in: matches.people.map((person) => person._id) } });
  }
  if (query.status || query.plan) {
    const membershipRows = await Membership.find(membershipFilter).select('user customer').lean();
    const memberUserIds = [...new Set(membershipRows.flatMap((membership) => (
      [membership.user, membership.customer].filter(Boolean).map(String)
    )))];
    conditions.push({ _id: { $in: memberUserIds } });
  }
  const sortMap = {
    createdAt: 'createdAt',
    name: 'firstName',
    email: 'email',
    status: 'status',
  };
  const sortField = sortMap[query.sort] || 'createdAt';
  const sortOrder = query.order === 'asc' ? 1 : -1;
  const filter = { $and: conditions };
  const [users, total] = await Promise.all([
    User.find(filter).sort({ [sortField]: sortOrder, _id: 1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  const ids = users.map((user) => user._id);
  const [profiles, memberships] = await Promise.all([
    Profile.find({ user: { $in: ids } }).lean(),
    Membership.find({
      $or: [{ user: { $in: ids } }, { customer: { $in: ids } }],
      ...membershipFilter,
    }).sort({ createdAt: -1 }).populate('plan', 'name title slug').lean(),
  ]);
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  const membershipByUser = new Map();
  memberships.forEach((membership) => {
    const userId = membership.user || membership.customer;
    if (userId && !membershipByUser.has(String(userId))) membershipByUser.set(String(userId), membership);
  });
  return {
    items: users.map((user) => {
      const membership = membershipByUser.get(String(user._id)) || null;
      return {
        ...user,
        profile: profileByUser.get(String(user._id)) || null,
        membership: membership
          ? { ...membership, displayMemberCode: getMembershipMemberCode(membership) }
          : null,
      };
    }),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function getMemberDetails(userId) {
  const user = await User.findOne({ _id: userId, role: 'member', deletedAt: null }).lean();
  if (!user) throw new ApiError(404, 'Member was not found.');
  const [profile, membership, payments] = await Promise.all([
    Profile.findOne({ user: userId }).lean(),
    Membership.findOne({ $or: [{ user: userId }, { customer: userId }] })
      .sort({ createdAt: -1 }).populate('plan').lean(),
    Payment.find({ user: userId }).sort({ createdAt: -1 }).lean(),
  ]);
  const [family, points] = await Promise.all([
    membership ? FamilyMember.find({ membership: membership._id }).sort({ createdAt: 1 }).lean() : [],
    membership
      ? PointsTransaction.aggregate([
        { $match: { membership: membership._id } },
        { $group: { _id: '$type', total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ])
      : [],
  ]);
  return {
    user,
    profile,
    membership: membership
      ? { ...membership, displayMemberCode: getMembershipMemberCode(membership) }
      : null,
    family,
    payments,
    points,
  };
}

export async function updateMemberProfile(userId, values) {
  const user = await User.findOne({ _id: userId, role: 'member', deletedAt: null });
  if (!user) throw new ApiError(404, 'Member was not found.');
  const { firstName, email, ...profileValues } = values;
  if (firstName) user.firstName = firstName;
  if (email) user.email = email;
  try {
    await user.save();
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'That email address is already in use.');
    throw error;
  }
  let profile = await Profile.findOne({ user: userId });
  if (profile) {
    Object.assign(profile, profileValues);
    await profile.save();
  } else if (Object.keys(profileValues).length) {
    profile = await Profile.create({ user: userId, ...profileValues });
  }
  return { user, profile };
}

export async function changeMemberStatus(userId, status) {
  const user = await User.findOneAndUpdate(
    { _id: userId, role: 'member', deletedAt: null },
    { $set: { status } },
    { new: true, runValidators: true },
  );
  if (!user) throw new ApiError(404, 'Member was not found.');
  return user;
}

export async function softDeleteMember(userId) {
  const user = await User.findOneAndUpdate(
    { _id: userId, role: 'member', deletedAt: null },
    { $set: { deletedAt: new Date(), status: 'suspended' } },
    { new: true },
  );
  if (!user) throw new ApiError(404, 'Member was not found.');
  return user;
}

export async function resendMemberActivation(userId) {
  const sent = await sendAdminActivation(userId);
  return { userId, sent };
}

export async function createMember({ user: userValues, profile: profileValues, planSlug, offlinePayment }, adminId) {
  const plan = await Plan.findOne({ slug: planSlug, isActive: true });
  if (!plan) throw new ApiError(404, 'Active membership plan was not found.');
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const [user] = await User.create([{
        firstName: userValues.firstName,
        email: userValues.email,
        role: 'member',
        status: 'pending',
        emailVerified: false,
      }], { session });
      const [profile] = await Profile.create([{ ...profileValues, user: user._id }], { session });
      const [membership] = await Membership.create([{
        user: user._id,
        plan: plan._id,
        status: 'draft',
        pointsBalance: 0,
      }], { session });
      created = { user, profile, membership, plan };
    });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'A member with this email already exists.');
    throw error;
  } finally {
    await session.endSession();
  }
  created.activationEmailSent = false;
  if (offlinePayment) {
    created.payment = await recordManualPayment({
      member: created.user,
      membership: created.membership,
      plan: created.plan,
      method: offlinePayment.method,
      reference: offlinePayment.reference,
      paymentDate: offlinePayment.paymentDate,
      amountPaise: offlinePayment.amountPaise,
      note: offlinePayment.note,
      adminId,
    });
  }
  return created;
}

export async function recordManualPayment({
  member, membership, plan, method, reference, paymentDate, amountPaise, note, adminId,
}) {
  if (!['bank_transfer', 'cheque', 'rtgs'].includes(method)) {
    throw new ApiError(400, 'New offline payments must use bank transfer, cheque, or RTGS.');
  }
  if (!reference?.trim() || (method === 'rtgs'
    && (!/^[a-z\d/-]{6,50}$/i.test(reference.trim()) || !paymentDate))) {
    throw new ApiError(400, 'A bank reference or cheque number is required.');
  }
  if (method === 'rtgs' && await Payment.exists({ utr: reference.trim() })) {
    throw new ApiError(409, 'This RTGS UTR has already been used.');
  }
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    throw new ApiError(400, 'Offline payment amount must be a positive integer in paise.');
  }
  const settings = await getSettings();
  const breakdown = getPayableAmount(plan, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  if (amountPaise !== breakdown.totalAmount) {
    throw new ApiError(400, 'Offline payment amount must match the GST-inclusive plan total.');
  }
  const payment = await Payment.create({
    user: member._id,
    membership: membership._id,
    plan: plan._id,
    planModel: 'Plan',
    amount: plan.price,
    method,
    reference: reference.trim(),
    ...(method === 'rtgs' ? { utr: reference.trim() } : {}),
    transferDate: paymentDate || null,
    status: 'created',
    ...breakdown,
    verifiedBy: adminId,
    note,
  });
  return finalizePayment(payment._id, { adminId });
}

export async function listPlans(query) {
  const { page, limit, skip } = pagination(query);
  const [items, total] = await Promise.all([
    Plan.find({}).sort({ sortOrder: 1, title: 1 }).skip(skip).limit(limit).lean(),
    Plan.countDocuments({}),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function listPayments(query) {
  const { page, limit, skip } = pagination(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.method) filter.method = query.method;
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
    Payment.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('user', 'firstName email').populate('plan', 'title name slug').lean(),
    Payment.countDocuments(filter),
  ]);
  return {
    items: items.map((payment) => ({
      ...payment,
      canDownloadReceipt: payment.status === 'confirmed',
    })),
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export async function getPayment(paymentId) {
  const payment = await Payment.findById(paymentId)
    .populate('user', 'firstName email')
    .populate('plan', 'title name slug')
    .populate('membership', 'memberId memberNumber status verificationDocs');
  if (!payment) throw new ApiError(404, 'Payment was not found.');
  return payment;
}

export async function streamPaymentsCsv(response, query) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.method) filter.method = query.method;
  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      if (/^\d{4}-\d{2}-\d{2}$/.test(query.to)) end.setUTCHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  const { writeCsvHeader, writeCsvRow } = await import('../utils/csv.js');
  writeCsvHeader(response, 'oriana-payments.csv', ['Created', 'Member', 'Email', 'Plan', 'Method', 'Status', 'Base (paise)', 'GST (paise)', 'Total (paise)', 'Invoice']);
  const cursor = Payment.find(filter).sort({ createdAt: -1 }).populate('user', 'firstName email').populate('plan', 'title').lean().cursor();
  for await (const payment of cursor) {
    writeCsvRow(response, [
      payment.createdAt?.toISOString(), payment.user?.firstName, payment.user?.email,
      payment.plan?.title, payment.method, payment.status, payment.baseAmount,
      payment.gstAmount, payment.totalAmount, payment.invoiceNumber,
    ]);
  }
  response.end();
}

export async function createPlan(values) {
  try {
    const slug = values.slug || values.id;
    const numericPrice = Number(values.price);
    const gstAmount = calculateGst(numericPrice, values.gstPercent);
    return await Plan.create({
      ...values,
      id: values.id || slug,
      slug,
      name: values.name || values.title,
      displayOrder: values.displayOrder ?? values.sortOrder,
      numericPrice,
      gst: gstAmount,
      total: Number(values.planFee) + gstAmount,
      legacyCheckoutPayable: numericPrice + gstAmount,
    });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'A plan with this slug already exists.');
    throw error;
  }
}

export async function updatePlan(planId, values) {
  const updates = { ...values };
  if (updates.title !== undefined) updates.name = updates.title;
  if (updates.name !== undefined) updates.title = updates.name;
  if (updates.sortOrder !== undefined) updates.displayOrder = updates.sortOrder;
  if (updates.displayOrder !== undefined) updates.sortOrder = updates.displayOrder;
  if (updates.price !== undefined || updates.gstPercent !== undefined || updates.planFee !== undefined) {
    const current = await Plan.findById(planId);
    if (!current) throw new ApiError(404, 'Plan was not found.');
    const price = updates.price ?? current.price;
    const gstPercent = updates.gstPercent ?? current.gstPercent;
    const planFee = updates.planFee ?? current.planFee;
    const gst = calculateGst(price, gstPercent);
    updates.numericPrice = price;
    updates.gst = gst;
    updates.total = planFee + gst;
    updates.legacyCheckoutPayable = price + gst;
  }
  const plan = await Plan.findByIdAndUpdate(planId, { $set: updates }, { new: true, runValidators: true });
  if (!plan) throw new ApiError(404, 'Plan was not found.');
  return plan;
}

export async function dashboardSummary() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  monthStart.setUTCMonth(monthStart.getUTCMonth() - 11);
  const signupStart = new Date();
  signupStart.setUTCDate(signupStart.getUTCDate() - 29);
  signupStart.setUTCHours(0, 0, 0, 0);
  const [memberStatuses, signups, paidSummary, revenueMonths, planCounts, pendingBankTransfers, pointsTotals] = await Promise.all([
    User.aggregate([{ $match: { role: 'member', deletedAt: null } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    User.aggregate([
      { $match: { role: 'member', deletedAt: null, createdAt: { $gte: signupStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    Payment.aggregate([{ $match: { status: 'paid' } }, { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } }]),
    Payment.aggregate([
      { $match: { status: 'paid', createdAt: { $gte: monthStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, total: { $sum: '$totalAmount' } } },
      { $sort: { _id: 1 } },
    ]),
    Membership.aggregate([
      { $match: { status: { $ne: 'cancelled' } } },
      { $group: { _id: '$plan', count: { $sum: 1 } } },
      { $lookup: { from: Plan.collection.name, localField: '_id', foreignField: '_id', as: 'plan' } },
      { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
      { $project: { plan: '$plan.title', count: 1 } },
      { $sort: { count: -1 } },
    ]),
    Payment.countDocuments({ method: 'bank_transfer', status: 'pending_verification' }),
    PointsTransaction.aggregate([
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
  ]);
  const statusTotals = Object.fromEntries(memberStatuses.map((row) => [row._id, row.count]));
  const signupMap = new Map(signups.map((row) => [row._id, row.count]));
  const dailySignups = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(signupStart);
    day.setUTCDate(day.getUTCDate() + index);
    const date = day.toISOString().slice(0, 10);
    return { date, count: signupMap.get(date) || 0 };
  });
  const revenueMap = new Map(revenueMonths.map((row) => [row._id, row.total]));
  const monthlyRevenue = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(monthStart);
    date.setUTCMonth(date.getUTCMonth() + index);
    const month = date.toISOString().slice(0, 7);
    return { month, totalAmount: revenueMap.get(month) || 0 };
  });
  const pointTotals = Object.fromEntries(pointsTotals.map((row) => [row._id, row.total]));
  return {
    members: {
      total: Object.values(statusTotals).reduce((sum, count) => sum + count, 0),
      byStatus: statusTotals,
      signupsLast30Days: dailySignups,
    },
    revenue: {
      totalAmount: paidSummary[0]?.total || 0,
      paidPayments: paidSummary[0]?.count || 0,
      monthly: monthlyRevenue,
    },
    planCounts,
    pendingBankTransfers,
    points: { issued: pointTotals.credit || 0, spent: pointTotals.debit || 0 },
  };
}

export async function getFamilyForMember(userId) {
  const membership = await Membership.findOne({ user: userId }).sort({ createdAt: -1 });
  if (!membership) return [];
  return FamilyMember.find({ membership: membership._id }).sort({ createdAt: 1 });
}

export async function updateFamilyMember(userId, familyId, values) {
  const membership = await Membership.findOne({ user: userId }).sort({ createdAt: -1 }).select('_id');
  const member = membership
    ? await FamilyMember.findOneAndUpdate(
      { _id: familyId, membership: membership._id },
      { $set: values },
      { new: true, runValidators: true },
    )
    : null;
  if (!member) throw new ApiError(404, 'Family member was not found.');
  return member;
}

export async function removeFamilyMember(userId, familyId) {
  const membership = await Membership.findOne({ user: userId }).sort({ createdAt: -1 }).select('_id');
  const member = membership
    ? await FamilyMember.findOneAndDelete({ _id: familyId, membership: membership._id })
    : null;
  if (!member) throw new ApiError(404, 'Family member was not found.');
  return member;
}

export async function nextAdminCounter(name, session) {
  return Counter.findOneAndUpdate(
    { name },
    { $inc: { value: 1 }, $setOnInsert: { name } },
    { new: true, upsert: true, session, setDefaultsOnInsert: true },
  );
}
