// Phase 5b: Provide paginated content, enquiry, log, and reporting data to admin controllers.
import AuditLog from '../models/AuditLog.js';
import Counter from '../models/Counter.js';
import EmailLog from '../models/EmailLog.js';
import Enquiry from '../models/Enquiry.js';
import Event from '../models/Event.js';
import Membership from '../models/Membership.js';
import mongoose from 'mongoose';
import Payment from '../models/Payment.js';
import PointsTransaction from '../models/PointsTransaction.js';
import Post from '../models/Post.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { createEmailToken } from './token.service.js';
import { sendMail } from './mail.service.js';
import { env } from '../config/env.js';

function pageArgs(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit, skip: (page - 1) * limit };
}

function pageResult(items, total, page, limit) {
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

function dateFilter(from, to, field = 'createdAt') {
  if (!from && !to) return {};
  const range = {};
  if (from) range.$gte = new Date(from);
  if (to) {
    const end = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) end.setUTCHours(23, 59, 59, 999);
    range.$lte = end;
  }
  return { [field]: range };
}

export async function publicPosts(query = {}) {
  const { page, limit, skip } = pageArgs(query);
  const filter = { status: 'published' };
  if (query.category) filter.category = query.category;
  const [items, total] = await Promise.all([
    Post.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments(filter),
  ]);
  return pageResult(items, total, page, limit);
}

export async function publicPost(slug) {
  const post = await Post.findOne({ slug, status: 'published' }).lean();
  if (!post) throw new ApiError(404, 'Published story was not found.');
  return post;
}

export async function publicEvents(query = {}) {
  const { page, limit, skip } = pageArgs(query);
  const filter = { status: 'published', date: { $gte: new Date() } };
  const [items, total] = await Promise.all([
    Event.find(filter).sort({ date: 1 }).skip(skip).limit(limit).lean(),
    Event.countDocuments(filter),
  ]);
  return pageResult(items, total, page, limit);
}

export async function publicEvent(slug) {
  const event = await Event.findOne({ slug, status: 'published', date: { $gte: new Date() } }).lean();
  if (!event) throw new ApiError(404, 'Upcoming event was not found.');
  return event;
}

export async function listPosts(query) {
  const { page, limit, skip } = pageArgs(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.category) filter.category = query.category;
  const [items, total] = await Promise.all([
    Post.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
    Post.countDocuments(filter),
  ]);
  return pageResult(items, total, page, limit);
}

export async function listEvents(query) {
  const { page, limit, skip } = pageArgs(query);
  const filter = {};
  if (query.status) filter.status = query.status;
  const [items, total] = await Promise.all([
    Event.find(filter).sort({ date: -1 }).skip(skip).limit(limit).lean(),
    Event.countDocuments(filter),
  ]);
  return pageResult(items, total, page, limit);
}

export async function saveContent(Model, body, file, id) {
  const values = { ...body };
  if (file?.publicUrl) {
    const imagePath = file.publicUrl.replace(/\\/g, '/');
    if (Model === Post) values.coverImage = imagePath;
    else values.image = imagePath;
  }
  if (Model === Event && values.capacity === '') values.capacity = null;
  try {
    const record = id ? await Model.findById(id) : new Model();
    if (!record) throw new ApiError(404, 'Content record was not found.');
    Object.assign(record, values);
    await record.save();
    return record;
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'That slug is already in use.');
    throw error;
  }
}

export async function deleteContent(Model, id) {
  const record = await Model.findByIdAndDelete(id);
  if (!record) throw new ApiError(404, 'Content record was not found.');
  return record;
}

export async function createEnquiry(values) {
  const { recaptchaToken, ...enquiryValues } = values;
  const enquiry = await Enquiry.create(enquiryValues);
  if (!env.adminNotifyEmail) {
    throw new ApiError(503, 'Your enquiry was saved, but notification delivery is not configured. Please contact us directly.');
  }
  try {
    await sendMail({
      to: env.adminNotifyEmail,
      subject: `New ${enquiry.type} enquiry from ${enquiry.name}`,
      template: 'enquiry-notification',
      data: enquiry.toObject(),
    });
  } catch {
    console.error('[enquiry] Notification email could not be sent.');
    throw new ApiError(503, 'Your enquiry was received, but the team notification could not be sent. Please try again later.');
  }
  return enquiry;
}

export async function listEnquiries(query) {
  const { page, limit, skip } = pageArgs(query);
  const filter = { ...dateFilter(query.from, query.to) };
  if (query.status) filter.status = query.status;
  if (query.type) filter.type = query.type;
  if (query.search) {
    const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: expression }, { email: expression }, { mobile: expression }, { message: expression }];
  }
  const [items, total] = await Promise.all([
    Enquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('internalNotes.admin', 'firstName email').lean(),
    Enquiry.countDocuments(filter),
  ]);
  return pageResult(items, total, page, limit);
}

export async function updateEnquiryStatus(id, status) {
  const enquiry = await Enquiry.findByIdAndUpdate(id, { $set: { status } }, { new: true, runValidators: true });
  if (!enquiry) throw new ApiError(404, 'Enquiry was not found.');
  return enquiry;
}

export async function addEnquiryNote(id, adminId, note) {
  const enquiry = await Enquiry.findByIdAndUpdate(id, { $push: { internalNotes: { admin: adminId, note } } }, { new: true })
    .populate('internalNotes.admin', 'firstName email');
  if (!enquiry) throw new ApiError(404, 'Enquiry was not found.');
  return enquiry;
}

export async function listAdmins(query) {
  const { page, limit, skip } = pageArgs(query);
  const filter = { role: 'admin', deletedAt: null };
  if (query.status) filter.status = query.status;
  if (query.search) {
    const expression = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ firstName: expression }, { email: expression }];
  }
  const [items, total] = await Promise.all([
    User.find(filter).select('firstName email role status emailVerified createdAt lastLoginAt').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    User.countDocuments(filter),
  ]);
  return pageResult(items, total, page, limit);
}

export async function createAdmin(values) {
  let admin;
  try {
    admin = await User.create({ ...values, role: 'admin', status: 'pending', emailVerified: false });
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'An account with this email already exists.');
    throw error;
  }
  const activationToken = await createEmailToken(admin._id, 'activation');
  const link = `${env.frontendUrl.replace(/\/+$/, '')}/set-password?token=${encodeURIComponent(activationToken)}`;
  let activationEmailSent = true;
  try {
    await sendMail({
      to: admin.email,
      subject: 'Set your OrianaaClub password',
      template: 'activation',
      data: { firstName: admin.firstName, link, expiry: `${env.activationTokenDays} days` },
    });
  } catch {
    activationEmailSent = false;
    console.error('[admin] Admin password setup email could not be sent.');
  }
  return { admin, activationEmailSent };
}

export async function setAdminStatus(id, status, actorId) {
  if (String(id) === String(actorId) && status !== 'active') {
    throw new ApiError(409, 'You cannot deactivate your own administrator account.');
  }
  const session = await mongoose.startSession();
  let updatedAdmin;
  try {
    await session.withTransaction(async () => {
      // This shared write serializes concurrent changes to active admin accounts.
      await Counter.findOneAndUpdate(
        { name: 'admin-status-guard' },
        { $inc: { value: 1 } },
        { upsert: true, new: true, session },
      );
      const target = await User.findOne({ _id: id, role: 'admin', deletedAt: null }).session(session);
      if (!target) throw new ApiError(404, 'Administrator was not found.');
      if (target.status === status) {
        updatedAdmin = target;
        return;
      }
      if (target.status === 'pending' && status === 'active') {
        throw new ApiError(409, 'A pending administrator must set a password using the invitation email.');
      }
      if (target.status === 'active' && status !== 'active') {
        const otherActiveAdmins = await User.countDocuments({
          role: 'admin', status: 'active', deletedAt: null, _id: { $ne: target._id },
        }).session(session);
        if (otherActiveAdmins === 0) {
          throw new ApiError(409, 'The last active administrator cannot be deactivated.');
        }
      }
      target.status = status;
      await target.save({ session });
      updatedAdmin = target;
    });
    return updatedAdmin;
  } finally {
    await session.endSession();
  }
}

export async function listAuditLogs(query) {
  const { page, limit, skip } = pageArgs(query);
  const filter = { ...dateFilter(query.from, query.to) };
  if (query.admin) filter.admin = query.admin;
  if (query.actor) {
    const escapedActor = query.actor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const expression = new RegExp(escapedActor, 'i');
    const matchingAdmins = await User.find({
      role: 'admin',
      $or: [{ firstName: expression }, { email: expression }],
    }).distinct('_id');
    const actorMatches = [
      { actorType: expression },
      { admin: { $in: matchingAdmins } },
      { actorId: { $in: matchingAdmins } },
    ];
    if (/^[a-f\d]{24}$/i.test(query.actor)) {
      actorMatches.push({ actorId: query.actor });
    }
    filter.$or = actorMatches;
  }
  if (query.action) filter.action = query.action;
  if (query.entityType) filter.entityType = query.entityType;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('admin', 'firstName email').lean(),
    AuditLog.countDocuments(filter),
  ]);
  return pageResult(items, total, page, limit);
}

export async function listEmailLogs(query) {
  const { page, limit, skip } = pageArgs(query);
  const filter = dateFilter(query.from, query.to);
  if (query.status) filter.status = query.status;
  if (query.template) filter.template = query.template;
  if (query.search) filter.to = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  const [items, total] = await Promise.all([
    EmailLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    EmailLog.countDocuments(filter),
  ]);
  return pageResult(items, total, page, limit);
}

export async function reports(query = {}) {
  const membershipFilter = dateFilter(query.from, query.to);
  const paymentFilter = {
    ...dateFilter(query.from, query.to),
    status: { $in: ['paid', 'partially_refunded', 'refunded'] },
  };
  const pointsFilter = dateFilter(query.from, query.to);
  const [membersByPlan, revenueByMonth, pointsByMonth] = await Promise.all([
    Membership.aggregate([
      { $match: { ...membershipFilter, status: { $nin: ['cancelled', 'expired'] } } },
      { $group: { _id: '$plan', members: { $sum: 1 } } },
      { $lookup: { from: 'plans', localField: '_id', foreignField: '_id', as: 'plan' } },
      { $unwind: { path: '$plan', preserveNullAndEmptyArrays: true } },
      { $project: { plan: { $ifNull: ['$plan.title', 'Unknown'] }, members: 1 } },
      { $sort: { members: -1 } },
    ]),
    Payment.aggregate([
      { $match: paymentFilter },
      { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, totalPaise: { $sum: '$totalAmount' }, payments: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]),
    PointsTransaction.aggregate([
      { $match: pointsFilter },
      { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$createdAt' } }, type: '$type' }, total: { $sum: '$amount' } } },
      { $sort: { '_id.month': 1 } },
    ]),
  ]);
  const pointsMap = new Map();
  for (const row of pointsByMonth) {
    const value = pointsMap.get(row._id.month) || { month: row._id.month, issued: 0, spent: 0 };
    value[row._id.type === 'credit' ? 'issued' : 'spent'] = row.total;
    pointsMap.set(row._id.month, value);
  }
  return { membersByPlan, revenueByMonth, pointsByMonth: [...pointsMap.values()] };
}

export async function exportReportCsv(response, reportName, query = {}) {
  const { writeCsvHeader, writeCsvRow } = await import('../utils/csv.js');
  const data = await reports(query);
  if (reportName === 'members-by-plan') {
    writeCsvHeader(response, 'members-by-plan.csv', ['Plan', 'Members']);
    data.membersByPlan.forEach((item) => writeCsvRow(response, [item.plan, item.members]));
  } else if (reportName === 'revenue-by-month') {
    writeCsvHeader(response, 'revenue-by-month.csv', ['Month', 'Revenue (paise)', 'Payments']);
    data.revenueByMonth.forEach((item) => writeCsvRow(response, [item._id, item.totalPaise, item.payments]));
  } else {
    writeCsvHeader(response, 'points-by-month.csv', ['Month', 'Issued', 'Spent']);
    data.pointsByMonth.forEach((item) => writeCsvRow(response, [item.month, item.issued, item.spent]));
  }
  response.end();
}
