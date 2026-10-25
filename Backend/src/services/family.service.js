import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import FamilyMember, { deriveFamilyMemberType } from '../models/FamilyMember.js';
import Membership from '../models/Membership.js';
import Verification from '../models/Verification.js';
import User from '../models/User.js';
import { getSettings } from '../models/Setting.js';
import AuditLog from '../models/AuditLog.js';
import ApiError from '../utils/ApiError.js';
import { getBalance } from './points-ledger.service.js';
import { publicMediaDirectory } from '../utils/uploadDirectories.js';
import {
  invalidateVerificationAfterProfileChange,
  removeFamilyVerificationForNominee,
} from './family-verification.service.js';
import { validateFamilyProfileSet } from './family-profile-rules.service.js';


function groupFamily(members) {
  const visible = members.filter((member) => member.status !== 'removed');
  return {
    adults: visible.filter((member) => member.type === 'adult').map(publicFamilyMember),
    children: visible.filter((member) => member.type === 'child').map(publicFamilyMember),
  };
}

function publicFamilyMember(member) {
  const {
    idProofStorageKey,
    idProofMimeType,
    idProofOriginalName,
    idProof,
    ...safeMember
  } = member;
  return { ...safeMember, hasIdProof: Boolean(idProofStorageKey || idProof) };
}

async function ownedMembership(userId) {
  const membership = await Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
    status: 'active',
  }).populate('plan');
  if (!membership) throw new ApiError(404, 'Active membership was not found.');
  return membership;
}

async function writeAudit({ actorType, actorId, action, membershipId, entityId, before, after, reason = '' }) {
  return AuditLog.create({
    actorType,
    actorId,
    action,
    entityType: entityId ? 'family_member' : 'membership_family',
    entityId: String(entityId || membershipId),
    summary: action.replaceAll('.', ' '),
    before: before || null,
    after: after || null,
    reason,
  });
}

async function storePhoto(file) {
  if (!file) return '';
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype];
  if (!extension) throw new ApiError(400, 'Family photos must be JPG, PNG, or WebP.');
  await mkdir(publicMediaDirectory, { recursive: true, mode: 0o750 });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(join(publicMediaDirectory, filename), file.buffer, { flag: 'wx', mode: 0o640 });
  return `/media/${filename}`;
}

async function enforceFamilyCapacity(membership, values) {
  const settings = await getSettings({ forceRefresh: true });
  const profiles = await FamilyMember.find({
    membership: membership._id,
    status: { $ne: 'removed' },
    pendingAction: { $ne: 'remove' },
  }).lean();
  await validateFamilyProfileSet({
    plan: membership.plan,
    members: [...profiles, values],
    purchaseDate: new Date(),
  });
  return settings;
}

function familyValues(values, settings) {
  const normalized = {};
  const name = values.name ?? values.fullName;
  const relation = values.relation ?? values.relationship;
  const dateOfBirth = values.dateOfBirth ?? values.dob;
  if (name !== undefined) Object.assign(normalized, { name, fullName: name });
  if (relation !== undefined) Object.assign(normalized, { relation, relationship: relation });
  if (dateOfBirth !== undefined) {
    normalized.dateOfBirth = dateOfBirth || null;
    normalized.dob = dateOfBirth || null;
    normalized.type = dateOfBirth
      ? deriveFamilyMemberType(dateOfBirth, settings.familyMembership.childMaxAge)
      : 'adult';
  }
  if (values.phone !== undefined) normalized.phone = values.phone;
  if (values.email !== undefined) normalized.email = values.email.trim().toLowerCase();
  if (values.workEmail !== undefined) normalized.workEmail = values.workEmail.trim().toLowerCase();
  if (values.nomineeRole !== undefined) normalized.nomineeRole = values.nomineeRole;
  if (values.designation !== undefined) normalized.designation = values.designation;
  if (values.gender !== undefined) normalized.gender = values.gender;
  if (values.address !== undefined) normalized.address = values.address;
  if (values.parentSide !== undefined) normalized.parentSide = values.parentSide;
  return normalized;
}

export async function listOwnedFamily(userId) {
  const membership = await Membership.findOne({
    user: userId,
    memberType: 'primary',
    linkedTo: null,
    status: { $in: ['draft', 'profile_only', 'pending_payment', 'payment_pending', 'pending_verification', 'pending_approval', 'active', 'expired'] },
  }).sort({ createdAt: -1 });
  if (!membership) return { adults: [], children: [] };
  const members = await FamilyMember.find({
    membership: membership._id,
    isPrimary: { $ne: true },
  }).sort({ createdAt: 1 }).lean();
  const memberIds = members.map((member) => member._id);
  const [verifications, linkedMemberships] = await Promise.all([
    memberIds.length
      ? Verification.find({ memberId: { $in: memberIds } }).select('memberId status rejectionReason').lean()
      : [],
    memberIds.length
      ? Membership.find({ familyMember: { $in: memberIds } }).select('_id familyMember status memberNo').lean()
      : [],
  ]);
  const verificationByMember = new Map(verifications.map((item) => [String(item.memberId), item]));
  const membershipByMember = new Map(linkedMemberships.map((item) => [String(item.familyMember), item]));
  return groupFamily(await Promise.all(members.map(async (member) => {
    const verification = verificationByMember.get(String(member._id));
    const linkedMembership = membershipByMember.get(String(member._id));
    const isNominee = Boolean(member.isNominee || member.memberType?.startsWith('nominee'));
    const approved = !isNominee && linkedMembership?.status === 'active';
    const { idProofStorageKey, idProof, approvalSeq, approvalDueAt,
      approvalOverdueAt, approvalOverdueNotifiedAt, ...safeMember } = member;
    return {
      ...safeMember,
      memberNo: linkedMembership?.memberNo || member.memberNo || '',
      memberStatus: linkedMembership?.status || '',
      verificationStatus: isNominee
        ? (member.emailConfirmedAt ? 'verified' : 'not_added')
        : verification?.status || 'not_added',
      ...(approved ? { pointsBalance: await getBalance(linkedMembership._id) } : {}),
      hasIdProof: Boolean(idProofStorageKey || idProof),
    };
  })));
}

export async function requestAddFamilyMember(userId, values, photo) {
  const membership = await ownedMembership(userId);
  const normalized = familyValues(values, await getSettings());
  const settings = await enforceFamilyCapacity(membership, normalized);
  const photoUrl = await storePhoto(photo);
  const data = {
    membership: membership._id,
    ...familyValues(values, settings),
    photo: photoUrl,
    photoUrl,
    status: 'pending_approval',
    pendingAction: 'add',
    addedBy: 'member',
  };
  const member = await FamilyMember.create(data);
  await writeAudit({
    actorType: 'member', actorId: userId, action: 'family.add.request',
    membershipId: membership._id, entityId: member._id, after: member.toObject(),
  });
  return member;
}

export async function requestRemoveFamilyMember(userId, memberId) {
  const membership = await ownedMembership(userId);
  const member = await FamilyMember.findOne({ _id: memberId, membership: membership._id, status: 'active' });
  if (!member) throw new ApiError(404, 'Active family member was not found.');
  if (member.isPrimary) throw new ApiError(409, 'The primary member cannot be removed from the family.');
  if (member.isNominee || member.pendingAction === 'nominee') {
    throw new ApiError(409, 'Clear the nominee selection before requesting removal.');
  }
  if (member.pendingAction) throw new ApiError(409, 'This family member already has a pending request.');
  const before = member.toObject();
  member.pendingAction = 'remove';
  member.pendingChanges = null;
  await member.save();
  await writeAudit({
    actorType: 'member', actorId: userId, action: 'family.remove.request',
    membershipId: membership._id, entityId: member._id, before, after: member.toObject(),
  });
  return member;
}

export async function requestNominee(userId, familyMemberId) {
  const membership = await ownedMembership(userId);
  if (familyMemberId === null) {
    const currentNominee = membership.nominee
      ? await FamilyMember.findOne({ _id: membership.nominee, membership: membership._id, status: 'active' })
      : null;
    if (!currentNominee) throw new ApiError(409, 'There is no active nominee to clear.');
    if (currentNominee.pendingAction && currentNominee.pendingAction !== 'nominee') {
      throw new ApiError(409, 'The current nominee already has a pending request.');
    }
    const before = { nominee: membership.nominee, pendingNominee: membership.pendingNominee };
    currentNominee.pendingAction = 'nominee';
    await currentNominee.save();
    membership.pendingNominee = null;
    membership.pendingNomineeRemoval = true;
    await membership.save();
    await writeAudit({
      actorType: 'member', actorId: userId, action: 'family.nominee.removal.request',
      membershipId: membership._id, entityId: currentNominee._id, before,
      after: { pendingNomineeRemoval: true },
    });
    return { requested: true };
  }
  const nominee = await FamilyMember.findOne({
    _id: familyMemberId,
    membership: membership._id,
    status: 'active',
  });
  if (!nominee || nominee.type !== 'adult') {
    throw new ApiError(400, 'Nominee must be an active adult family member.');
  }
  if (!nominee.workEmail) throw new ApiError(400, 'A nominee work email is required.');
  if (nominee.pendingAction && nominee.pendingAction !== 'nominee') {
    throw new ApiError(409, 'This family member already has a pending request.');
  }
  if (membership.pendingNominee && String(membership.pendingNominee) !== String(nominee._id)) {
    await FamilyMember.updateOne(
      { _id: membership.pendingNominee, membership: membership._id, pendingAction: 'nominee' },
      { $set: { pendingAction: '' } },
    );
  }
  const before = { pendingNominee: membership.pendingNominee };
  membership.pendingNominee = nominee._id;
  membership.pendingNomineeRemoval = false;
  nominee.pendingAction = 'nominee';
  await nominee.save();
  await membership.save();
  await writeAudit({
    actorType: 'member', actorId: userId, action: 'family.nominee.request',
    membershipId: membership._id, entityId: nominee._id, before,
    after: { pendingNominee: nominee._id },
  });
  return { requested: true };
}

export async function adminListFamily(membershipId) {
  const membership = await Membership.findById(membershipId);
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  return groupFamily(await FamilyMember.find({ membership: membershipId }).sort({ createdAt: 1 }).lean());
}

export async function adminAddFamilyMember(adminId, membershipId, values, photo) {
  const membership = await Membership.findById(membershipId).populate('plan');
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const normalized = familyValues(values, await getSettings());
  const settings = await enforceFamilyCapacity(membership, normalized);
  const photoUrl = await storePhoto(photo);
  const member = await FamilyMember.create({
    membership: membershipId,
    ...familyValues(values, settings),
    photo: photoUrl,
    photoUrl,
    status: 'active',
    addedBy: 'admin',
    linkedUser: values.linkedUser || null,
  });
  await writeAudit({
    actorType: 'admin', actorId: adminId, action: 'family.add',
    membershipId, entityId: member._id, after: member.toObject(),
  });
  return member;
}

async function saveNominee(membership, member, adminId) {
  if (member && !member.workEmail) throw new ApiError(400, 'A nominee work email is required.');
  if (member) await removeFamilyVerificationForNominee(adminId, member._id);
  await FamilyMember.updateMany(
    { membership: membership._id, $or: [{ isNominee: true }, { pendingAction: 'nominee' }] },
    { $set: { isNominee: false, pendingAction: '' } },
  );
  if (member) await FamilyMember.updateOne({ _id: member._id }, { $set: { isNominee: true } });
  membership.nominee = member?._id || null;
  membership.pendingNominee = null;
  membership.pendingNomineeRemoval = false;
  await membership.save();
}

export async function setAdminNominee(adminId, membershipId, familyMemberId) {
  const membership = await Membership.findById(membershipId);
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const member = familyMemberId
    ? await FamilyMember.findOne({ _id: familyMemberId, membership: membershipId, status: 'active' })
    : null;
  if (familyMemberId && (!member || member.type !== 'adult')) {
    throw new ApiError(400, 'Nominee must be an active adult family member.');
  }
  const before = { nominee: membership.nominee };
  await saveNominee(membership, member, adminId);
  await writeAudit({
    actorType: 'admin', actorId: adminId, action: 'family.nominee.set',
    membershipId, entityId: member?._id || membershipId, before,
    after: { nominee: member?._id || null },
  });
  return membership;
}

export async function updateAdminFamilyMember(adminId, memberId, values, idProof) {
  const member = await FamilyMember.findById(memberId);
  if (!member || member.status === 'removed') throw new ApiError(404, 'Family member was not found.');
  const before = member.toObject();
  const settings = await getSettings();
  Object.assign(member, familyValues(values, settings));
  if (before.type === 'adult' && member.type === 'child' && member.status === 'active') {
    const adults = await FamilyMember.countDocuments({
      membership: member.membership,
      type: 'adult',
      status: 'active',
      _id: { $ne: member._id },
    });
    if (adults === 0) throw new ApiError(409, 'A membership must retain at least one active adult.');
  }
  if (values.linkedUser !== undefined) member.linkedUser = values.linkedUser || null;
  if (idProof) {
    const document = {
      storageKey: idProof.storageKey,
      mimeType: idProof.mimetype,
      originalName: idProof.publicName,
    };
    member.idProofStorageKey = document.storageKey;
    member.idProofMimeType = document.mimeType;
    member.idProofOriginalName = document.originalName;
    member.idProof = '';
  }
  if (member.type !== 'adult' || member.status !== 'active') {
    member.isNominee = false;
    await Membership.updateOne(
      { _id: member.membership, $or: [{ nominee: member._id }, { pendingNominee: member._id }] },
      { $set: { nominee: null, pendingNominee: null, pendingNomineeRemoval: false } },
    );
  }
  member.pendingAction = '';
  member.pendingChanges = null;
  member.status = 'active';
  member.approvedBy = adminId;
  await member.save();
  await invalidateVerificationAfterProfileChange(member, before, adminId, 'admin');
  await writeAudit({
    actorType: 'admin', actorId: adminId, action: 'family.update',
    membershipId: member.membership, entityId: member._id, before, after: member.toObject(),
  });
  return member;
}

export async function removeAdminFamilyMember(adminId, memberId, reason = '') {
  const member = await FamilyMember.findById(memberId);
  if (!member || member.status === 'removed') throw new ApiError(404, 'Family member was not found.');
  if (member.isPrimary) throw new ApiError(409, 'The primary member cannot be removed.');
  if (member.type === 'adult') {
    const adults = await FamilyMember.countDocuments({
      membership: member.membership, type: 'adult', status: 'active',
    });
    if (adults <= 1) throw new ApiError(409, 'A membership must retain at least one active adult.');
  }
  const before = member.toObject();
  member.status = 'removed';
  member.isNominee = false;
  member.pendingAction = '';
  member.pendingChanges = null;
  member.approvedBy = adminId;
  await member.save();
  await Membership.updateOne(
    { _id: member.membership, $or: [{ nominee: member._id }, { pendingNominee: member._id }] },
    { $set: { nominee: null, pendingNominee: null } },
  );
  await writeAudit({
    actorType: 'admin', actorId: adminId, action: 'family.remove',
    membershipId: member.membership, entityId: member._id, before, after: member.toObject(), reason,
  });
  return member;
}

export async function listFamilyRequests(query = {}) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const filter = { pendingAction: { $in: ['add', 'update', 'remove', 'nominee'] } };
  const [items, total] = await Promise.all([
    FamilyMember.find(filter).sort({ updatedAt: 1 }).skip((page - 1) * limit).limit(limit)
      .populate('membership', 'memberNumber memberCode user').lean(),
    FamilyMember.countDocuments(filter),
  ]);
  return { items, page, limit, total, pages: Math.ceil(total / limit) };
}

export async function decideFamilyRequest(adminId, memberId, approve, reason = '') {
  const member = await FamilyMember.findById(memberId);
  if (!member || !member.pendingAction) throw new ApiError(404, 'Pending family request was not found.');
  const membership = await Membership.findById(member.membership);
  if (!membership) throw new ApiError(404, 'Membership was not found.');
  const before = member.toObject();
  const action = member.pendingAction;
  if (approve) {
    if (action === 'add') {
      if (member.status !== 'pending_approval') throw new ApiError(409, 'The family request is no longer pending.');
      member.status = 'active';
    } else if (action === 'update') {
      Object.assign(member, member.pendingChanges || {});
      const settings = await getSettings();
      if (member.dateOfBirth) {
        member.type = deriveFamilyMemberType(member.dateOfBirth, settings.familyMembership.childMaxAge);
      }
      if (before.type === 'adult' && member.type === 'child' && member.status === 'active') {
        const adults = await FamilyMember.countDocuments({
          membership: member.membership,
          type: 'adult',
          status: 'active',
          _id: { $ne: member._id },
        });
        if (adults === 0) throw new ApiError(409, 'A membership must retain at least one active adult.');
      }
      if (member.type !== 'adult' || member.status !== 'active') {
        member.isNominee = false;
        membership.nominee = null;
        membership.pendingNominee = null;
        membership.pendingNomineeRemoval = false;
      }
    } else if (action === 'remove') {
      if (member.isPrimary) throw new ApiError(409, 'The primary member cannot be removed.');
      if (member.type === 'adult') {
        const adults = await FamilyMember.countDocuments({
          membership: member.membership, type: 'adult', status: 'active',
        });
        if (adults <= 1) throw new ApiError(409, 'A membership must retain at least one active adult.');
      }
      member.status = 'removed';
      if (member.isNominee) {
        member.isNominee = false;
        membership.nominee = null;
      }
    } else if (action === 'nominee') {
      if (
        !membership.pendingNomineeRemoval
        && String(membership.pendingNominee || '') !== String(member._id)
      ) {
        throw new ApiError(409, 'This nominee request has been superseded.');
      }
      if (membership.pendingNomineeRemoval) {
        await saveNominee(membership, null, adminId);
      } else if (member.status !== 'active' || member.type !== 'adult') {
        throw new ApiError(409, 'Nominee must be an active adult family member.');
      } else {
        await saveNominee(membership, member, adminId);
      }
    }
  } else if (action === 'add') {
    member.status = 'removed';
  } else if (action === 'nominee') {
    if (String(membership.pendingNominee || '') === String(member._id)) membership.pendingNominee = null;
    membership.pendingNomineeRemoval = false;
    await membership.save();
  }
  member.pendingAction = '';
  member.pendingChanges = null;
  member.approvedBy = adminId;
  await member.save();
  await writeAudit({
    actorType: 'admin', actorId: adminId,
    action: `family.request.${approve ? 'approve' : 'reject'}`,
    membershipId: member.membership, entityId: member._id,
    before, after: member.toObject(), reason,
  });
  return member;
}

export async function transferToNominee(adminId, membershipId, { reason, document }) {
  const membership = await Membership.findById(membershipId);
  if (!membership || !membership.nominee) throw new ApiError(409, 'Membership has no active nominee.');
  const nominee = await FamilyMember.findOne({
    _id: membership.nominee,
    membership: membershipId,
    status: 'active',
    type: 'adult',
  });
  if (!nominee) throw new ApiError(409, 'The selected nominee is not an active adult family member.');
  const linkedUser = nominee.linkedUser;
  if (!linkedUser) throw new ApiError(409, 'The nominee must be linked to an active member account before transfer.');
  const activeUser = await User.exists({
    _id: linkedUser,
    role: 'member',
    status: 'active',
    deletedAt: null,
  });
  if (!activeUser) throw new ApiError(409, 'The nominee must be linked to an active member account before transfer.');
  if (!reason?.trim() || !document?.storageKey) {
    throw new ApiError(400, 'A reason and supporting document are required for membership transfer.');
  }
  const before = membership.toObject();
  const updated = await Membership.findOneAndUpdate(
    { _id: membershipId, nominee: nominee._id, status: 'active' },
    {
      $set: {
        user: linkedUser,
        customer: linkedUser,
        transferDocument: {
          storageKey: document.storageKey,
          mimeType: document.mimetype,
          originalName: document.publicName,
        },
      },
    },
    { new: true, runValidators: true },
  );
  if (!updated) throw new ApiError(409, 'Membership changed before transfer could be completed.');
  await writeAudit({
    actorType: 'admin', actorId: adminId, action: 'membership.transfer_to_nominee',
    membershipId, before,
    after: {
      user: updated.user,
      pointsBalance: updated.pointsBalance,
      pointsExpireAt: updated.pointsExpireAt,
      membershipExpireAt: updated.membershipExpireAt,
      transferDocument: {
        storageKey: document.storageKey,
        mimeType: document.mimetype,
        originalName: document.publicName,
      },
    },
    reason,
  });
  return updated;
}

export async function getTransferDocument(membershipId) {
  const membership = await Membership.findById(membershipId).select('transferDocument');
  if (!membership?.transferDocument?.storageKey) {
    throw new ApiError(404, 'Membership transfer document was not found.');
  }
  return membership.transferDocument;
}

export async function getFamilyIdProof(familyMemberId) {
  const member = await FamilyMember.findById(familyMemberId).select(
    'idProofStorageKey idProofMimeType idProofOriginalName',
  );
  if (!member?.idProofStorageKey) throw new ApiError(404, 'Family ID proof was not found.');
  return {
    storageKey: member.idProofStorageKey,
    mimeType: member.idProofMimeType,
    originalName: member.idProofOriginalName,
  };
}

export { groupFamily };
