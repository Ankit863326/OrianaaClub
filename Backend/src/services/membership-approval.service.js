import mongoose from 'mongoose';
import AuditLog from '../models/AuditLog.js';
import FamilyMember from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import MembershipDraft from '../models/MembershipDraft.js';
import MembershipPlan from '../models/MembershipPlan.js';
import Plan from '../models/Plan.js';
import Profile from '../models/Profile.js';
import PointsLedger from '../models/PointsLedger.js';
import { DEFAULT_FAMILY_MEMBERSHIP_CONFIG, getSettings } from '../models/Setting.js';
import User from '../models/User.js';
import ApiError from '../utils/ApiError.js';
import { assignApprovalSeq, assignSeqBatch } from './approval-sequence.service.js';
import { getNextMemberNumber } from './membership-id.service.js';
import { assignFamilyMemberId } from './member-code.service.js';
import { allocateMemberId } from './member-id.service.js';
import { getMembershipMemberCode } from '../utils/memberCode.js';
import { creditPoints } from './points-ledger.service.js';
import { sendMail } from './mail.service.js';

function nomineeRole(member) {
  return String(member.nomineeRole || '').trim().toUpperCase();
}

function addUtcYears(date, years) {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

async function hydrateApprovalMemberships(memberships) {
  const userIds = [...new Set(memberships
    .map((membership) => membership.user || membership.customer)
    .filter((id) => mongoose.isValidObjectId(id))
    .map(String))];
  const planReferences = [...new Map(memberships
    .filter((membership) => mongoose.isValidObjectId(membership.plan))
    .map((membership) => [
      `${membership.planModel || 'Plan'}:${membership.plan}`,
      { model: membership.planModel || 'Plan', id: String(membership.plan) },
    ])).values()];
  const [users, legacyPlans, membershipPlans] = await Promise.all([
    userIds.length
      ? User.find({ _id: { $in: userIds } }).select('firstName email').lean()
      : [],
    planReferences.some((item) => item.model === 'Plan')
      ? Plan.find({ _id: { $in: planReferences.filter((item) => item.model === 'Plan').map((item) => item.id) } }).lean()
      : [],
    planReferences.some((item) => item.model === 'MembershipPlan')
      ? MembershipPlan.find({ _id: { $in: planReferences.filter((item) => item.model === 'MembershipPlan').map((item) => item.id) } }).lean()
      : [],
  ]);
  const userById = new Map(users.map((user) => [String(user._id), user]));
  const planByReference = new Map([
    ...legacyPlans.map((plan) => [`Plan:${plan._id}`, plan]),
    ...membershipPlans.map((plan) => [`MembershipPlan:${plan._id}`, plan]),
  ]);
  return memberships.map((membership) => {
    const user = userById.get(String(membership.user || membership.customer)) || null;
    const plan = planByReference.get(`${membership.planModel || 'Plan'}:${membership.plan}`) || null;
    return {
      ...membership,
      user,
      plan,
      brokenReferences: [
        !user && 'member',
        !plan && 'plan',
      ].filter(Boolean),
    };
  });
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
      memberId: getMembershipMemberCode(member) || '',
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
      const reason = `${error?.name || 'Error'}:${error?.code || 'unknown'}`;
      console.error(`[membership-approval] Approval email failed for member ${member._id}: ${reason}`);
      try {
        await AuditLog.create({
          actorType: 'system',
          action: 'membership.approval_email.failed',
          entityType: 'membership',
          entityId: String(member._id),
          summary: 'Membership approval email could not be delivered.',
          reason,
        });
      } catch (auditError) {
        console.error(
          `[membership-approval] Could not audit approval email failure for member ${member._id}: `
          + `${auditError?.name || 'Error'}:${auditError?.code || 'unknown'}`,
        );
      }
      failures.push({ memberId: String(member._id), message: 'Approval email could not be sent.' });
    }
  }
  return failures;
}

export async function getMembershipApprovalQueue({ page = 1, limit = 20 } = {}, now = new Date()) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const filter = { status: 'pending_approval', paymentConfirmedAt: { $ne: null } };
  const [rawItems, total] = await Promise.all([
    Membership.find(filter)
      .sort({ approvalDueAt: 1, paymentConfirmedAt: 1, _id: 1 })
      .skip((safePage - 1) * safeLimit)
      .limit(safeLimit)
      .lean(),
    Membership.countDocuments(filter),
  ]);
  const items = await hydrateApprovalMemberships(rawItems);
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
      brokenReferences: [
        ...membership.brokenReferences,
        ...(membership.user && !profileByUser.has(String(membership.user._id)) ? ['profile'] : []),
      ].filter(Boolean),
      profile: profileByUser.get(String(membership.user?._id)) || null,
      memberName: profileByUser.get(String(membership.user?._id))?.fullName || membership.user?.firstName || membership.user?.email || 'Member',
      memberCode: getMembershipMemberCode(membership),
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
      if (String(membership.memberType || '').startsWith('nominee')) {
        membership.memberNo = '';
        membership.memberCode = '';
        membership.memberId = '';
      } else if (membership.memberType === 'primary' || !membership.linkedTo) {
        const memberNumber = await getNextMemberNumber(session);
        membership.memberNumber = String(memberNumber);
        const membershipExpireAt = addUtcYears(now, settings.membershipValidityYears);
        membership.memberId = await allocateMemberId({
          activatedAt: now,
          expiresAt: membershipExpireAt,
          session,
        });
        membership.memberCode = membership.memberId;
        membership.memberNo = membership.memberCode;
        membership.activatedAt = now;
        membership.startDate = now;
        membership.endDate = membershipExpireAt;
        membership.membershipExpireAt = membershipExpireAt;
      } else if (membership.familyMember) {
        const familyProfile = await FamilyMember.findOne({
          _id: membership.familyMember,
          membership: primary._id,
        }).session(session);
        if (!familyProfile) throw new ApiError(409, 'The linked family profile could not be found.');
        const primaryExpiry = primary.membershipExpireAt || primary.endDate
          || addUtcYears(primary.activatedAt || primary.startDate || now, settings.membershipValidityYears);
        membership.memberId = await assignFamilyMemberId(
          primary,
          familyProfile,
          now,
          primaryExpiry,
          session,
        );
        if (!membership.memberId) {
          throw new ApiError(409, 'A member ID could not be assigned to this family member.');
        }
        membership.memberNo = membership.memberId;
        membership.memberCode = membership.memberNo;
        membership.activatedAt = now;
        membership.startDate = now;
        membership.endDate = primaryExpiry;
        membership.membershipExpireAt = primaryExpiry;
      }
      await membership.save({ session });
      const activatedAccount = await User.updateOne({
        _id: membership.user,
        role: 'member',
        status: 'pending',
        activationRequiresMembershipPayment: true,
        passwordHash: { $exists: true },
      }, {
        $set: {
          status: 'active',
          activationRequiresMembershipPayment: false,
          activatedAt: now,
        },
      }, { session });
      if (activatedAccount.modifiedCount) {
        await MembershipDraft.updateMany(
          { user: membership.user, status: 'password_pending' },
          { $set: { status: 'active' } },
          { session },
        );
      }
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
        familyMember.memberId = membership.memberId;
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
            memberId: familyMember.memberId,
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
            memberId: membership.memberId,
            approvalSeq: primarySeq,
            approvedAt: now,
            approvedBy: adminId,
            isPrimary: true,
            addedBy: 'system',
            status: 'active',
          }], { session });
        } else {
          primaryFamilyMember.memberNo = membership.memberNo;
          primaryFamilyMember.memberId = membership.memberId;
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
            memberId: primaryFamilyMember.memberId,
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
        nominee.memberNo = '';
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
        if (config.nomineesTakeApprovalSeq && nominee.approvalSeq == null) {
          const [sequence] = await assignSeqBatch(session, 1);
          nominee.approvalSeq = sequence;
        }
        nominee.memberNo = '';
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
          memberId: String(membership._id),
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
