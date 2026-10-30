import mongoose from 'mongoose';
import Profile from '../models/Profile.js';
import MembershipDraft from '../models/MembershipDraft.js';
import MembershipDraftArchive from '../models/MembershipDraftArchive.js';
import Membership from '../models/Membership.js';
import Payment from '../models/Payment.js';
import MembershipPlan from '../models/MembershipPlan.js';
import IdentityVerification from '../models/IdentityVerification.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { sendAdminActivation } from './auth.service.js';
import { deleteMembershipDraftArtifacts } from './membership-draft.service.js';
import { finalizePayment } from './payment.service.js';
import { setMemberTemporaryPassword } from './admin.service.js';

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
  const [result] = await MembershipDraft.aggregate([
    { $match: { $and: [filter, { status: { $nin: ['paid', 'password_pending', 'active'] } }] } },
    {
      $lookup: {
        from: Payment.collection.name,
        let: { paymentId: '$payment', userId: '$user' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $and: [{ $ne: ['$$paymentId', null] }, { $eq: ['$_id', '$$paymentId'] }] },
                  { $and: [{ $eq: ['$$paymentId', null] }, { $ne: ['$$userId', null] }, { $eq: ['$user', '$$userId'] }] },
                ],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { status: 1, reference: 1, note: 1 } },
        ],
        as: 'paymentRecord',
      },
    },
    {
      $match: {
        $or: [
          { 'paymentRecord.0': { $exists: false } },
          { 'paymentRecord.0.status': { $nin: ['paid', 'confirmed'] } },
        ],
      },
    },
    {
      $facet: {
        items: [
          { $sort: { needsHelp: -1, updatedAt: -1 } },
          { $skip: skip },
          { $limit: limit },
        ],
        total: [{ $count: 'count' }],
      },
    },
  ]);
  const drafts = await MembershipDraft.populate(result?.items || [], { path: 'plan', select: 'title name' });
  const total = result?.total?.[0]?.count || 0;
  const items = await Promise.all(drafts.map(async (draft) => {
    const [user] = await Promise.all([
      draft.user ? User.findById(draft.user).select('+passwordHash') : null,
    ]);
    const payment = draft.paymentRecord?.[0] || null;
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

function findDraftPayment(draft) {
  if (draft.payment) return Payment.findById(draft.payment);
  if (draft.membership) return Payment.findOne({ membership: draft.membership }).sort({ createdAt: -1 });
  if (draft.user) return Payment.findOne({ user: draft.user }).sort({ createdAt: -1 });
  return null;
}

function archivedResult(archive) {
  return {
    memberId: archive.user ? String(archive.user) : '',
    membershipId: archive.membership ? String(archive.membership) : '',
    paymentId: archive.payment ? String(archive.payment) : '',
    status: 'paid',
    alreadyFinalized: true,
  };
}

export async function finalizeDraft(draftId, adminId) {
  const completed = await MembershipDraftArchive.findOne({ draftId });
  if (completed) return archivedResult(completed);

  let prepared;
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const draft = await MembershipDraft.findById(draftId)
        .select('+tokenHash +otpHash +otpSalt +identity.panCiphertext +identity.idCiphertext +identity.aadhaarLast4 +identity.aadhaarHash')
        .session(session);
      if (!draft) throw new ApiError(404, 'Draft member was not found.');

      const payment = await findDraftPayment(draft)?.session(session);
      if (!payment) throw new ApiError(409, 'A submitted membership payment is required before finalizing this draft.');
      if (!['created', 'pending', 'pending_verification', 'confirmed', 'paid'].includes(payment.status)) {
        throw new ApiError(409, 'This payment cannot be marked paid.');
      }

      let user = draft.user
        ? await User.findById(draft.user).select('+passwordHash').session(session)
        : null;
      if (!user) user = await User.findOne({ email: draft.email, deletedAt: null }).select('+passwordHash').session(session);
      if (!user) {
        [user] = await User.create([{
          firstName: draft.firstName,
          email: draft.email,
          role: 'member',
          status: 'pending_activation',
          emailVerified: true,
          activationRequiresMembershipPayment: false,
        }], { session });
      } else {
        if (user.role !== 'member' || user.deletedAt) {
          throw new ApiError(409, 'This draft email cannot be used for a member account.');
        }
        user.firstName = draft.firstName || user.firstName;
        user.email = draft.email;
        user.emailVerified = true;
        user.activationRequiresMembershipPayment = false;
        if (user.status !== 'active' && user.status !== 'suspended') {
          user.status = user.passwordHash ? 'active' : 'pending_activation';
        }
        await user.save({ session });
      }

      let identity = await IdentityVerification.findOne({ user: user._id }).session(session);
      if (!identity) {
        const previousUserIds = [draft.user, payment.user, draft._id]
          .filter((userId) => userId && String(userId) !== String(user._id));
        if (previousUserIds.length) {
          identity = await IdentityVerification.findOne({ user: { $in: previousUserIds } }).session(session);
          if (identity) {
            identity.user = user._id;
            await identity.save({ session });
          }
        }
      }
      if (!identity && draft.identity?.panCiphertext && draft.identity?.idCiphertext
        && draft.identity?.consentAt && draft.identity?.documents?.length) {
        [identity] = await IdentityVerification.create([{
          user: user._id,
          panCiphertext: draft.identity.panCiphertext,
          panMask: draft.identity.panMask,
          idType: draft.identity.idType,
          idCiphertext: draft.identity.idCiphertext,
          idMask: draft.identity.idMask,
          aadhaarLast4: draft.identity.aadhaarLast4 || '',
          aadhaarHash: draft.identity.aadhaarHash || '',
          status: 'pending',
          consentAt: draft.identity.consentAt,
          documents: draft.identity.documents,
        }], { session });
      }

      const profile = draft.profile || {};
      if (profile.fullName && profile.gender && profile.countryCode && profile.mobile
        && profile.dob && profile.interestArea) {
        await Profile.updateOne(
          { user: user._id },
          {
            $set: {
              user: user._id,
              fullName: profile.fullName,
              gender: profile.gender,
              countryCode: profile.countryCode,
              mobile: profile.mobile,
              dob: profile.dob,
              interestArea: profile.interestArea,
              agreePromo: Boolean(profile.agreePromo),
              photoUrl: profile.photoUrl || '',
            },
          },
          { upsert: true, runValidators: true, session },
        );
      }

      let membership = draft.membership
        ? await Membership.findById(draft.membership).session(session)
        : null;
      if (!membership) {
        membership = await Membership.findOne({
          user: user._id,
          status: { $in: ['draft', 'pending_payment', 'payment_pending', 'pending_verification', 'pending_approval', 'active'] },
        }).sort({ createdAt: -1 }).session(session);
      }

      const planId = draft.plan || payment.plan;
      if (!membership) {
        if (!planId) throw new ApiError(409, 'A membership plan is required before finalizing this draft.');
        [membership] = await Membership.create([{
          user: user._id,
          customer: user._id,
          plan: planId,
          planModel: 'MembershipPlan',
          status: 'pending_payment',
        }], { session });
      } else {
        membership.user = user._id;
        membership.customer = user._id;
        if (planId) {
          membership.plan = planId;
          membership.planModel = 'MembershipPlan';
        }
        await membership.save({ session });
      }

      payment.user = user._id;
      payment.membership = membership._id;
      if (planId) {
        payment.plan = planId;
        payment.planModel = 'MembershipPlan';
      }
      await payment.save({ session });

      draft.user = user._id;
      draft.membership = membership._id;
      draft.payment = payment._id;
      await draft.save({ session });
      prepared = {
        userId: user._id,
        membershipId: membership._id,
        paymentId: payment._id,
      };
    });
  } catch (error) {
    if (error.statusCode === 404) {
      const archive = await MembershipDraftArchive.findOne({ draftId });
      if (archive) return archivedResult(archive);
    }
    if (error.code === 11000) {
      const archive = await MembershipDraftArchive.findOne({ draftId });
      if (archive) return archivedResult(archive);
    }
    throw error;
  } finally {
    await session.endSession();
  }

  const payment = await Payment.findById(prepared.paymentId);
  if (!payment) throw new ApiError(404, 'The application payment was not found.');
  await finalizePayment(payment._id, { adminId });

  const archiveSession = await mongoose.startSession();
  let concurrentArchive;
  try {
    await archiveSession.withTransaction(async () => {
      const existing = await MembershipDraftArchive.findOne({ draftId }).session(archiveSession);
      if (existing) {
        concurrentArchive = archivedResult(existing);
        return;
      }
      const draft = await MembershipDraft.findById(draftId)
        .select('+tokenHash +otpHash +otpSalt +identity.panCiphertext +identity.idCiphertext +identity.aadhaarLast4 +identity.aadhaarHash')
        .session(archiveSession);
      if (!draft) throw new ApiError(404, 'Draft member was not found.');
      draft.status = 'paid';
      draft.currentStep = 6;
      draft.lastEmailError = '';
      draft.convertedAt ||= new Date();
      await draft.save({ session: archiveSession });
      await MembershipDraftArchive.create([{
        draftId: draft._id,
        user: draft.user,
        membership: draft.membership,
        payment: draft.payment,
        archivedBy: adminId || null,
        snapshot: draft.toObject({ depopulate: true }),
      }], { session: archiveSession });
      await MembershipDraft.deleteOne({ _id: draft._id }, { session: archiveSession });
    });
    if (concurrentArchive) return concurrentArchive;
  } catch (error) {
    const archive = await MembershipDraftArchive.findOne({ draftId });
    if (!archive) throw error;
    return archivedResult(archive);
  } finally {
    await archiveSession.endSession();
  }
  return {
    memberId: String(prepared.userId),
    membershipId: String(prepared.membershipId),
    paymentId: String(prepared.paymentId),
    status: 'paid',
    alreadyFinalized: false,
  };
}

export async function markDraftMemberPaid(id, adminId, { transactionId, note }) {
  const existingArchive = await MembershipDraftArchive.findOne({ draftId: id });
  if (existingArchive) return archivedResult(existingArchive);
  let draft;
  try {
    draft = await findDraft(id);
  } catch (error) {
    if (error.statusCode !== 404) throw error;
    const archive = await MembershipDraftArchive.findOne({ draftId: id });
    if (archive) return archivedResult(archive);
    throw error;
  }
  const payment = await findDraftPayment(draft);
  if (!payment) throw new ApiError(409, 'A submitted membership payment is required before it can be marked paid.');
  if (!['created', 'pending', 'pending_verification', 'confirmed', 'paid'].includes(payment.status)) {
    throw new ApiError(409, 'This payment cannot be marked paid.');
  }
  payment.reference = transactionId;
  if (note) payment.note = note;
  await payment.save();
  if (note) draft.adminNotes = note;
  await draft.save();
  return finalizeDraft(id, adminId);
}

export async function setDraftMemberTemporaryPassword(id) {
  const draft = await findDraft(id);
  if (!draft.user || !['paid', 'password_pending', 'payment_submitted'].includes(draft.status)) {
    throw new ApiError(409, 'Mark the submitted membership payment as paid before setting a temporary password.');
  }
  const result = await setMemberTemporaryPassword(draft.user);
  draft.status = 'active';
  draft.currentStep = 6;
  await draft.save();
  return { temporaryPassword: result.temporaryPassword, memberId: String(draft.user) };
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
