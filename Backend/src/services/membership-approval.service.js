import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import MembershipPlan from '../models/MembershipPlan.js';
import Plan from '../models/Plan.js';
import Profile from '../models/Profile.js';
import PointsLedger from '../models/PointsLedger.js';
import { DEFAULT_FAMILY_MEMBERSHIP_CONFIG, getSettings } from '../models/Setting.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { assignApprovalSeq, assignSeqBatch } from './approval-sequence.service.js';
import { creditPoints } from './points-ledger.service.js';
import { sendMail } from './mail.service.js';

function nomineeRole(member) {
  return String(member.nomineeRole || '').trim().toUpperCase();
}

function familySuffix(member, index = 1) {
  if (member.memberType === 'spouse') return '-S';
  if (member.memberType === 'child') return `-C${index}`;
  if (member.memberType === 'father') return member.parentSide === 'spouse' ? '-SF' : '-F';
  if (member.memberType === 'mother') return member.parentSide === 'spouse' ? '-SM' : '-M';
  if (member.memberType === 'nominee_gm') return '-GM';
  if (member.memberType === 'nominee_hr') return '-HR';
  return `-N${index}`;
}

async function getTierAndName(membership, session) {
  const PlanModel = membership.planModel === 'MembershipPlan' ? MembershipPlan : Plan;
  const plan = await PlanModel.findById(membership.plan).session(session).lean();
  if (!plan) throw new ApiError(409, 'The membership plan could not be found.');
  const tier = String(membership.tier || plan.slug || plan.id || plan.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return { tier, planName: plan.title || plan.name || 'Orianaa Club' };
}

async function makeMemberNumber(session, member, primary, nominees = []) {
  if (member.memberType === 'primary' || !member.linkedTo) return String(member.approvalSeq);
  if (member.memberType === 'nominee' || member.memberType === 'nominee_gm' || member.memberType === 'nominee_hr') {
    const role = nomineeRole(member);
    const index = nominees.findIndex((item) => item._id.toString() === member._id.toString()) + 1;
    return `${primary.memberNo}${familySuffix(member, role === 'GM' || role === 'HR' ? 1 : Math.max(1, index))}`;
  }

  let index = 1;
  if (member.memberType === 'child') {
    const siblings = await Membership.find({
      _id: { $ne: member._id },
      linkedTo: primary._id,
      memberType: 'child',
      memberNo: { $ne: '' },
    }).session(session).select('_id').lean();
    index = siblings.length + 1;
  }
  return `${primary.memberNo}${familySuffix(member, index)}`;
}

async function emailDetails(member, planName) {
  const userId = member.user || member.linkedUser;
  const user = userId && typeof userId === 'object'
    ? userId
    : userId
      ? await User.findById(userId).select('firstName email').lean()
      : null;
  const firstName = member.fullName?.split(/\s+/)[0]
    || member.name?.split(/\s+/)[0]
    || user?.firstName
    || 'Member';
  return {
    to: member.email || user?.email || member.workEmail,
    subject: 'Your OrianaaClub membership has been approved',
    template: 'membership-approved',
    data: {
      firstName,
      planName,
      memberId: member.memberNo || '',
    },
  };
}

async function sendApprovalEmails(approved, planName) {
  const failures = [];
  for (const member of approved) {
    try {
      const mail = await emailDetails(member, planName);
      if (!mail.to) throw new Error('No email address is available for the approved member.');
      await sendMail(mail);
    } catch (error) {
      console.error(`[membership-approval] Approval email failed for member ${member._id}: ${error.message}`);
      failures.push({ memberId: String(member._id), message: error.message });
    }
  }
  return failures;
}

export async function getMembershipApprovalQueue({ page = 1, limit = 20 } = {}, now = new Date()) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = { status: 'pending_approval', paymentConfirmedAt: { $ne: null } };
  const [items, total] = await Promise.all([
    Membership.find(filter)
      .sort({ approvalDueAt: 1, paymentConfirmedAt: 1, _id: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .populate('user', 'firstName email')
      .populate('plan')
      .lean(),
    Membership.countDocuments(filter),
  ]);
  const primaryIds = items.filter((membership) => membership.memberType === 'primary').map((membership) => membership._id);
  const nominees = primaryIds.length
    ? await FamilyMember.find({ membership: { $in: primaryIds }, isNominee: true, status: { $ne: 'removed' } })
      .select('membership nomineeRole emailConfirmedAt').lean()
    : [];
  const nomineesByPrimary = new Map();
  nominees.forEach((nominee) => {
    const key = String(nominee.membership);
    nomineesByPrimary.set(key, [...(nomineesByPrimary.get(key) || []), nominee]);
  });
  const profiles = items.length
    ? await Profile.find({ user: { $in: items.map((membership) => membership.user?._id).filter(Boolean) } })
      .select('user fullName').lean()
    : [];
  const profileByUser = new Map(profiles.map((profile) => [String(profile.user), profile]));
  return {
    items: items.map((membership) => ({
      ...membership,
      memberName: profileByUser.get(String(membership.user?._id))?.fullName || membership.user?.firstName || membership.user?.email || 'Member',
      memberCode: membership.memberNo || membership.memberCode || '',
      amountPaid: {
        baseAmount: membership.baseAmount || 0,
        gstAmount: membership.gstAmount || 0,
        totalPaid: membership.totalPaid || 0,
      },
      nomineesConfirmed: !(
        String(membership.tier || membership.plan?.slug || membership.plan?.name || '').toLowerCase().includes('corporate')
        && (nomineesByPrimary.get(String(membership._id)) || []).some((nominee) => !nominee.emailConfirmedAt)
      ),
      nomineeBlockReason: String(membership.tier || membership.plan?.slug || membership.plan?.name || '').toLowerCase().includes('corporate')
        && (nomineesByPrimary.get(String(membership._id)) || []).some((nominee) => !nominee.emailConfirmedAt)
        ? 'Nominee not confirmed'
        : '',
      overdue: Boolean(membership.approvalDueAt && membership.approvalDueAt <= now),
    })),
    pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
  };
}

export async function approveMembership(membershipId, adminId, now = new Date()) {
  const session = await mongoose.startSession();
  let membershipResult;
  let nomineesForEmail = [];
  let planName = 'Orianaa Club';
  try {
    await session.withTransaction(async () => {
      const membership = await Membership.findOne({
        _id: membershipId,
        status: 'pending_approval',
        paymentConfirmedAt: { $ne: null },
      }).session(session);
      if (!membership) throw new ApiError(409, 'A paid membership awaiting approval was not found.');
      const settings = await getSettings({ forceRefresh: true });
      const config = settings.familyMembership || DEFAULT_FAMILY_MEMBERSHIP_CONFIG;
      const tierInfo = await getTierAndName(membership, session);
      planName = tierInfo.planName;

      let primary = membership;
      if (membership.memberType !== 'primary' && membership.linkedTo) {
        primary = await Membership.findById(membership.linkedTo).session(session);
        if (!primary || primary.status !== 'active') {
          throw new ApiError(409, 'The linked primary membership must be active first.');
        }
      }

      const nominees = membership.memberType === 'primary'
        ? await FamilyMember.find({ membership: membership._id, isNominee: true, status: { $ne: 'removed' } })
          .session(session)
          .sort({ createdAt: 1, _id: 1 })
        : [];
      const tierSetting = config.tiers.find((item) => item.tier === tierInfo.tier);
      if (nominees.length && !tierSetting?.nomineesEnabled) {
        throw new ApiError(409, 'This membership tier does not allow nominees.');
      }
      if (nominees.length > (tierSetting?.maxNominees ?? 0)) {
        throw new ApiError(409, 'The nominee limit for this membership tier has been exceeded.');
      }

      const isCorporate = tierInfo.tier === 'corporate';
      const roles = nominees.map(nomineeRole);
      if (isCorporate && (
        roles.some((role) => !['GM', 'HR'].includes(role))
        || new Set(roles).size !== roles.length
      )) {
        throw new ApiError(409, 'Corporate nominees must have unique GM and HR roles.');
      }
      if (isCorporate && nominees.some((nominee) => !nominee.emailConfirmedAt)) {
        throw new ApiError(409, 'Every added Corporate nominee must confirm their email before approval.');
      }

      const confirmedNominees = nominees.filter((nominee) => nominee.emailConfirmedAt);
      if (isCorporate) {
        confirmedNominees.sort((left, right) => ['GM', 'HR'].indexOf(nomineeRole(left)) - ['GM', 'HR'].indexOf(nomineeRole(right)));
      }
      const takesNomineeSeq = config.nomineesTakeApprovalSeq;
      const sequences = takesNomineeSeq
        ? await assignSeqBatch(session, 1 + confirmedNominees.length)
        : [await assignApprovalSeq(session)];
      const primarySeq = sequences[0];
      membership.approvalSeq = primarySeq;
      membership.earlyBird = primarySeq <= config.earlyBirdLimit;
      membership.approvedAt = now;
      membership.approvedBy = adminId;
      membership.status = 'active';
      membership.approvalOverdueAt = null;
      membership.approvalOverdueNotifiedAt = null;
      membership.memberNo = await makeMemberNumber(session, membership, primary, nominees);
      if (membership.memberType === 'primary' || !membership.linkedTo) {
        membership.memberNo = String(primarySeq);
      }
      await membership.save({ session });
      const ledgerEntry = await creditPoints(session, membership, primarySeq);
      if (ledgerEntry) {
        membership.pointsGranted = ledgerEntry.points;
        membership.pointsBalance = ledgerEntry.points;
        membership.pointsExpireAt = ledgerEntry.expiresAt;
        membership.earlyBirdApplied = membership.earlyBird;
        await membership.save({ session });
      }

      if (membership.familyMember) {
        const familyMember = await FamilyMember.findOne({
          _id: membership.familyMember,
          membership: primary._id,
          status: 'pending_approval',
          isNominee: false,
        }).session(session);
        if (!familyMember) {
          throw new ApiError(409, 'The linked family profile is not awaiting approval.');
        }
        familyMember.status = 'active';
        familyMember.memberNo = membership.memberNo;
        familyMember.approvalSeq = primarySeq;
        familyMember.approvedAt = now;
        familyMember.approvedBy = adminId;
        familyMember.approvalDueAt = null;
        familyMember.approvalOverdueAt = null;
        familyMember.approvalOverdueNotifiedAt = null;
        await familyMember.save({ session });
        await AuditLog.create([{
          actorType: 'admin',
          actorId: adminId,
          admin: adminId,
          action: 'family.membership.approve',
          entityType: 'family_member',
          entityId: String(familyMember._id),
          memberNo: familyMember.memberNo,
          summary: 'Approved a paid family membership profile.',
          before: { status: 'pending_approval' },
          after: {
            status: 'active',
            approvalSeq: primarySeq,
            memberNo: familyMember.memberNo,
          },
        }], { session });
      }

      if (membership.memberType === 'primary') {
        let primaryFamilyMember = await FamilyMember.findOne({
          membership: membership._id,
          isPrimary: true,
        }).session(session);
        const createdPrimary = !primaryFamilyMember;
        if (!primaryFamilyMember) {
          const [profile, user] = await Promise.all([
            Profile.findOne({ user: membership.user }).session(session).lean(),
            User.findById(membership.user).session(session).select('firstName').lean(),
          ]);
          const primaryName = profile?.fullName || user?.firstName || 'Member';
          [primaryFamilyMember] = await FamilyMember.create([{
            membership: membership._id,
            linkedUser: membership.user,
            name: primaryName,
            fullName: primaryName,
            relation: 'Self',
            relationship: 'Self',
            memberType: 'primary',
            dateOfBirth: profile?.dob || null,
            dob: profile?.dob || null,
            type: 'adult',
            phone: profile?.mobile || '',
            photoUrl: profile?.photoUrl || '',
            memberNo: membership.memberNo,
            approvalSeq: primarySeq,
            approvedAt: now,
            approvedBy: adminId,
            isPrimary: true,
            addedBy: 'system',
            status: 'active',
          }], { session });
        } else {
          primaryFamilyMember.memberNo = membership.memberNo;
          primaryFamilyMember.approvalSeq = primarySeq;
          primaryFamilyMember.approvedAt = now;
          primaryFamilyMember.approvedBy = adminId;
          primaryFamilyMember.status = 'active';
          await primaryFamilyMember.save({ session });
        }
        await AuditLog.create([{
          actorType: 'admin',
          actorId: adminId,
          admin: adminId,
          action: createdPrimary ? 'family.primary.create' : 'family.primary.approve',
          entityType: 'family_member',
          entityId: String(primaryFamilyMember._id),
          memberNo: primaryFamilyMember.memberNo,
          summary: createdPrimary
            ? 'Created the primary family profile during membership approval.'
            : 'Synchronized the primary family profile during membership approval.',
          after: {
            membership: String(membership._id),
            memberNo: primaryFamilyMember.memberNo,
            approvalSeq: primaryFamilyMember.approvalSeq,
            isPrimary: true,
          },
        }], { session });
      }

      await AuditLog.create([{
        actorType: 'admin',
        actorId: adminId,
        admin: adminId,
        action: 'membership.approve',
        entityType: 'membership',
        entityId: String(membership._id),
        memberNo: membership.memberNo,
        summary: 'Approved a paid membership and credited its points ledger.',
        before: { status: 'pending_approval' },
        after: {
          status: membership.status,
          approvalSeq: primarySeq,
          memberNo: membership.memberNo,
          earlyBird: membership.earlyBird,
        },
      }], { session });

      const activatedNominees = [];
      for (const [index, nominee] of confirmedNominees.entries()) {
        const previousStatus = nominee.status;
        nominee.status = 'active';
        nominee.approvedAt = now;
        nominee.approvedBy = adminId;
        const addedOrder = nominees.findIndex((item) => item._id.toString() === nominee._id.toString()) + 1;
        nominee.memberNo = takesNomineeSeq
          ? `${membership.memberNo}${familySuffix(nominee, addedOrder)}`
          : '';
        if (takesNomineeSeq) nominee.approvalSeq = sequences[index + 1];
        await nominee.save({ session });
        activatedNominees.push(nominee);
        await AuditLog.create([{
          actorType: 'admin',
          actorId: adminId,
          admin: adminId,
          action: 'nominee.activate',
          entityType: 'family_member',
          entityId: String(nominee._id),
          memberNo: nominee.memberNo,
          summary: 'Activated a confirmed nominee during primary membership approval.',
          before: { status: previousStatus },
          after: { status: 'active', approvalSeq: nominee.approvalSeq, memberNo: nominee.memberNo },
        }], { session });
      }
      membershipResult = membership.toObject();
      nomineesForEmail = activatedNominees.map((nominee) => nominee.toObject());
    });
  } finally {
    await session.endSession();
  }

  const primaryWithUser = await Membership.findById(membershipResult._id)
    .populate('user', 'firstName email')
    .lean();
  const nomineeIds = nomineesForEmail.map((nominee) => nominee._id);
  const nomineeWithEmail = nomineeIds.length
    ? await FamilyMember.find({ _id: { $in: nomineeIds } }).lean()
    : [];
  const emailFailures = await sendApprovalEmails([primaryWithUser, ...nomineeWithEmail], planName);
  return {
    membership: primaryWithUser,
    nominees: nomineeWithEmail,
    emailFailures,
  };
}

export async function confirmNomineeEmail(nomineeId, confirmedAt = new Date()) {
  const session = await mongoose.startSession();
  let nomineeResult;
  let primary;
  let planName = 'Orianaa Club';
  let newlyActivated = false;
  try {
    await session.withTransaction(async () => {
      const nominee = await FamilyMember.findOne({
        _id: nomineeId,
        isNominee: true,
        status: { $ne: 'removed' },
      }).session(session);
      if (!nominee) throw new ApiError(404, 'Nominee was not found.');
      nominee.emailConfirmedAt ||= confirmedAt;
      primary = await Membership.findById(nominee.membership).session(session);
      if (!primary) throw new ApiError(404, 'The nominee primary membership was not found.');
      if (primary.status === 'active') {
        const settings = await getSettings({ forceRefresh: true });
        const config = settings.familyMembership || DEFAULT_FAMILY_MEMBERSHIP_CONFIG;
        const nominees = await FamilyMember.find({
          membership: primary._id,
          isNominee: true,
          status: { $ne: 'removed' },
        }).session(session).sort({ createdAt: 1, _id: 1 });
        const addedOrder = nominees.findIndex((item) => item._id.toString() === nominee._id.toString()) + 1;
        if (config.nomineesTakeApprovalSeq && nominee.approvalSeq == null) {
          const [sequence] = await assignSeqBatch(session, 1);
          nominee.approvalSeq = sequence;
          nominee.memberNo = `${primary.memberNo}${familySuffix(nominee, addedOrder)}`;
        }
        newlyActivated = nominee.status !== 'active' || !nominee.approvedAt;
        nominee.status = 'active';
        nominee.approvedAt ||= confirmedAt;
        await nominee.save({ session });
        const tierInfo = await getTierAndName(primary, session);
        planName = tierInfo.planName;
        if (newlyActivated) {
          await AuditLog.create([{
            actorType: 'system',
            action: 'nominee.activate',
            entityType: 'family_member',
            entityId: String(nominee._id),
            memberNo: nominee.memberNo,
            summary: 'Activated a nominee after email confirmation and primary approval.',
            after: {
              status: nominee.status,
              approvalSeq: nominee.approvalSeq,
              memberNo: nominee.memberNo,
            },
          }], { session });
        }
      } else {
        await nominee.save({ session });
      }
      nomineeResult = nominee.toObject();
    });
  } finally {
    await session.endSession();
  }

  if (newlyActivated && primary.status === 'active' && nomineeResult.status === 'active') {
    const failures = await sendApprovalEmails([nomineeResult], planName);
    if (failures.length) console.error(`[membership-approval] Nominee confirmation email failed for ${nomineeId}.`);
  }
  return nomineeResult;
}

export async function runApprovalOverdueJob(now = new Date()) {
  const due = await Membership.find({
    status: 'pending_approval',
    approvalDueAt: { $lte: now },
    $or: [{ approvalOverdueNotifiedAt: null }, { approvalOverdueNotifiedAt: { $exists: false } }],
  }).select('_id').lean();
  const admins = await User.find({
    role: 'admin',
    status: 'active',
    deletedAt: null,
    email: { $type: 'string', $ne: '' },
  }).select('email').lean();
  let notified = 0;
  let failed = 0;
  for (const { _id } of due) {
    const claimedAt = new Date();
    const membership = await Membership.findOneAndUpdate(
      {
        _id,
        status: 'pending_approval',
        approvalDueAt: { $lte: now },
        $or: [{ approvalOverdueNotifiedAt: null }, { approvalOverdueNotifiedAt: { $exists: false } }],
      },
      { $set: { approvalOverdueAt: claimedAt, approvalOverdueNotifiedAt: claimedAt } },
      { new: true },
    ).populate('user', 'firstName email').populate('plan');
    if (!membership) continue;
    if (!admins.length) {
      await Membership.updateOne({ _id, approvalOverdueNotifiedAt: claimedAt }, { $set: { approvalOverdueNotifiedAt: null } });
      failed += 1;
      console.error(`[membership-approval] No active admin email is configured for overdue membership ${_id}.`);
      continue;
    }
    try {
      const tier = membership.plan?.title || membership.plan?.name || 'Membership';
      await sendMail({
        to: admins.map((admin) => admin.email).join(', '),
        subject: 'Membership approval is overdue',
        template: 'approval-overdue',
        data: {
          firstName: membership.user?.firstName || 'Member',
          planName: tier,
          memberId: membership.memberNo || String(membership._id),
          approvalDueAt: membership.approvalDueAt?.toISOString() || '',
        },
      });
      notified += 1;
    } catch (error) {
      await Membership.updateOne(
        { _id, approvalOverdueNotifiedAt: claimedAt },
        { $set: { approvalOverdueNotifiedAt: null } },
      );
      failed += 1;
      console.error(`[membership-approval] Overdue notification failed for ${_id}: ${error.message}`);
    }
  }
  return { examined: due.length, notified, failed };
}

export async function expirePointsLedger(now = new Date()) {
  const result = await PointsLedger.updateMany(
    { status: 'active', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } },
  );
  return { expired: result.modifiedCount };
}
