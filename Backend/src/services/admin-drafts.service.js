import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import MembershipDraft from '../models/MembershipDraft.js';
import Payment from '../models/Payment.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { sendAdminActivation } from './auth.service.js';
import { deleteMembershipDraftArtifacts } from './membership-draft.service.js';
import { finalizePayment } from './payment.service.js';

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function findDraft(id) {
  const draft = await MembershipDraft.findById(id);
  if (!draft) throw new ApiError(404, 'Draft member was not found.');
  return draft;
}

export async function listDraftMembers({ status, needsHelp, search, page = 1, limit = 25 }) {
  const filter = {};
  if (status) filter.status = status;
  if (needsHelp !== undefined) filter.needsHelp = needsHelp;
  if (search) {
    const expression = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { firstName: expression },
      { email: expression },
      { 'profile.fullName': expression },
      { 'profile.mobile': expression },
    ];
  }
  const skip = (page - 1) * limit;
  const [drafts, total] = await Promise.all([
    MembershipDraft.find(filter)
      .populate('plan', 'title name')
      .sort({ needsHelp: -1, updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    MembershipDraft.countDocuments(filter),
  ]);
  const items = await Promise.all(drafts.map(async (draft) => {
    const [payment, user] = await Promise.all([
      draft.payment
        ? Payment.findById(draft.payment).select('status reference note')
        : draft.user
          ? Payment.findOne({ user: draft.user }).sort({ createdAt: -1 }).select('status reference note')
          : null,
      draft.user ? User.findById(draft.user).select('+passwordHash') : null,
    ]);
    return {
      _id: String(draft._id),
      memberId: draft.user ? String(draft.user) : '',
      passwordSet: Boolean(user?.passwordHash),
      name: draft.profile?.fullName || draft.firstName,
      email: draft.email,
      phone: draft.profile?.mobile || '',
      plan: draft.plan?.title || draft.plan?.name || '',
      currentStep: draft.currentStep,
      status: draft.status,
      paymentStatus: payment?.status || 'not_submitted',
      transactionId: payment?.reference || '',
      needsHelp: draft.needsHelp,
      lastEmailError: draft.lastEmailError,
      adminNotes: draft.adminNotes,
      updatedAt: draft.updatedAt,
    };
  }));
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function resendDraftMemberLink(id) {
  const draft = await findDraft(id);
  if (!draft.user) throw new ApiError(409, 'A password link can be sent after the application has been submitted.');
  try {
    const sent = await sendAdminActivation(draft.user);
    draft.status = 'password_pending';
    draft.currentStep = 6;
    draft.lastEmailError = '';
    await draft.save();
    return { sent, memberId: String(draft.user) };
  } catch (error) {
    draft.lastEmailError = `${error?.name || 'Error'}: ${error?.code || 'Password-link delivery failed.'}`;
    await draft.save();
    console.error(
      `[admin-drafts] Password-link resend failed for application ${draft._id}: `
      + `${error?.name || 'Error'} ${error?.code || 'unknown'}.`,
    );
    error.draftMemberId = String(draft.user || draft._id);
    throw error;
  }
}

export async function markDraftMemberPaid(id, adminId, { transactionId, note }) {
  const draft = await findDraft(id);
  if (!draft.payment || !draft.membership || !draft.user) {
    throw new ApiError(409, 'A submitted membership payment is required before it can be marked paid.');
  }
  const payment = await Payment.findById(draft.payment);
  if (!payment) throw new ApiError(404, 'The application payment was not found.');
  if (!['created', 'pending', 'pending_verification', 'confirmed', 'paid'].includes(payment.status)) {
    throw new ApiError(409, 'This payment cannot be marked paid.');
  }
  payment.reference = transactionId;
  if (note) payment.note = note;
  await payment.save();
  if (payment.status !== 'paid') await finalizePayment(payment._id, { adminId });

  draft.status = 'paid';
  draft.currentStep = 6;
  draft.adminNotes = note || draft.adminNotes;
  draft.lastEmailError = '';
  await draft.save();
  return { memberId: String(draft.user), paymentId: String(payment._id), status: draft.status };
}

export async function setDraftMemberTemporaryPassword(id) {
  const draft = await findDraft(id);
  if (!draft.user || !['paid', 'password_pending', 'payment_submitted'].includes(draft.status)) {
    throw new ApiError(409, 'Mark the submitted membership payment as paid before setting a temporary password.');
  }
  const payment = draft.payment ? await Payment.findById(draft.payment).select('status') : null;
  if (!payment || !['paid', 'confirmed'].includes(payment.status)) {
    throw new ApiError(409, 'Confirm the membership payment before setting a temporary password.');
  }
  const user = await User.findOne({ _id: draft.user, role: 'member', deletedAt: null }).select('+passwordHash');
  if (!user) throw new ApiError(404, 'The member account was not found.');
  const temporaryPassword = `TempA1${randomBytes(12).toString('hex')}`;
  user.passwordHash = await bcrypt.hash(temporaryPassword, 12);
  user.emailVerified = true;
  await user.save();
  draft.status = 'password_pending';
  draft.currentStep = 6;
  await draft.save();
  return { temporaryPassword, memberId: String(user._id) };
}

export async function updateDraftMember(id, changes) {
  const draft = await findDraft(id);
  const previous = {
    email: draft.email,
    phone: draft.profile?.mobile || '',
    adminNotes: draft.adminNotes,
  };
  if (changes.email && changes.email !== draft.email) {
    const existingUser = await User.findOne({ email: changes.email, deletedAt: null }).select('_id');
    if (existingUser && String(existingUser._id) !== String(draft.user || '')) {
      throw new ApiError(409, 'This email is already associated with another account.');
    }
    const existingDraft = await MembershipDraft.findOne({
      _id: { $ne: draft._id },
      email: changes.email,
    }).select('_id');
    if (existingDraft) throw new ApiError(409, 'This email is already associated with another application.');
  }

  try {
    if (changes.email) {
      draft.email = changes.email;
      draft.profile = { ...draft.profile, email: changes.email };
    }
    if (changes.phone) draft.profile = { ...draft.profile, mobile: changes.phone };
    if (changes.adminNotes !== undefined) draft.adminNotes = changes.adminNotes;
    await draft.save();
  } catch (error) {
    if (error.code === 11000) throw new ApiError(409, 'This email is already associated with another application.');
    throw error;
  }

  if (draft.user) {
    if (changes.email) {
      await User.updateOne({ _id: draft.user }, { $set: { email: changes.email } });
    }
    const profileChanges = changes.phone ? { mobile: changes.phone } : {};
    if (Object.keys(profileChanges).length) {
      await Profile.updateOne({ user: draft.user }, { $set: profileChanges });
    }
  }
  return { draft, previous };
}

export async function activateDraftMember(id) {
  const draft = await findDraft(id);
  if (!draft.user || !['paid', 'password_pending', 'payment_submitted'].includes(draft.status)) {
    throw new ApiError(409, 'Mark the application paid before activating the member.');
  }
  const payment = draft.payment ? await Payment.findById(draft.payment).select('status') : null;
  if (!payment || !['paid', 'confirmed'].includes(payment.status)) {
    throw new ApiError(409, 'Confirm the membership payment before activating the member.');
  }
  const user = await User.findOne({ _id: draft.user, role: 'member', deletedAt: null }).select('+passwordHash');
  if (!user) throw new ApiError(404, 'The member account was not found.');
  if (!user.passwordHash) throw new ApiError(409, 'Set a temporary password before activating this member.');
  user.status = 'active';
  user.emailVerified = true;
  user.activationRequiresMembershipPayment = false;
  user.activatedAt ||= new Date();
  await user.save();
  draft.status = 'active';
  draft.currentStep = 6;
  await draft.save();
  return { memberId: String(user._id), email: user.email, status: draft.status };
}

export async function deleteDraftMember(id) {
  const draft = await findDraft(id);
  const record = {
    draftId: String(draft._id),
    memberId: draft.user ? String(draft.user) : '',
    email: draft.email,
  };
  await deleteMembershipDraftArtifacts(draft);
  await draft.deleteOne();
  return record;
}
