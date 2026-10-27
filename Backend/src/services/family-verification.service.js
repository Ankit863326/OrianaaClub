import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import ApiError from '../utils/ApiError.js';
import { getMembershipMemberCode, isMemberId } from '../utils/memberCode.js';
import AuditLog from '../models/AuditLog.js';
import FamilyMember from '../models/FamilyMember.js';
import IdentityVerification from '../models/IdentityVerification.js';
import Membership from '../models/Membership.js';
import Profile from '../models/Profile.js';
import User from '../models/User.js';
import Verification from '../models/Verification.js';
import VerificationEmailCode from '../models/VerificationEmailCode.js';
import VerificationEmailRateLimit from '../models/VerificationEmailRateLimit.js';
import VerificationDocumentAccess from '../models/VerificationDocumentAccess.js';
import { getSettings, DEFAULT_FAMILY_MEMBERSHIP_CONFIG } from '../models/Setting.js';
import { confirmNomineeEmail } from './membership-approval.service.js';
import { sendMail } from './mail.service.js';
import {
  decryptDocumentFile,
  encryptDocumentFile,
  hashIdentityValue,
} from '../utils/identityDocumentCrypto.js';
import { familyVerificationDirectory, familyVerificationDocumentPath } from '../utils/familyVerificationDocumentStorage.js';
import { validateIdentityNumber } from '../utils/identityDocumentValidation.js';
import { env } from '../config/env.js';

const CODE_TTL_MS = 10 * 60 * 1000;
const CODE_RESEND_MS = 30 * 1000;
const RATE_WINDOW_MS = 15 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;
const MAX_SENDS_PER_WINDOW = 5;
const DOCUMENT_URL_TTL_MS = 2 * 60 * 1000;

const relationAliases = new Map([
  ['wife', 'wife'], ['husband', 'husband'], ['spouse', 'wife'],
  ['son', 'child'], ['daughter', 'child'], ['child', 'child'],
  ['father', 'father'], ['mother', 'mother'],
]);

function normalizeRelation(value, gender = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'spouse') return gender === 'male' ? 'husband' : 'wife';
  return relationAliases.get(normalized) || '';
}

export async function removeFamilyVerificationForNominee(adminId, familyMemberId) {
  const record = await Verification.findOne({ memberId: familyMemberId });
  if (!record) return;
  await VerificationDocumentAccess.deleteMany({ verificationId: record._id });
  await removeStoredDocuments([record.fileRef, record.extraDocRef]);
  await AuditLog.create({
    actorType: 'admin',
    actorId: adminId,
    admin: adminId,
    action: 'family.verification.removed_for_nominee',
    entityType: 'family_verification',
    entityId: String(familyMemberId),
    summary: 'Family verification data removed when profile became a nominee.',
    reason: 'Nominees do not have identity verification documents.',
  });
  await Verification.deleteOne({ _id: record._id });
  await VerificationEmailCode.deleteOne({ memberId: familyMemberId });
}

function assertProfileRelation(member, relation) {
  const profileRelation = normalizeRelation(member.relation, member.gender);
  if (!profileRelation || profileRelation !== relation) {
    throw new ApiError(400, 'The verification relationship must match the family profile.');
  }
}

async function applyVerifiedRelation(member, relation, parentSide) {
  member.memberType = ['wife', 'husband'].includes(relation) ? 'spouse' : relation === 'child' ? 'child' : relation;
  if (['father', 'mother'].includes(relation)) {
    const selectedSide = parentSide || member.parentSide;
    if (!selectedSide) throw new ApiError(400, 'Choose whether this parent is on the member or spouse side.');
    member.parentSide = selectedSide;
  }
  await member.save();
}

function maskAadhaar(last4) {
  return /^\d{4}$/.test(last4 || '') ? `XXXX-XXXX-${last4}` : '';
}

function safeMemberVerification(record) {
  if (!record) {
    return {
      status: 'not_added',
      relation: null,
      emailConfirmed: false,
      codeSentTo: null,
      docType: null,
      extraDocType: '',
      parentSide: null,
      nameOnDocument: '',
      relationLine: '',
      applicantAddress: '',
      rejectionReason: '',
      aadhaar: '',
    };
  }
  return {
    status: record.status,
    relation: record.relation,
    emailConfirmed: Boolean(record.emailConfirmedAt),
    codeSentTo: record.codeSentTo,
    docType: record.docType,
    extraDocType: record.extraDocType || '',
    parentSide: record.parentSide || null,
    nameOnDocument: record.nameOnDocument || '',
    relationLine: record.relationLine || '',
    applicantAddress: record.applicantAddress || '',
    rejectionReason: record.status === 'rejected' ? record.rejectionReason : '',
    aadhaar: maskAadhaar(record.aadhaarLast4),
  };
}

async function ownedFamilyMember(userId, familyMemberId) {
  const member = await FamilyMember.findById(familyMemberId);
  if (!member || member.status === 'removed') throw new ApiError(404, 'Family member was not found.');
  if (member.isPrimary) throw new ApiError(400, 'Primary members do not use family verification.');
  const membership = await Membership.findOne({ _id: member.membership, user: userId });
  if (!membership) throw new ApiError(404, 'Family member was not found.');
  return { member, membership };
}

async function primaryContact(membership) {
  const [user, profile] = await Promise.all([
    User.findById(membership.user).select('firstName email').lean(),
    Profile.findOne({ user: membership.user }).lean(),
  ]);
  return { user, profile };
}

async function appendAudit(record, { actorId = null, actorType, action, reason = '', ip = '' }) {
  const entry = {
    status: record.status,
    action,
    reason,
    ip: String(ip || '').slice(0, 100),
    reviewedBy: actorType === 'admin' ? actorId : null,
    actorId,
    actorType,
    at: new Date(),
  };
  record.auditLog.push(entry);
  await record.save();
  const familyMember = await FamilyMember.findById(record.memberId)
    .select('name fullName memberNo memberId membership isNominee memberType')
    .lean();
  const membership = familyMember?.membership
    ? await Membership.findById(familyMember.membership)
      .select('memberNo memberCode memberId memberNumber legacyMemberCode')
      .lean()
    : null;
  const memberNo = familyMember?.isNominee || String(familyMember?.memberType || '').startsWith('nominee')
    ? ''
    : isMemberId(familyMember?.memberId || familyMember?.memberNo)
      ? familyMember.memberId || familyMember.memberNo
      : getMembershipMemberCode(membership);
  await AuditLog.create({
    actorType,
    actorId,
    admin: actorType === 'admin' ? actorId : null,
    action: `family.verification.${action}`,
    entityType: 'family_verification',
    entityId: String(record.memberId),
    memberNo,
    summary: `Family verification ${action.replaceAll('.', ' ')} for ${familyMember?.name || familyMember?.fullName || 'family member'} (${memberNo || 'primary membership'}).`,
    after: { status: record.status, memberNo },
    reason,
    ip: String(ip || '').slice(0, 100),
  });
}

async function appendMemberAudit(member, { actorId, action, reason = '' }) {
  const record = await Verification.findOne({ memberId: member._id });
  if (record) {
    await appendAudit(record, { actorId, actorType: 'member', action, reason });
  } else {
    await AuditLog.create({
      actorType: 'member',
      actorId,
      action: `family.verification.${action}`,
      entityType: 'family_member',
      entityId: String(member._id),
      summary: `Family verification ${action.replaceAll('.', ' ')}.`,
      reason,
    });
  }
}

export async function invalidateVerificationAfterProfileChange(member, before, actorId, actorType) {
  const relevantFields = [
    'name', 'fullName', 'relation', 'relationship', 'dateOfBirth', 'dob',
    'gender', 'address', 'parentSide', 'memberType', 'email', 'workEmail',
  ];
  const changedFields = relevantFields.filter((field) => (
    String(before?.[field] ?? '') !== String(member[field] ?? '')
  ));
  if (changedFields.length === 0) return;
  if (changedFields.includes('email') || changedFields.includes('workEmail')) {
    member.emailConfirmedAt = null;
    await member.save();
  }
  const verification = await Verification.findOne({ memberId: member._id });
  if (!verification) return;
  const invalidated = ['pending', 'verified'].includes(verification.status);
  const reason = invalidated ? 'Family profile details changed; submit documents again.' : '';
  if (changedFields.includes('email') || changedFields.includes('workEmail')) {
    verification.emailConfirmedAt = null;
  }
  if (invalidated) {
    verification.status = 'rejected';
    verification.rejectionReason = reason;
    verification.reviewedBy = actorType === 'admin' ? actorId : null;
    verification.reviewedAt = new Date();
  }
  verification.auditLog.push({
    status: verification.status,
    action: 'profile.changed',
    reason,
    actorId,
    actorType,
    reviewedBy: actorType === 'admin' ? actorId : null,
    at: new Date(),
  });
  await verification.save();
  await AuditLog.create({
    actorType,
    actorId,
    admin: actorType === 'admin' ? actorId : null,
    action: 'family.verification.profile.changed',
    entityType: 'family_verification',
    entityId: String(member._id),
    summary: 'Family profile changed; verification requires a new review.',
    reason,
  });
}

async function allowRate(key, now) {
  const keyHash = hashIdentityValue(key);
  const cutoff = new Date(now.getTime() - RATE_WINDOW_MS);
  let bucket = await VerificationEmailRateLimit.findOneAndUpdate(
    { keyHash, windowStartedAt: { $gt: cutoff } },
    { $inc: { count: 1 }, $set: { expiresAt: new Date(now.getTime() + RATE_WINDOW_MS) } },
    { new: true },
  );
  if (!bucket) {
    try {
      bucket = await VerificationEmailRateLimit.findOneAndUpdate(
        { keyHash, windowStartedAt: { $lte: cutoff } },
        {
          $set: { count: 1, windowStartedAt: now, expiresAt: new Date(now.getTime() + RATE_WINDOW_MS) },
        },
        { new: true },
      );
      if (!bucket) {
        bucket = await VerificationEmailRateLimit.create({
          keyHash,
          count: 1,
          windowStartedAt: now,
          expiresAt: new Date(now.getTime() + RATE_WINDOW_MS),
        });
      }
    } catch (error) {
      if (error.code !== 11000) throw error;
      bucket = await VerificationEmailRateLimit.findOneAndUpdate(
        { keyHash, windowStartedAt: { $gt: cutoff } },
        { $inc: { count: 1 } },
        { new: true },
      );
    }
  }
  if (bucket.count > MAX_SENDS_PER_WINDOW) {
    throw new ApiError(429, 'Too many verification codes were requested. Please try again later.');
  }
}

async function codeDestination(member, membership) {
  if (member.isNominee) {
    const email = String(member.workEmail || '').trim().toLowerCase();
    if (!email) throw new ApiError(400, 'A nominee work email is required.');
    return { email, codeSentTo: 'own', firstName: member.name?.split(/\s+/)[0] || 'Member' };
  }
  const { user } = await primaryContact(membership);
  if (!user?.email) throw new ApiError(409, 'The primary member email address is not available.');
  const relation = normalizeRelation(member.relation, member.gender);
  const dob = member.dob || member.dateOfBirth;
  const isMinorChild = relation === 'child' && dob && ageOn(dob, new Date()) < 18;
  const isParentWithoutEmail = ['father', 'mother'].includes(relation) && !member.email;
  if (isMinorChild || isParentWithoutEmail) {
    return { email: user.email, codeSentTo: 'primary', firstName: user.firstName || 'Member' };
  }
  const email = String(member.email || '').trim().toLowerCase();
  if (!email) throw new ApiError(400, 'Add the family member’s email address before sending a code.');
  return { email, codeSentTo: 'own', firstName: member.name?.split(/\s+/)[0] || 'Member' };
}

export async function sendFamilyVerificationCode(userId, familyMemberId, ipAddress = '', now = new Date()) {
  const { member, membership } = await ownedFamilyMember(userId, familyMemberId);
  const destination = await codeDestination(member, membership);
  let verification = await Verification.findOne({ memberId: member._id });
  if (!member.isNominee && !verification) {
    verification = await Verification.create({ memberId: member._id, status: 'not_added' });
  }
  const previous = await VerificationEmailCode.findOne({ memberId: member._id });
  if (previous && now.getTime() - previous.sentAt.getTime() < CODE_RESEND_MS) {
    throw new ApiError(429, 'Please wait 30 seconds before requesting another code.');
  }
  await allowRate(`verification-member:${member._id}`, now);
  await allowRate(`verification-ip:${ipAddress || 'unknown'}`, now);
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const codeHash = hashIdentityValue(`family-verification:${member._id}:${code}`);
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS);
  const withinSendWindow = previous
    && now.getTime() - previous.windowStartedAt.getTime() < RATE_WINDOW_MS;
  try {
    await VerificationEmailCode.findOneAndUpdate(
      {
        memberId: member._id,
        $or: [
          { sentAt: { $lte: new Date(now.getTime() - CODE_RESEND_MS) } },
          { sentAt: { $exists: false } },
        ],
      },
      {
        $set: {
          codeHash,
          recipientHash: hashIdentityValue(`verification-email:${destination.email}`),
          ipHash: hashIdentityValue(ipAddress || 'unknown'),
          sentAt: now,
          expiresAt,
          attempts: 0,
          sendCount: withinSendWindow ? previous.sendCount + 1 : 1,
          windowStartedAt: withinSendWindow ? previous.windowStartedAt : now,
          verifiedAt: null,
        },
        $setOnInsert: { memberId: member._id },
      },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
    );
  } catch (error) {
    if (error.code === 11000) throw new ApiError(429, 'Please wait 30 seconds before requesting another code.');
    throw error;
  }
  if (verification) {
    verification.codeSentTo = destination.codeSentTo;
    await appendAudit(verification, {
      actorId: userId,
      actorType: 'member',
      action: 'code.sent',
      ip: ipAddress,
    });
  } else {
    await appendMemberAudit(member, { actorId: userId, action: 'nominee.code.sent' });
  }
  await sendMail({
    to: destination.email,
    subject: member.isNominee ? 'Confirm your OrianaaClub nominee email' : 'Confirm your family membership email',
    template: member.isNominee ? 'nominee-confirmation-code' : 'family-verification-code',
    data: { firstName: destination.firstName, code },
  });
  return { sent: true, codeSentTo: destination.codeSentTo };
}

function ageOn(dateOfBirth, date) {
  const dob = new Date(dateOfBirth);
  let age = date.getUTCFullYear() - dob.getUTCFullYear();
  if (date.getUTCMonth() < dob.getUTCMonth()
    || (date.getUTCMonth() === dob.getUTCMonth() && date.getUTCDate() < dob.getUTCDate())) age -= 1;
  return age;
}

export async function confirmFamilyVerificationCode(userId, familyMemberId, code, now = new Date()) {
  const { member, membership } = await ownedFamilyMember(userId, familyMemberId);
  const destination = await codeDestination(member, membership);
  const record = await VerificationEmailCode.findOne({
    memberId: member._id,
    expiresAt: { $gt: now },
    verifiedAt: null,
    attempts: { $lt: MAX_CODE_ATTEMPTS },
  }).select('+codeHash +recipientHash');
  if (!record) throw new ApiError(400, 'The code is invalid, expired, or has reached its attempt limit.');
  const attempted = await VerificationEmailCode.findOneAndUpdate(
    { _id: record._id, verifiedAt: null, expiresAt: { $gt: now }, attempts: { $lt: MAX_CODE_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { new: true },
  ).select('+codeHash +recipientHash');
  if (!attempted) throw new ApiError(400, 'The code is invalid, expired, or has reached its attempt limit.');
  const providedHash = hashIdentityValue(`family-verification:${member._id}:${code}`);
  const recipientHash = hashIdentityValue(`verification-email:${destination.email}`);
  if (
    attempted.recipientHash !== recipientHash
    || !timingSafeEqual(Buffer.from(attempted.codeHash, 'hex'), Buffer.from(providedHash, 'hex'))
  ) {
    throw new ApiError(400, 'The code is incorrect.');
  }
  const consumed = await VerificationEmailCode.findOneAndUpdate(
    { _id: attempted._id, verifiedAt: null, expiresAt: { $gt: now } },
    { $set: { verifiedAt: now } },
    { new: true },
  );
  if (!consumed) throw new ApiError(400, 'This code has already been used.');

  if (member.isNominee) {
    await confirmNomineeEmail(member._id, now);
    await appendMemberAudit(member, { actorId: userId, action: 'nominee.email.confirmed' });
    return { emailConfirmed: true, nominee: true };
  }
  const verification = await Verification.findOneAndUpdate(
    { memberId: member._id },
    { $set: { emailConfirmedAt: now } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  member.emailConfirmedAt = now;
  await member.save();
  await appendAudit(verification, { actorId: userId, actorType: 'member', action: 'email.confirmed' });
  return { emailConfirmed: true, nominee: false };
}

export function calculateVerificationDueAt(start, days = 1) {
  const dueAt = new Date(start);
  let added = 0;
  while (added < days) {
    dueAt.setUTCDate(dueAt.getUTCDate() + 1);
    if (dueAt.getUTCDay() !== 0 && dueAt.getUTCDay() !== 6) added += 1;
  }
  return dueAt;
}

export async function saveFamilyVerificationDraft(userId, familyMemberId, values) {
  const { member } = await ownedFamilyMember(userId, familyMemberId);
  if (member.isNominee) throw new ApiError(400, 'Nominees do not need document verification.');
  const existing = await Verification.findOne({ memberId: member._id });
  if (existing && !['not_added', 'rejected'].includes(existing.status)) {
    throw new ApiError(409, 'A submitted or verified family profile cannot be edited as a draft.');
  }
  const relation = normalizeRelation(values.relation);
  if (!relation) throw new ApiError(400, 'Choose wife, husband, son, daughter, father, or mother.');
  assertProfileRelation(member, relation);
  await applyVerifiedRelation(member, relation, values.parentSide);
  const record = await Verification.findOneAndUpdate(
    { memberId: member._id, status: { $in: ['not_added', 'rejected'] } },
    {
      $set: {
        relation,
        docType: values.docType,
        extraDocType: values.extraDocType || '',
        nameOnDocument: values.nameOnDocument || '',
        relationLine: values.relationLine || '',
        applicantAddress: values.applicantAddress || '',
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  await appendAudit(record, { actorId: userId, actorType: 'member', action: 'draft.saved' });
  return safeMemberVerification(record);
}

async function storeEncryptedDocument(file) {
  await mkdir(familyVerificationDirectory, { recursive: true, mode: 0o700 });
  const storageKey = `${randomBytes(16).toString('hex').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')}.enc`;
  await writeFile(
    familyVerificationDocumentPath(storageKey),
    encryptDocumentFile(file.buffer),
    { flag: 'wx', mode: 0o600 },
  );
  return storageKey;
}

async function removeStoredDocuments(storageKeys) {
  await Promise.all(storageKeys.filter(Boolean).map(async (storageKey) => {
    try {
      await unlink(familyVerificationDocumentPath(storageKey));
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }));
}

export async function submitFamilyVerificationDocuments(
  userId,
  familyMemberId,
  values,
  uploads,
  now = new Date(),
) {
  const { member, membership } = await ownedFamilyMember(userId, familyMemberId);
  if (member.isNominee) throw new ApiError(400, 'Nominees do not submit identity documents.');
  const previous = await Verification.findOne({ memberId: member._id });
  if (!previous?.emailConfirmedAt) throw new ApiError(409, 'Confirm the family member email before uploading documents.');
  if (!['not_added', 'rejected'].includes(previous.status)) {
    throw new ApiError(409, 'This verification is already submitted or verified.');
  }
  const relation = normalizeRelation(values.relation || previous.relation);
  if (!relation) throw new ApiError(400, 'Choose a valid family relationship.');
  assertProfileRelation(member, relation);
  const needsExtraDocument = relation === 'husband' || relation === 'mother';
  if (needsExtraDocument && !uploads.extraDocument) {
    throw new ApiError(400, relation === 'husband'
      ? 'A marriage certificate is required for a husband verification.'
      : 'A birth certificate or family card listing the mother is required.');
  }
  if (relation === 'husband' && values.extraDocType !== 'marriage_certificate') {
    throw new ApiError(400, 'The husband extra document must be a marriage certificate.');
  }
  if (relation === 'mother' && !['birth_certificate', 'family_card'].includes(values.extraDocType)) {
    throw new ApiError(400, 'The mother extra document must be a birth certificate or family card.');
  }
  // Indian Aadhaar rules restrict storage and display; prefer DigiLocker/offline e-KYC and obtain legal review.
  const aadhaar = validateIdentityNumber('aadhaar', values.aadhaarNumber);
  if (!aadhaar) throw new ApiError(400, 'Enter a valid Aadhaar number for duplicate checking.');
  const aadhaarHash = hashIdentityValue(aadhaar.value);
  const duplicate = await Verification.findOne({
    memberId: { $ne: member._id },
    aadhaarHash,
  }).select('+aadhaarHash').lean();
  const duplicatePrimary = await IdentityVerification.findOne({ aadhaarHash }).select('_id').lean();
  if (duplicate || duplicatePrimary) {
    throw new ApiError(409, 'This Aadhaar identity is already associated with another member.');
  }
  await applyVerifiedRelation(member, relation, values.parentSide);

  const config = (await getSettings()).familyMembership || DEFAULT_FAMILY_MEMBERSHIP_CONFIG;
  const oldRefs = [previous.fileRef, previous.extraDocRef];
  const newRefs = [];
  try {
    const fileRef = await storeEncryptedDocument(uploads.document);
    newRefs.push(fileRef);
    const extraDocRef = uploads.extraDocument ? await storeEncryptedDocument(uploads.extraDocument) : '';
    if (extraDocRef) newRefs.push(extraDocRef);
    previous.relation = relation;
    previous.docType = values.docType;
    previous.extraDocType = values.extraDocType || '';
    previous.aadhaarLast4 = aadhaar.last4;
    previous.aadhaarHash = aadhaarHash;
    previous.nameOnDocument = values.nameOnDocument || previous.nameOnDocument;
    previous.relationLine = values.relationLine || previous.relationLine;
    previous.applicantAddress = values.applicantAddress || previous.applicantAddress;
    previous.fileRef = fileRef;
    previous.extraDocRef = extraDocRef;
    previous.fileMimeType = uploads.document.mimetype;
    previous.extraDocMimeType = uploads.extraDocument?.mimetype || '';
    previous.status = 'pending';
    previous.rejectionReason = '';
    previous.submittedAt = now;
    previous.dueAt = calculateVerificationDueAt(now, config.reviewTargets.verificationWorkingDays);
    previous.overdueAt = null;
    previous.overdueNotifiedAt = null;
    previous.reviewedBy = null;
    previous.reviewedAt = null;
    previous.auditLog.push({
      status: 'pending',
      action: 'documents.submitted',
      reviewedBy: null,
      actorId: userId,
      actorType: 'member',
      at: now,
    });
    await previous.save();
  } catch (error) {
    await removeStoredDocuments(newRefs);
    if (error.code === 11000) throw new ApiError(409, 'This Aadhaar identity is already associated with another family member.');
    throw error;
  }
  await removeStoredDocuments(oldRefs.filter((key) => !newRefs.includes(key)));
  await AuditLog.create({
    actorType: 'member',
    actorId: userId,
    action: 'family.verification.documents.submitted',
    entityType: 'family_verification',
    entityId: String(member._id),
    summary: 'Family verification documents submitted.',
  });
  const { user } = await primaryContact(membership);
  await sendMail({
    to: member.email || user?.email,
    subject: 'Your family verification documents were received',
    template: 'family-verification-submitted',
    data: {
      firstName: member.name?.split(/\s+/)[0] || user?.firstName || 'Member',
      reviewTarget: config.reviewTargets.verificationWorkingDays === 1
        ? 'one working day'
        : `${config.reviewTargets.verificationWorkingDays} working days`,
    },
  });
  return safeMemberVerification(previous);
}

export async function getFamilyVerificationStatus(userId, familyMemberId) {
  const { member } = await ownedFamilyMember(userId, familyMemberId);
  const now = new Date();
  const codeRecord = await VerificationEmailCode.findOne({
    memberId: member._id,
    expiresAt: { $gt: now },
    verifiedAt: null,
  }).select('attempts sentAt').lean();
  const codeStatus = {
    codeSent: Boolean(codeRecord),
    remainingAttempts: codeRecord ? Math.max(0, MAX_CODE_ATTEMPTS - codeRecord.attempts) : MAX_CODE_ATTEMPTS,
    resendAfterSeconds: codeRecord
      ? Math.max(0, Math.ceil((codeRecord.sentAt.getTime() + CODE_RESEND_MS - now.getTime()) / 1000))
      : 0,
  };
  if (member.isNominee) {
    return {
      nominee: true,
      emailConfirmed: Boolean(member.emailConfirmedAt),
      codeSentTo: 'own',
      nonRefundableNotice: false,
      verification: null,
      ...codeStatus,
    };
  }
  const verification = await Verification.findOne({ memberId: member._id }).select('+aadhaarLast4').lean();
  return {
    nominee: false,
    nonRefundableNotice: true,
    emailConfirmed: Boolean(verification?.emailConfirmedAt),
    codeSentTo: verification?.codeSentTo || null,
    verification: safeMemberVerification(verification),
    ...codeStatus,
  };
}

function check(status, detail = '') {
  return { status, detail };
}

function relationMarker(relation, member) {
  if (relation === 'wife') return ['W/O'];
  if (relation === 'husband') return ['H/O'];
  if (relation === 'child') {
    if (member.gender === 'male') return ['S/O'];
    if (member.gender === 'female') return ['D/O'];
    return ['S/O', 'D/O'];
  }
  return [];
}

function normalizedName(value) {
  return String(value || '').normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase();
}

async function verificationChecks(member, verification, membership, profile, primaryIdentity) {
  const relation = verification?.relation;
  const primaryName = profile?.fullName || '';
  const checkName = verification?.nameOnDocument
    ? normalizedName(verification.nameOnDocument) === normalizedName(member.name)
      ? check('ok', 'Document name matches the family profile.')
      : check('fail', 'Document name does not match the family profile.')
    : check('warning', 'Document name must be compared by the reviewer.');
  const markers = relationMarker(relation, member);
  const relationText = String(verification?.relationLine || '').toUpperCase();
  const relationResult = markers.length && primaryName
    ? markers.some((marker) => relationText.includes(marker) && normalizedName(relationText).includes(normalizedName(primaryName)))
      ? check('ok', 'Relation line matches the primary member.')
      : check('fail', 'Relation line does not match the primary member.')
    : check('warning', 'The primary name or a supported relation-line marker is not available.');
  const primaryAddress = profile?.address || membership.address || '';
  const addressResult = primaryAddress && verification?.applicantAddress
    ? normalizedName(primaryAddress) === normalizedName(verification.applicantAddress)
      ? check('ok', 'Applicant address matches the primary profile.')
      : check('fail', 'Applicant address does not match the primary profile.')
    : check('warning', 'A primary address is not available for comparison.');
  let aadhaarResult = check('warning', 'No Aadhaar hash is available.');
  if (verification?.aadhaarHash) {
    const [duplicateFamily, duplicatePrimary] = await Promise.all([
      Verification.findOne({
        memberId: { $ne: member._id },
        aadhaarHash: verification.aadhaarHash,
      }).select('_id').lean(),
      IdentityVerification.findOne({ aadhaarHash: verification.aadhaarHash }).select('_id').lean(),
    ]);
    aadhaarResult = duplicateFamily || duplicatePrimary
      ? check('fail', 'The Aadhaar hash is associated with another member.')
      : check('ok', 'The Aadhaar hash is unique.');
  }
  const childAge = relation === 'child' && (member.dob || member.dateOfBirth)
    ? ageOn(member.dob || member.dateOfBirth, new Date())
    : null;
  return {
    contactConfirmed: verification?.emailConfirmedAt
      ? check('ok', 'Contact email is confirmed.')
      : check('fail', 'Contact email is not confirmed.'),
    nameMatchesProfile: checkName,
    relationLineMatchesPrimary: relationResult,
    addressMatches: addressResult,
    childAge: relation === 'child' && childAge !== null
      ? childAge <= 18
        ? check('ok', 'Child is 18 or under.')
        : check('fail', 'Child is older than 18.')
      : relation === 'child'
        ? check('fail', 'The child date of birth is not available.')
      : check('warning', 'Not applicable to this relation.'),
    aadhaarHashUnique: aadhaarResult,
    extraDocumentPresent: relation === 'husband' || relation === 'mother'
      ? verification.extraDocRef
        ? check('ok', 'Required extra document is present.')
        : check('fail', 'The required extra document is missing.')
      : check('warning', 'No extra document is required for this relation.'),
    nomineeEmailConfirmed: member.isNominee
      ? member.emailConfirmedAt
        ? check('ok', 'Nominee email is confirmed.')
        : check('fail', 'Nominee email is not confirmed.')
      : check('warning', 'Not applicable to a family verification.'),
    applicantAadhaar: maskAadhaar(verification?.aadhaarLast4),
    primaryAadhaar: maskAadhaar(primaryIdentity?.aadhaarLast4),
  };
}

async function adminFamilyContext(familyMemberId) {
  const member = await FamilyMember.findById(familyMemberId);
  if (!member || member.status === 'removed') throw new ApiError(404, 'Family member was not found.');
  const membership = await Membership.findById(member.membership).lean();
  if (!membership) throw new ApiError(404, 'Primary membership was not found.');
  const verification = await Verification.findOne({ memberId: member._id }).select('+aadhaarHash +aadhaarLast4');
  const { profile } = await primaryContact(membership);
  const primaryIdentity = await IdentityVerification.findOne({ user: membership.user }).select('+aadhaarLast4').lean();
  return { member, membership, verification, profile, primaryIdentity };
}

export async function getAdminFamilyVerificationQueue(now = new Date()) {
  const records = await Verification.find({ status: 'pending' }).sort({ dueAt: 1, submittedAt: 1 }).lean();
  const familyMembers = await FamilyMember.find({
    _id: { $in: records.map((item) => item.memberId) },
  }).select('_id membership name fullName relation relationship').lean();
  const primaryIds = [...new Set(familyMembers.map((member) => String(member.membership)))];
  const primaries = primaryIds.length
    ? await Membership.find({ _id: { $in: primaryIds } })
      .select('_id memberNo memberCode memberNumber legacyMemberCode')
      .lean()
    : [];
  const primaryById = new Map(primaries.map((membership) => [String(membership._id), membership]));
  const byId = new Map(familyMembers.map((member) => [String(member._id), member]));
  return records.map((record) => ({
    memberId: record.memberId,
    memberName: byId.get(String(record.memberId))?.name || byId.get(String(record.memberId))?.fullName || '',
    relation: record.relation || byId.get(String(record.memberId))?.relation || byId.get(String(record.memberId))?.relationship || '',
    membershipId: String(byId.get(String(record.memberId))?.membership || ''),
    primaryMemberNo: getMembershipMemberCode(
      primaryById.get(String(byId.get(String(record.memberId))?.membership)),
    ),
    status: record.status,
    dueAt: record.dueAt,
    overdue: Boolean(record.overdueAt || (record.dueAt && record.dueAt <= now)),
    submittedAt: record.submittedAt,
  }));
}

async function createDocumentUrl(adminId, context, documentKind) {
  const record = context.verification;
  const fileRef = documentKind === 'document' ? record.fileRef : record.extraDocRef;
  const mimeType = documentKind === 'document' ? record.fileMimeType : record.extraDocMimeType;
  if (!fileRef) return '';
  const token = randomBytes(32).toString('hex');
  await VerificationDocumentAccess.create({
    tokenHash: createHash('sha256').update(token).digest('hex'),
    verificationId: record._id,
    familyMemberId: context.member._id,
    documentKind,
    fileRef,
    mimeType,
    expiresAt: new Date(Date.now() + DOCUMENT_URL_TTL_MS),
  });
  await appendAudit(record, {
    actorId: adminId,
    actorType: 'admin',
    action: `document.${documentKind}.url_issued`,
  });
  return `${env.apiPublicUrl}/api/admin/family-verifications/documents?token=${token}`;
}

export async function getAdminFamilyVerificationDetail(adminId, familyMemberId) {
  const context = await adminFamilyContext(familyMemberId);
  if (context.member.isNominee) {
    throw new ApiError(404, 'Nominees use email confirmation and do not have verification documents.');
  }
  const record = context.verification;
  if (!record) {
    return {
      member: { id: String(context.member._id), name: context.member.name, relation: context.member.relation },
      nominee: Boolean(context.member.isNominee),
      emailConfirmed: Boolean(context.member.emailConfirmedAt),
      verification: null,
      checks: {
        nomineeEmailConfirmed: context.member.isNominee && context.member.emailConfirmedAt
          ? check('ok', 'Nominee email is confirmed.')
          : check('fail', 'Nominee email is not confirmed.'),
      },
    };
  }
  const checks = await verificationChecks(context.member, record, context.membership, context.profile, context.primaryIdentity);
  const documentUrl = await createDocumentUrl(adminId, context, 'document');
  const extraDocumentUrl = await createDocumentUrl(adminId, context, 'extraDocument');
  return {
    member: {
      id: String(context.member._id),
      name: context.member.name,
      relation: record.relation || context.member.relation || context.member.relationship,
      parentSide: context.member.parentSide || null,
      memberNo: context.member.isNominee
        ? ''
        : (isMemberId(context.member.memberId || context.member.memberNo)
          ? context.member.memberId || context.member.memberNo
          : ''),
      email: context.member.email,
      dob: context.member.dob || context.member.dateOfBirth,
    },
    primary: {
      name: context.profile?.fullName || '',
      memberNo: getMembershipMemberCode(context.membership),
      aadhaar: checks.primaryAadhaar,
    },
    verification: {
      status: record.status,
      relation: record.relation,
      docType: record.docType,
      aadhaar: checks.applicantAadhaar,
      nameOnDocument: record.nameOnDocument,
      relationLine: record.relationLine,
      applicantAddress: record.applicantAddress,
      fileMimeType: record.fileMimeType,
      extraDocMimeType: record.extraDocMimeType,
      extraDocType: record.extraDocType,
      rejectionReason: record.rejectionReason,
      submittedAt: record.submittedAt,
      dueAt: record.dueAt,
      overdue: Boolean(record.overdueAt || (record.dueAt && record.dueAt <= new Date())),
      auditLog: record.auditLog,
      documentUrl,
      extraDocumentUrl,
    },
    checks,
  };
}

export async function readSignedFamilyVerificationDocument(adminId, token, ip = '') {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const access = await VerificationDocumentAccess.findOneAndDelete({
    tokenHash,
    expiresAt: { $gt: new Date() },
  });
  if (!access) throw new ApiError(404, 'The document link is invalid or no longer available.');
  const record = await Verification.findById(access.verificationId);
  if (!record || record.memberId.toString() !== access.familyMemberId.toString()) {
    throw new ApiError(404, 'The verification document was not found.');
  }
  const expectedRef = access.documentKind === 'document' ? record.fileRef : record.extraDocRef;
  if (expectedRef !== access.fileRef) throw new ApiError(404, 'The verification document has changed.');
  const encrypted = await readFile(familyVerificationDocumentPath(access.fileRef));
  const buffer = decryptDocumentFile(encrypted);
  await appendAudit(record, {
    actorId: adminId,
    actorType: 'admin',
    action: `document.${access.documentKind}.viewed`,
    ip,
  });
  const familyMember = await FamilyMember.findById(access.familyMemberId)
    .select('name fullName memberNo memberId membership isNominee memberType')
    .lean();
  const primaryMembership = familyMember?.membership
    ? await Membership.findById(familyMember.membership)
      .select('memberNo memberCode memberId memberNumber legacyMemberCode')
      .lean()
    : null;
  const memberNo = familyMember?.isNominee || String(familyMember?.memberType || '').startsWith('nominee')
    ? ''
    : isMemberId(familyMember?.memberId || familyMember?.memberNo)
      ? familyMember.memberId || familyMember.memberNo
      : getMembershipMemberCode(primaryMembership);
  await AuditLog.create({
    actorType: 'admin',
    actorId: adminId,
    admin: adminId,
    action: `family_verification.document.${access.documentKind}.viewed`,
    entityType: 'family_verification',
    entityId: String(access.familyMemberId),
    memberNo,
    summary: `Administrator viewed the ${access.documentKind === 'document' ? 'identity' : 'extra'} document for ${familyMember?.name || familyMember?.fullName || 'family member'} (${memberNo || 'primary membership'}).`,
    after: { documentKind: access.documentKind, memberNo },
    ip: String(ip || '').slice(0, 100),
  });
  return { buffer, mimeType: access.mimeType, fileName: `${access.documentKind}.${access.mimeType === 'application/pdf' ? 'pdf' : access.mimeType === 'image/png' ? 'png' : 'jpg'}` };
}

async function notifyFamilyMember(member, membership, template, subject, reason = '') {
  const { user } = await primaryContact(membership);
  const to = member.email || user?.email;
  if (!to) throw new ApiError(409, 'No member or primary email is available for this notification.');
  await sendMail({
    to,
    subject,
    template,
    data: {
      firstName: member.name?.split(/\s+/)[0] || user?.firstName || 'Member',
      reason,
      link: `${env.frontendUrl}/dashboard/family/${member._id}/verification`,
    },
  });
}

export async function decideFamilyVerification(adminId, familyMemberId, decision, reason = '') {
  const { member, membership, verification } = await adminFamilyContext(familyMemberId);
  if (!verification || verification.status !== 'pending') {
    throw new ApiError(409, 'A pending family verification was not found.');
  }
  const before = verification.status;
  const action = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'reupload_requested';
  verification.status = decision === 'approve' ? 'verified' : 'rejected';
  verification.rejectionReason = decision === 'approve' ? '' : reason;
  verification.reviewedBy = adminId;
  verification.reviewedAt = new Date();
  verification.auditLog.push({
    status: verification.status,
    action,
    reason,
    reviewedBy: adminId,
    actorId: adminId,
    actorType: 'admin',
    at: verification.reviewedAt,
  });
  await verification.save();
  const memberNo = member.isNominee
    ? ''
    : isMemberId(member.memberId || member.memberNo)
      ? member.memberId || member.memberNo
      : getMembershipMemberCode(membership);
  await AuditLog.create({
    actorType: 'admin',
    actorId: adminId,
    admin: adminId,
    action: `family.verification.${action}`,
    entityType: 'family_verification',
    entityId: String(member._id),
    memberNo,
    summary: `Family verification ${action.replaceAll('_', ' ')} for ${member.name || member.fullName || 'family member'} (${memberNo || 'primary membership'}).`,
    before: { status: before },
    after: { status: verification.status, discountReleased: decision === 'approve' },
    reason,
  });
  if (decision === 'approve') {
    await notifyFamilyMember(member, membership, 'family-verification-verified', 'Your family verification is complete.');
  } else {
    await notifyFamilyMember(member, membership, 'family-verification-rejected', 'Action needed for your family verification.', reason);
  }
  return { status: verification.status, rejectionReason: verification.rejectionReason };
}

export async function runFamilyVerificationOverdueJob(now = new Date()) {
  const due = await Verification.find({
    status: 'pending',
    dueAt: { $lte: now },
    overdueNotifiedAt: null,
  }).select('_id memberId dueAt');
  const admins = await User.find({ role: 'admin', status: 'active', deletedAt: null }).select('email firstName').lean();
  let notified = 0;
  for (const item of due) {
    const claimed = await Verification.findOneAndUpdate(
      { _id: item._id, status: 'pending', dueAt: { $lte: now }, overdueNotifiedAt: null },
      { $set: { overdueAt: now, overdueNotifiedAt: now } },
      { new: true },
    );
    if (!claimed) continue;
    const member = await FamilyMember.findById(item.memberId).lean();
    if (!member) {
      console.error(`[family-verification] Overdue verification ${item._id} has no family profile.`);
      await Verification.updateOne({ _id: item._id, overdueNotifiedAt: now }, { $set: { overdueNotifiedAt: null } });
      continue;
    }
    if (admins.length === 0) {
      console.error(`[family-verification] No active admin recipients for overdue verification ${item._id}.`);
      await Verification.updateOne({ _id: item._id, overdueNotifiedAt: now }, { $set: { overdueNotifiedAt: null } });
      continue;
    }
    try {
      await sendMail({
        to: admins.map((admin) => admin.email).join(', '),
        subject: 'Family verification review is overdue',
        template: 'family-verification-overdue',
        data: { name: member.name || '', email: member.email || '', link: `${env.adminUrl}/family-verifications/${member._id}` },
      });
    } catch (error) {
      console.error(`[family-verification] Overdue alert email failed for verification ${item._id}: ${error.message}`);
      await Verification.updateOne({ _id: item._id, overdueNotifiedAt: now }, { $set: { overdueNotifiedAt: null } });
      continue;
    }
    claimed.auditLog.push({
      status: 'pending',
      action: 'overdue.alerted',
      actorType: 'system',
      at: now,
    });
    await claimed.save();
    await AuditLog.create({
      actorType: 'system',
      action: 'family.verification.overdue.alerted',
      entityType: 'family_verification',
      entityId: String(item.memberId),
      summary: 'Overdue family verification alert sent.',
    });
    notified += 1;
  }
  return { notified };
}
