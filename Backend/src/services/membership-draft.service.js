import { createHmac, createHash, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import MembershipDraft from '../models/MembershipDraft.js';
import Membership from '../models/Membership.js';
import MembershipPlan from '../models/MembershipPlan.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import FamilyMember from '../models/FamilyMember.js';
import IdentityVerification from '../models/IdentityVerification.js';
import Payment from '../models/Payment.js';
import { getSettings } from '../models/Setting.js';
import { env } from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import { getPayableAmount } from '../utils/money.js';
import { encryptIdentityValue, hashIdentityValue } from '../utils/identityDocumentCrypto.js';
import { identityDocumentPath } from '../utils/identityDocumentStorage.js';
import { validateIdentityNumber } from '../utils/identityDocumentValidation.js';
import { profileSchema } from '../validators/member.schema.js';
import { activateMembership } from './payment.service.js';
import { sendMail } from './mail.service.js';
import { requestDraftPasswordLink as requestPaidDraftPasswordLink } from './auth.service.js';
import { razorpayClient } from '../config/razorpay.js';
import { publicMediaDirectory } from '../utils/uploadDirectories.js';
import { requireCurrentTermsConsent } from './terms.service.js';
import { calculateFamilyPriceQuotes } from './pricing.service.js';
import {
  normalizeFamilyProfile,
  validateFamilyProfileSet,
} from './family-profile-rules.service.js';

const maskEmail = (email) => {
  const at = email.lastIndexOf('@');
  return at > 0 ? `${email[0]}***${email.slice(at)}` : '***';
};
const tokenHash = (token) => createHash('sha256').update(token).digest('hex');
const otpHash = (id, salt, code) => createHash('sha256').update(`${id}:${salt}:${code}`).digest('hex');

function safeEqualHex(left, right) {
  if (!/^[a-f\d]{64}$/i.test(left) || !/^[a-f\d]{64}$/i.test(right)) return false;
  const leftBuffer = Buffer.from(left, 'hex');
  const rightBuffer = Buffer.from(right, 'hex');
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export async function deleteMembershipDraftArtifacts(draft) {
  await deletePrivateDocuments(draft.identity?.documents || []);
  await Promise.all([
    removePublicPhoto(draft.profile?.photoUrl),
    ...(draft.family || []).map((member) => removePublicPhoto(member.photoUrl)),
  ]);
}

function draftExpiry() {
  return new Date(Date.now() + env.draftRetentionDays * 24 * 60 * 60 * 1000);
}

async function saveDraftAtStep(draft, currentStep) {
  if (draft.status === 'failed') draft.status = 'draft';
  draft.currentStep = currentStep;
  await draft.save();
  return draft;
}

function publicDraft(draft) {
  return {
    id: String(draft._id),
    email: draft.email,
    status: draft.status,
    currentStep: draft.currentStep,
    needsHelp: Boolean(draft.needsHelp),
    paymentMethod: draft.paymentMethod || '',
    firstName: draft.firstName,
    profile: draft.profile || {},
    family: (draft.family || []).map((item) => ({
      ...item.toObject?.() || item,
      _id: item.id,
    })),
    planId: draft.plan ? String(draft.plan) : '',
    identity: {
      status: draft.identity?.documents?.length ? 'pending' : 'not_submitted',
      panMask: draft.identity?.panMask || '',
      idType: draft.identity?.idType || '',
      idMask: draft.identity?.idMask || '',
      documents: (draft.identity?.documents || []).map(({ id, kind, mimeType, uploadedAt }) => ({
        id, kind, mimeType, uploadedAt,
      })),
    },
    emailVerified: Boolean(draft.emailVerifiedAt),
  };
}

export async function requestPasswordLink(draft, email) {
  try {
    const result = await requestPaidDraftPasswordLink(draft, email);
    if (result.sent) {
      draft.status = 'password_pending';
      draft.lastEmailError = '';
      await saveDraftAtStep(draft, 6);
    }
    return result;
  } catch (error) {
    draft.lastEmailError = `${error?.name || 'Error'}: ${error?.code || 'Password-link delivery failed.'}`;
    await draft.save();
    console.error(
      `[membership-draft] Password-link delivery failed: ${error?.name || 'Error'} `
      + `${error?.code || 'unknown'}.`,
    );
    throw error;
  }
}

export async function requestMembershipHelp(email) {
  const normalizedEmail = email.trim().toLowerCase();
  const draft = await MembershipDraft.findOneAndUpdate(
    { email: normalizedEmail },
    {
      $set: { needsHelp: true },
      $setOnInsert: {
        email: normalizedEmail,
        firstName: normalizedEmail.split('@')[0].slice(0, 50) || 'Member',
        tokenHash: tokenHash(randomBytes(32).toString('hex')),
        expiresAt: draftExpiry(),
        status: 'draft',
        currentStep: 6,
      },
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  return { requested: true, email: maskEmail(draft.email) };
}

async function findActiveUser(email) {
  const user = await User.findOne({ email, deletedAt: null });
  if (user?.role === 'member' && user.status === 'active') {
    throw new ApiError(409, 'This email belongs to an active account. Please log in to continue.');
  }
  if (user && user.role !== 'member') {
    throw new ApiError(409, 'This email cannot be used for a membership application.');
  }
}

async function sendDraftOtp(draft, { enforceCooldown = true } = {}) {
  const now = new Date();
  if (enforceCooldown && draft.otpSentAt) {
    const elapsed = Math.ceil((now.getTime() - draft.otpSentAt.getTime()) / 1000);
    if (elapsed < env.draftOtpResendSeconds) {
      throw new ApiError(429, `Please wait ${env.draftOtpResendSeconds - elapsed} seconds before requesting another code.`);
    }
  }

  const code = String(randomInt(100000, 1000000));
  const salt = randomBytes(16).toString('hex');
  draft.otpSalt = salt;
  draft.otpHash = otpHash(String(draft._id), salt, code);
  draft.otpExpiresAt = new Date(now.getTime() + env.draftOtpTtlMinutes * 60 * 1000);
  draft.otpSentAt = now;
  draft.otpAttempts = 0;
  await draft.save();
  if (env.nodeEnv !== 'production') {
    console.log(`[mail:dev] Verification code for ${maskEmail(draft.email)}: ${code}`);
  }
  try {
    await sendMail({
      to: draft.email,
      subject: 'Verify your Orianaa Club email',
      template: 'membership-otp',
      data: {
        firstName: draft.firstName,
        code,
        expiry: `${env.draftOtpTtlMinutes} minutes`,
      },
    });
  } catch (error) {
    const message = String(error?.message || 'No error message was provided.');
    const safeMessage = env.smtpPass ? message.split(env.smtpPass).join('[redacted]') : message;
    const rawCode = String(error?.code || 'unknown');
    const safeCode = env.smtpPass ? rawCode.split(env.smtpPass).join('[redacted]') : rawCode;
    console.error(
      `[membership-draft] Verification-code delivery failed: code=${safeCode} message=${safeMessage}`,
    );
    draft.otpHash = '';
    draft.otpSalt = '';
    draft.otpExpiresAt = null;
    draft.otpSentAt = null;
    draft.lastEmailError = `${error?.name || 'Error'}: ${error?.code || 'Email delivery failed.'}`;
    draft.status = 'failed';
    await draft.save();
    throw error;
  }
}

export async function startMembershipDraft({ firstName, email, profile }, currentToken = '') {
  const normalizedEmail = email.trim().toLowerCase();
  await findActiveUser(normalizedEmail);
  const submitted = await MembershipDraft.findOne({
    email: normalizedEmail,
    status: { $in: ['payment_pending', 'paid', 'password_pending', 'active', 'payment_submitted'] },
  }).select('_id');
  if (submitted) {
    return { resume: false, submitted: true, email: maskEmail(normalizedEmail) };
  }

  let token;
  let draft = await MembershipDraft.findOne({
    email: normalizedEmail,
    status: { $in: ['draft', 'failed', 'abandoned'] },
  })
    .select('+tokenHash');
  if (draft?.expiresAt <= new Date()) {
    draft.status = 'failed';
    await draft.save();
    draft = null;
  }
  if (draft) {
    draft.status = 'draft';
    draft.lastEmailError = '';
    draft.firstName = firstName.trim();
    if (profile) draft.profile = { ...draft.profile, ...profile, email: normalizedEmail };
    await saveDraftAtStep(draft, 1);
  } else {
    token = randomBytes(32).toString('hex');
    try {
      draft = await MembershipDraft.create({
        email: normalizedEmail,
        firstName: firstName.trim(),
        tokenHash: tokenHash(token),
        expiresAt: draftExpiry(),
        profile: { ...profile, email: normalizedEmail },
        currentStep: 1,
      });
    } catch (error) {
      if (error.code !== 11000) throw error;
      draft = await MembershipDraft.findOne({
        email: normalizedEmail,
        status: { $in: ['draft', 'failed', 'abandoned'] },
      });
      if (!draft) throw error;
      token = randomBytes(32).toString('hex');
      draft.tokenHash = tokenHash(token);
      draft.expiresAt = draftExpiry();
      draft.status = 'draft';
      draft.lastEmailError = '';
      await saveDraftAtStep(draft, 1);
    }
  }

  const hasValidCurrentToken = Boolean(
    currentToken && safeEqualHex(draft.tokenHash, tokenHash(currentToken)),
  );
  if (!hasValidCurrentToken && !token) token = randomBytes(32).toString('hex');
  if (!draft.emailVerifiedAt) {
    try {
      await sendDraftOtp(draft);
    } catch (error) {
      if (!(error instanceof ApiError && error.statusCode === 429)) {
        throw new ApiError(503, 'We could not send the verification code. Please try again shortly.');
      }
      const remaining = Math.max(
        1,
        Math.ceil(env.draftOtpResendSeconds
          - (Date.now() - draft.otpSentAt.getTime()) / 1000),
      );
      if (token) {
        draft.tokenHash = tokenHash(token);
        await saveDraftAtStep(draft, 1);
      }
      return {
        token,
        emailVerified: false,
        submitted: false,
        email: maskEmail(normalizedEmail),
        otpExpiresInSeconds: Math.max(0, Math.ceil((draft.otpExpiresAt?.getTime() - Date.now()) / 1000)),
        otpRetryAfterSeconds: remaining,
      };
    }
  }
  if (token) {
    draft.tokenHash = tokenHash(token);
    await saveDraftAtStep(draft, 1);
  }

  return {
    token,
    emailVerified: Boolean(draft.emailVerifiedAt),
    submitted: false,
    email: maskEmail(normalizedEmail),
    otpExpiresInSeconds: draft.emailVerifiedAt ? 0 : env.draftOtpTtlMinutes * 60,
  };
}

export async function verifyMembershipDraftOtp(draft, code) {
  if (draft.emailVerifiedAt) return publicDraft(draft);
  if (!draft.otpHash || !draft.otpExpiresAt || draft.otpExpiresAt <= new Date()) {
    throw new ApiError(400, 'This verification code has expired. Request a new code.');
  }
  if (draft.otpAttempts >= env.draftOtpMaxAttempts) {
    throw new ApiError(429, 'Too many verification attempts. Request a new code.');
  }

  const valid = safeEqualHex(draft.otpHash, otpHash(String(draft._id), draft.otpSalt, code));
  if (!valid) {
    draft.otpAttempts += 1;
    await draft.save();
    throw new ApiError(400, 'That verification code is not valid. Check it and try again.');
  }
  draft.emailVerifiedAt = new Date();
  draft.otpHash = '';
  draft.otpSalt = '';
  draft.otpExpiresAt = null;
  await saveDraftAtStep(draft, 1);
  return publicDraft(draft);
}

export async function resendMembershipDraftOtp(draft) {
  if (draft.emailVerifiedAt) return { message: 'Your email is already verified.' };
  try {
    await sendDraftOtp(draft);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(503, 'We could not send the verification code. Please try again shortly.');
  }
  return { message: 'If this application can receive a code, one has been sent.' };
}

export function getMembershipDraft(draft) {
  return publicDraft(draft);
}

async function savePublicPhoto(file) {
  if (!file) return '';
  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[file.mimetype];
  if (!extension) throw new ApiError(400, 'Photos must be JPG, PNG, or WebP.');
  await mkdir(publicMediaDirectory, { recursive: true, mode: 0o750 });
  const filename = `${randomUUID()}.${extension}`;
  await writeFile(path.join(publicMediaDirectory, filename), file.buffer, { flag: 'wx', mode: 0o640 });
  return `/media/${filename}`;
}

async function removePublicPhoto(photoUrl) {
  if (!photoUrl?.startsWith('/media/')) return;
  try {
    await unlink(path.join(publicMediaDirectory, path.basename(photoUrl)));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

export async function saveMembershipDraftProfile(draft, values, photo) {
  if (!draft.emailVerifiedAt) throw new ApiError(403, 'Verify your email before continuing.');
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) throw new ApiError(400, parsed.error.issues[0]?.message || 'Personal details are invalid.');
  const previousPhoto = draft.profile?.photoUrl || '';
  const photoUrl = photo ? await savePublicPhoto(photo) : previousPhoto;
  draft.firstName = parsed.data.fullName.trim().split(/\s+/)[0];
  draft.profile = { ...parsed.data, email: draft.email, photoUrl };
  await saveDraftAtStep(draft, 1);
  if (photo && previousPhoto) await removePublicPhoto(previousPhoto);
  return draft.profile;
}

export async function saveMembershipDraftIdentity(draft, values, uploadedDocuments) {
  if (!draft.emailVerifiedAt) throw new ApiError(403, 'Verify your email before uploading documents.');
  const pan = validateIdentityNumber('pan', values.panNumber);
  const second = validateIdentityNumber(values.secondIdType, values.secondIdNumber);
  if (!pan) throw new ApiError(400, 'Enter a valid PAN number in the format ABCDE1234F.');
  if (!second) {
    const messages = {
      aadhaar: 'Enter a valid 12-digit Aadhaar number that passes checksum verification.',
      driving_licence: 'Enter a valid Indian Driving Licence number (state, RTO, year, and serial).',
      passport: 'Enter a valid Indian passport number (one letter followed by seven digits).',
    };
    throw new ApiError(400, messages[values.secondIdType]);
  }
  const requiredKinds = ['pan_front', 'second_front', 'second_back'];
  if (!Array.isArray(uploadedDocuments)
    || requiredKinds.some((kind) => uploadedDocuments.filter((document) => document.kind === kind).length !== 1)
    || uploadedDocuments.length > 4) {
    throw new ApiError(400, 'Upload the PAN front and both sides of the selected second ID.');
  }

  const aadhaarHash = values.secondIdType === 'aadhaar' ? hashIdentityValue(second.value) : '';
  if (aadhaarHash) {
    const [existingVerification, otherDraft] = await Promise.all([
      IdentityVerification.findOne({ idType: 'aadhaar', aadhaarHash }).select('+aadhaarHash').lean(),
      MembershipDraft.findOne({
        _id: { $ne: draft._id },
        status: 'draft',
        'identity.aadhaarHash': aadhaarHash,
      }).select('_id'),
    ]);
    if (existingVerification || otherDraft) {
      throw new ApiError(409, 'This identity number is already associated with an application.');
    }
  }

  const previousDocuments = draft.identity?.documents || [];
  draft.identity = {
    panCiphertext: encryptIdentityValue(pan.value),
    panMask: pan.mask,
    idType: values.secondIdType,
    idCiphertext: encryptIdentityValue(second.value),
    idMask: second.mask,
    aadhaarLast4: values.secondIdType === 'aadhaar' ? second.last4 : '',
    aadhaarHash,
    consentAt: new Date(),
    documents: uploadedDocuments.map(({ id, kind, storageKey, mimeType }) => ({
      id: id || randomUUID(),
      kind,
      storageKey,
      mimeType,
      uploadedAt: new Date(),
    })),
  };
  try {
    await saveDraftAtStep(draft, 1);
  } catch (error) {
    await deletePrivateDocuments(uploadedDocuments);
    throw error;
  }
  await deletePrivateDocuments(previousDocuments);
  return publicDraft(draft).identity;
}

async function deletePrivateDocuments(documents = []) {
  await Promise.all(documents.map(async ({ storageKey }) => {
    try {
      await unlink(identityDocumentPath(storageKey));
    } catch (error) {
      if (error.code !== 'ENOENT') console.error('[membership-draft] Private document cleanup failed.');
    }
  }));
}

export async function discardUncommittedIdentityDocuments(documents = []) {
  await deletePrivateDocuments(documents || []);
}

export async function saveMembershipDraftFamily(draft, values) {
  if (!draft.emailVerifiedAt) throw new ApiError(403, 'Verify your email before continuing.');
  const family = values.map((item) => ({
    id: item.id || randomUUID(),
    ...normalizeFamilyProfile(item),
    photoUrl: item.photoUrl || '',
  }));
  syncDraftParentAnniversaries(family);
  const plan = await MembershipPlan.findOne({ _id: draft.plan, isActive: true }).lean();
  await validateFamilyProfileSet({ plan, members: family });
  draft.family = family;
  await saveDraftAtStep(draft, 3);
  return draft.family;
}

export async function addMembershipDraftFamily(draft, values, photo) {
  if (!draft.emailVerifiedAt) throw new ApiError(403, 'Verify your email before continuing.');
  const plan = await MembershipPlan.findOne({ _id: draft.plan, isActive: true }).lean();
  let profileValues = normalizeFamilyProfile(values);
  if (['father', 'mother'].includes(profileValues.memberType)) {
    const side = profileValues.parentSide || 'member';
    const counterpart = draft.family.find((item) => (
      ['father', 'mother'].includes(item.memberType)
      && (item.parentSide || 'member') === side
      && item.anniversaryDate
    ));
    if (!profileValues.anniversaryDate && counterpart?.anniversaryDate) {
      profileValues = { ...profileValues, anniversaryDate: counterpart.anniversaryDate };
    }
    if (profileValues.anniversaryDate) {
      draft.family.forEach((item) => {
        if (['father', 'mother'].includes(item.memberType)
          && (item.parentSide || 'member') === side) {
          item.anniversaryDate = profileValues.anniversaryDate;
        }
      });
    }
  }
  await validateFamilyProfileSet({
    plan,
    members: [...draft.family.map((member) => member.toObject()), profileValues],
  });
  const photoUrl = await savePublicPhoto(photo);
  draft.family.push({
    id: randomUUID(),
    ...profileValues,
    photoUrl,
  });
  await saveDraftAtStep(draft, 3);
  const member = draft.family[draft.family.length - 1];
  return { ...member.toObject(), _id: member.id };
}

export async function updateMembershipDraftFamily(draft, familyId, values, photo) {
  const member = draft.family.find((item) => item.id === familyId);
  if (!member) throw new ApiError(404, 'Family member was not found.');
  const profileValues = normalizeFamilyProfile(values);
  const plan = await MembershipPlan.findOne({ _id: draft.plan, isActive: true }).lean();
  const family = draft.family
    .filter((item) => item.id !== familyId)
    .map((item) => item.toObject());
  await validateFamilyProfileSet({ plan, members: [...family, profileValues] });
  const oldPhoto = member.photoUrl;
  Object.assign(member, profileValues);
  if (['father', 'mother'].includes(member.memberType)) {
    const side = member.parentSide || 'member';
    draft.family.forEach((item) => {
      if (['father', 'mother'].includes(item.memberType)
        && (item.parentSide || 'member') === side) {
        item.anniversaryDate = member.anniversaryDate || null;
      }
    });
  }
  if (photo) member.photoUrl = await savePublicPhoto(photo);
  await saveDraftAtStep(draft, 3);
  if (photo && oldPhoto) await removePublicPhoto(oldPhoto);
  return { ...member.toObject(), _id: member.id };
}

function syncDraftParentAnniversaries(family) {
  for (const side of ['member', 'spouse']) {
    const parents = family.filter((member) => (
      ['father', 'mother'].includes(member.memberType)
      && (member.parentSide || 'member') === side
    ));
    const anniversaryDate = parents.find((member) => member.anniversaryDate)?.anniversaryDate || null;
    parents.forEach((member) => {
      member.anniversaryDate = anniversaryDate;
    });
  }
}

export async function deleteMembershipDraftFamily(draft, familyId) {
  const member = draft.family.find((item) => item.id === familyId);
  if (!member) throw new ApiError(404, 'Family member was not found.');
  draft.family = draft.family.filter((item) => item.id !== familyId);
  await saveDraftAtStep(draft, 3);
  await removePublicPhoto(member.photoUrl);
  return draft.family;
}

export async function saveMembershipDraftPlan(draft, planId) {
  if (!draft.emailVerifiedAt) throw new ApiError(403, 'Verify your email before continuing.');
  const plan = await MembershipPlan.findOne({ _id: planId, isActive: true });
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  draft.plan = plan._id;
  await saveDraftAtStep(draft, 2);
  return plan;
}

export async function getMembershipDraftQuote(draft, planId) {
  if (!draft.emailVerifiedAt) throw new ApiError(403, 'Verify your email before continuing.');
  const plan = await MembershipPlan.findOne({ _id: planId, isActive: true });
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  const settings = await getSettings();
  const breakdown = getPayableAmount(plan, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  await saveDraftAtStep(draft, 4);
  return {
    planId: String(plan._id),
    planFee: breakdown.baseAmount,
    gstEnabled: breakdown.gstEnabled,
    gstPercent: breakdown.gstRate,
    gstLabel: breakdown.gstLabel,
    gst: breakdown.gstAmount,
    total: breakdown.totalAmount,
    currency: breakdown.currency,
  };
}

export async function getMembershipDraftFamilyPriceBreakdown(draft, planId) {
  if (!draft.emailVerifiedAt) throw new ApiError(403, 'Verify your email before continuing.');
  const plan = await MembershipPlan.findOne({ _id: planId, isActive: true }).lean();
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  return calculateFamilyPriceQuotes(plan);
}

async function persistPriceSnapshot(draft, plan) {
  const settings = await getSettings();
  const amount = getPayableAmount(plan, {
    enabled: settings.gstEnabled,
    rate: settings.gstRate,
    label: settings.gstLabel,
  });
  draft.gstSnapshot = {
    enabled: amount.gstEnabled,
    rate: amount.gstRate,
    label: amount.gstLabel,
    planFee: amount.baseAmount,
    gstAmount: amount.gstAmount,
    totalAmount: amount.totalAmount,
  };
  return amount;
}

async function createRazorpayDraftOrder(draft, plan, amount) {
  if (!env.razorpayKeyId || !env.razorpayKeySecret || !razorpayClient) {
    throw new ApiError(503, 'Online payment is not enabled yet. Please choose a manual payment method.');
  }
  if (!Number.isSafeInteger(amount.totalAmount) || amount.totalAmount <= 0) {
    throw new ApiError(400, 'The selected plan has an invalid payable amount.');
  }
  const order = await razorpayClient.orders.create({
    amount: amount.totalAmount,
    currency: amount.currency,
    receipt: `oc-draft-${String(draft._id).slice(-18)}`,
    notes: { draftId: String(draft._id), planId: String(plan._id) },
  });
  draft.razorpayOrderId = order.id;
  draft.paymentMethod = 'razorpay';
  await saveDraftAtStep(draft, 5);
  return {
    orderId: order.id,
    keyId: env.razorpayKeyId,
    amount: amount.totalAmount,
    currency: amount.currency,
    planFee: amount.baseAmount,
    gst: amount.gstAmount,
    gstRate: amount.gstRate,
    gstEnabled: amount.gstEnabled,
    gstLabel: amount.gstLabel,
  };
}

async function convertDraftToAccount(draft, {
  method,
  razorpayOrderId = '',
  razorpayPaymentId = '',
  rtgsDetails,
  companyDetails,
}) {
  if (draft.payment && draft.user && draft.membership) {
    return {
      userId: draft.user,
      membershipId: draft.membership,
      paymentId: draft.payment,
      status: draft.status,
    };
  }
  if (!draft.emailVerifiedAt) throw new ApiError(403, 'Verify your email before submitting payment.');
  if (!draft.profile?.fullName || !draft.identity?.documents?.length) {
    throw new ApiError(409, 'Complete Personal Details and document verification before payment.');
  }
  const plan = await MembershipPlan.findOne({ _id: draft.plan, isActive: true });
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  const amount = draft.gstSnapshot?.totalAmount !== null && draft.gstSnapshot?.totalAmount !== undefined
    ? {
      baseAmount: draft.gstSnapshot.planFee,
      gstAmount: draft.gstSnapshot.gstAmount,
      totalAmount: draft.gstSnapshot.totalAmount,
      gstRate: draft.gstSnapshot.rate,
      gstEnabled: draft.gstSnapshot.enabled,
      gstLabel: draft.gstSnapshot.label,
      currency: 'INR',
    }
    : await persistPriceSnapshot(draft, plan);
  const existingUser = await User.findOne({ email: draft.email, deletedAt: null }).select('+passwordHash');
  if (existingUser?.status === 'active') {
    throw new ApiError(409, 'This email belongs to an active account. Please log in to continue.');
  }
  const user = existingUser || await User.create({
    firstName: draft.firstName,
    email: draft.email,
    role: 'member',
    status: 'pending',
    emailVerified: true,
    activationRequiresMembershipPayment: true,
  });
  if (existingUser) {
    existingUser.firstName = draft.firstName;
    existingUser.emailVerified = true;
    existingUser.activationRequiresMembershipPayment = true;
    await existingUser.save();
  }

  const profile = await Profile.findOneAndUpdate(
    { user: user._id },
    { $set: { ...draft.profile, user: user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  let membership = await Membership.findOne({
    user: user._id,
    status: { $in: ['draft', 'pending_payment'] },
  }).sort({ createdAt: -1 });
  if (membership) {
    membership.plan = plan._id;
    membership.planModel = 'MembershipPlan';
    membership.status = 'pending_payment';
    membership.companyDetails = companyDetails || membership.companyDetails;
    await membership.save();
  } else {
    membership = await Membership.create({
      user: user._id,
      customer: user._id,
      plan: plan._id,
      planModel: 'MembershipPlan',
      status: 'pending_payment',
      companyDetails: companyDetails || undefined,
    });
  }

  let identity = await IdentityVerification.findOne({ user: user._id });
  if (!identity || identity.status === 'rejected') {
    const source = draft.identity;
    const identityValues = {
      panCiphertext: source.panCiphertext,
      panMask: source.panMask,
      idType: source.idType,
      idCiphertext: source.idCiphertext || '',
      idMask: source.idMask,
      aadhaarLast4: source.aadhaarLast4 || '',
      aadhaarHash: source.aadhaarHash || '',
      status: 'pending',
      consentAt: source.consentAt || new Date(),
      documents: source.documents,
    };
    identity = identity
      ? await IdentityVerification.findOneAndUpdate(
        { _id: identity._id, status: 'rejected' },
        { $set: identityValues },
        { new: true, runValidators: true },
      )
      : await IdentityVerification.create({ user: user._id, ...identityValues });
  }
  for (const family of draft.family || []) {
    await FamilyMember.updateOne(
      { membership: membership._id, fullName: family.fullName, dob: family.dob },
      { $setOnInsert: {
        membership: membership._id,
        fullName: family.fullName,
        name: family.fullName,
        gender: family.gender,
        relationship: family.relationship,
        relation: family.relationship,
        dob: family.dob || null,
        dateOfBirth: family.dob || null,
        photoUrl: family.photoUrl || '',
        photo: family.photoUrl || '',
        memberType: family.memberType,
        isNominee: family.isNominee,
        nomineeRole: family.nomineeRole || '',
        designation: family.designation || '',
        email: family.email || '',
        workEmail: family.workEmail || '',
        phone: family.phone || '',
        parentSide: family.parentSide || null,
        anniversaryDate: family.anniversaryDate || null,
        wantsOwnMembership: family.wantsOwnMembership || false,
      } },
      { upsert: true },
    );
  }

  const [payment] = await Payment.create([{
    user: user._id,
    membership: membership._id,
    plan: plan._id,
    planModel: 'MembershipPlan',
    amount: amount.totalAmount,
    method,
    status: method === 'razorpay' ? 'created' : 'pending',
    ...amount,
    ...(razorpayOrderId ? { razorpayOrderId } : {}),
    ...(razorpayPaymentId ? { razorpayPaymentId } : {}),
    ...(rtgsDetails?.utr ? {
      reference: rtgsDetails.utr.trim(),
      utr: rtgsDetails.utr.trim(),
      transferDate: rtgsDetails.transferDate,
    } : {}),
  }]);

  draft.user = user._id;
  draft.membership = membership._id;
  draft.payment = payment._id;
  draft.paymentMethod = method;
  draft.status = 'payment_pending';
  draft.currentStep = 6;
  draft.convertedAt = new Date();
  draft.identity.documents = [];
  await draft.save();
  if (method === 'razorpay') {
    await activateMembership(membership._id, payment._id, {
      razorpayPaymentId,
      markPaid: env.nodeEnv !== 'production',
    });
    draft.status = 'paid';
    await saveDraftAtStep(draft, 6);
  }
  return {
    userId: String(user._id),
    membershipId: String(membership._id),
    paymentId: String(payment._id),
    status: method === 'razorpay' ? 'paid' : 'pending',
    paymentMethod: method,
    amount: amount.totalAmount,
    planFee: amount.baseAmount,
    gst: amount.gstAmount,
    gstRate: amount.gstRate,
    gstEnabled: amount.gstEnabled,
    gstLabel: amount.gstLabel,
    email: maskEmail(user.email),
    profileId: String(profile._id),
  };
}

export async function submitMembershipDraftPayment(draft, { paymentMethod, rtgsDetails, companyDetails }) {
  await requireCurrentTermsConsent(draft._id);
  if (!['draft', 'failed'].includes(draft.status)) throw new ApiError(409, 'This membership application has already been submitted.');
  draft.status = 'draft';
  if (paymentMethod === 'cash' || !['upi', 'card', 'razorpay', 'bank_transfer', 'cheque', 'rtgs'].includes(paymentMethod)) {
    throw new ApiError(400, 'The selected membership payment method is not supported.');
  }
  if (draft.identity?.documents?.length < 3) {
    throw new ApiError(409, 'Complete identity document verification before submitting payment.');
  }
  const plan = await MembershipPlan.findOne({ _id: draft.plan, isActive: true });
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  if (plan.requiresCompanyDetails
    && !['companyName', 'gstNumber', 'contactPerson'].every((key) => companyDetails?.[key]?.trim())) {
    throw new ApiError(400, 'Company name, GST number, and contact person are required for this plan.');
  }
  const method = ['upi', 'card', 'razorpay'].includes(paymentMethod) ? 'razorpay' : paymentMethod;
  const amount = await persistPriceSnapshot(draft, plan);
  await draft.save();
  if (method === 'razorpay') {
    return createRazorpayDraftOrder(draft, plan, amount);
  }
  if (method === 'rtgs') {
    const utr = rtgsDetails?.utr?.trim();
    if (!utr || !/^[a-z\d/-]{6,50}$/i.test(utr) || !rtgsDetails?.transferDate) {
      throw new ApiError(400, 'Enter a valid RTGS UTR and transfer date.');
    }
    if (await Payment.exists({ utr })) throw new ApiError(409, 'This RTGS UTR has already been used.');
  }
  return convertDraftToAccount(draft, { method, rtgsDetails, companyDetails });
}

export async function verifyMembershipDraftRazorpayPayment(draft, {
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
}) {
  await requireCurrentTermsConsent(draft._id);
  if (!env.razorpayKeySecret || (env.nodeEnv === 'production' && !razorpayClient)) {
    throw new ApiError(503, 'Online payment is not available.');
  }
  const current = await MembershipDraft.findOne({
    _id: draft._id,
    razorpayOrderId: razorpay_order_id,
  }).select(
    '+tokenHash +identity.panCiphertext +identity.idCiphertext +identity.aadhaarLast4 +identity.aadhaarHash',
  );
  if (!current) throw new ApiError(404, 'Payment order was not found.');
  const expected = createHmac('sha256', env.razorpayKeySecret)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (!safeEqualHex(expected, razorpay_signature)) {
    throw new ApiError(400, 'The payment verification failed. Please try again.');
  }
  const plan = await MembershipPlan.findById(current.plan);
  if (!plan) throw new ApiError(404, 'Membership plan was not found.');
  const expectedAmount = current.gstSnapshot?.totalAmount;
  if (!Number.isSafeInteger(expectedAmount) || expectedAmount <= 0) {
    throw new ApiError(400, 'The saved payment amount is invalid.');
  }
  if (env.nodeEnv === 'production') {
    const providerPayment = await razorpayClient.payments.fetch(razorpay_payment_id);
    if (providerPayment.order_id !== razorpay_order_id
      || providerPayment.amount !== expectedAmount
      || providerPayment.currency !== 'INR'
      || providerPayment.status !== 'captured') {
      throw new ApiError(400, 'The verified payment does not match this membership order.');
    }
  } else {
    console.log('[membership-draft] Development payment bypass: callback signature and saved order amount verified.');
  }
  if (current.payment) {
    const payment = await Payment.findById(current.payment);
    if (['confirmed', 'paid'].includes(payment?.status)
      && payment.razorpayPaymentId === razorpay_payment_id) {
      return { status: 'paid', membershipId: String(current.membership), email: maskEmail(current.email) };
    }
    throw new ApiError(409, 'This payment order has already been used.');
  }
  const result = await convertDraftToAccount(current, {
    method: 'razorpay',
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
  });
  return result;
}

export async function processGuestMembershipWebhook(rawBody, signature) {
  if (!env.razorpayWebhookSecret) return false;
  const expected = createHmac('sha256', env.razorpayWebhookSecret).update(rawBody).digest('hex');
  if (!safeEqualHex(expected, signature || '')) throw new ApiError(400, 'Invalid payment webhook signature.');
  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw new ApiError(400, 'Invalid payment webhook payload.');
  }
  const paymentEntity = event.payload?.payment?.entity;
  const orderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;
  if (!orderId) return false;
  const draft = await MembershipDraft.findOne({
    razorpayOrderId: orderId,
    status: { $in: ['draft', 'failed'] },
  }).select(
    '+identity.panCiphertext +identity.idCiphertext +identity.aadhaarLast4 +identity.aadhaarHash',
  );
  if (!draft) return false;
  if (event.event === 'payment.failed') {
    draft.razorpayOrderId = '';
    draft.paymentMethod = '';
    draft.status = 'failed';
    draft.currentStep = 5;
    await draft.save();
    return true;
  }
  if (!['payment.captured', 'order.paid'].includes(event.event) || !paymentEntity?.id) return false;
  const expectedAmount = draft.gstSnapshot?.totalAmount;
  if (paymentEntity.order_id !== orderId
    || paymentEntity.amount !== expectedAmount
    || paymentEntity.currency !== 'INR'
    || paymentEntity.status !== 'captured') {
    throw new ApiError(400, 'The Razorpay webhook payment does not match the saved membership quote.');
  }
  await convertDraftToAccount(draft, {
    method: 'razorpay',
    razorpayOrderId: orderId,
    razorpayPaymentId: paymentEntity.id,
  });
  return true;
}

export async function runMembershipDraftCleanup(now = new Date()) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('Draft cleanup requires a valid date.');
  }
  const drafts = await MembershipDraft.find({
    status: { $in: ['draft', 'failed'] },
    expiresAt: { $lte: now },
  }).select('_id identity.documents profile.photoUrl family.photoUrl');
  for (const draft of drafts) {
    await deletePrivateDocuments(draft.identity?.documents || []);
    await Promise.all([
      removePublicPhoto(draft.profile?.photoUrl),
      ...(draft.family || []).map((member) => removePublicPhoto(member.photoUrl)),
    ]);
    await MembershipDraft.updateOne(
      { _id: draft._id, status: { $in: ['draft', 'failed'] } },
      { $set: { status: 'failed' } },
    );
  }
  return { draftsRemoved: drafts.length };
}
