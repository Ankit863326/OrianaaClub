import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { createAdmin } from './helpers/factories.js';
import Membership from '../src/models/Membership.js';
import MembershipDraft from '../src/models/MembershipDraft.js';
import MembershipDraftArchive from '../src/models/MembershipDraftArchive.js';
import IdentityVerification from '../src/models/IdentityVerification.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Payment from '../src/models/Payment.js';
import User from '../src/models/User.js';
import { finalizeDraft, listDraftMembers, markDraftMemberPaid } from '../src/services/admin-drafts.service.js';
import { relinkArchivedIdentityVerifications } from '../scripts/relinkMembershipDraftIdentities.js';

let nextDraft = 1;

async function createPaidDraft({
  user = null,
  membership = null,
  paymentStatus = 'pending',
} = {}) {
  const suffix = nextDraft++;
  const plan = await MembershipPlan.create({
    name: `Draft plan ${suffix}`,
    price: 10000,
    earlyBirdPoints: 100,
    defaultPoints: 80,
    renewalPoints: 50,
    sortOrder: suffix,
  });
  const draftUser = user || new mongoose.Types.ObjectId();
  const draftMembership = membership || new mongoose.Types.ObjectId();
  const payment = await Payment.create({
    user: draftUser,
    membership: draftMembership,
    plan: plan._id,
    planModel: 'MembershipPlan',
    method: 'bank_transfer',
    status: paymentStatus,
    baseAmount: 1000000,
    gstAmount: 180000,
    totalAmount: 1180000,
  });
  const identity = {
    panCiphertext: `encrypted-pan-${suffix}`,
    panMask: 'XXXXX1234',
    idType: 'passport',
    idCiphertext: `encrypted-id-${suffix}`,
    idMask: '****1234',
    status: 'pending',
    consentAt: new Date(),
    documents: [{
      id: `identity-document-${suffix}`,
      kind: 'pan_front',
      storageKey: `private/identity-${suffix}.pdf`,
      mimeType: 'application/pdf',
    }],
  };
  const identityRecord = await IdentityVerification.create({ user: draftUser, ...identity });
  const draft = await MembershipDraft.create({
    email: `draft${suffix}@example.invalid`,
    firstName: 'Draft',
    tokenHash: `${String(suffix).padStart(64, '0')}`,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    status: 'payment_pending',
    currentStep: 6,
    user,
    membership,
    payment: payment._id,
    identity,
    plan: plan._id,
    profile: {
      fullName: 'Draft Member',
      gender: 'male',
      countryCode: '+91',
      mobile: '9000000000',
      dob: new Date('1990-01-01T00:00:00.000Z'),
      interestArea: 'Travel',
    },
  });
  return { draft, payment, plan, identityRecord, sourceUserId: draftUser };
}

describe('admin paid draft finalization', () => {
  test('marks payment approved, creates pending activation membership, archives and removes the draft', async () => {
    const admin = await createAdmin();
    const { draft, payment, plan, identityRecord } = await createPaidDraft();

    const result = await markDraftMemberPaid(draft._id, admin.user._id, {
      transactionId: 'BANK-APPROVED-001',
      note: 'Verified in bank statement',
    });

    expect(result).toMatchObject({
      status: 'paid',
      alreadyFinalized: false,
      paymentId: String(payment._id),
    });
    expect(await MembershipDraft.findById(draft._id)).toBeNull();
    const archive = await MembershipDraftArchive.findOne({ draftId: draft._id }).lean();
    expect(archive).toMatchObject({
      user: new mongoose.Types.ObjectId(result.memberId),
      membership: new mongoose.Types.ObjectId(result.membershipId),
      payment: payment._id,
      archivedBy: admin.user._id,
      snapshot: { status: 'paid', adminNotes: 'Verified in bank statement' },
    });
    const user = await User.findById(result.memberId);
    expect(user).toMatchObject({
      email: draft.email,
      status: 'pending_activation',
      emailVerified: true,
    });
    const membership = await Membership.findById(result.membershipId);
    expect(membership).toMatchObject({
      user: user._id,
      plan: plan._id,
      planModel: 'MembershipPlan',
      status: 'pending_approval',
    });
    expect(await Payment.findById(payment._id)).toMatchObject({
      status: 'paid',
      reference: 'BANK-APPROVED-001',
    });
    expect(await IdentityVerification.findById(identityRecord._id)).toMatchObject({
      user: user._id,
      panMask: 'XXXXX1234',
      idMask: '****1234',
      status: 'pending',
    });
  });

  test('concurrent duplicate requests finalize the same member and archive once', async () => {
    const admin = await createAdmin();
    const { draft } = await createPaidDraft();

    const results = await Promise.all([
      markDraftMemberPaid(draft._id, admin.user._id, { transactionId: 'BANK-DOUBLE-001' }),
      markDraftMemberPaid(draft._id, admin.user._id, { transactionId: 'BANK-DOUBLE-001' }),
    ]);

    expect(new Set(results.map((result) => result.memberId)).size).toBe(1);
    expect(await MembershipDraftArchive.countDocuments({ draftId: draft._id })).toBe(1);
    expect(await Membership.countDocuments({ user: results[0].memberId })).toBe(1);
    expect(await User.countDocuments({ email: draft.email })).toBe(1);
    expect(await MembershipDraft.findById(draft._id)).toBeNull();
    const repeated = await markDraftMemberPaid(draft._id, admin.user._id, {
      transactionId: 'BANK-DOUBLE-001',
    });
    expect(repeated).toMatchObject({
      memberId: results[0].memberId,
      alreadyFinalized: true,
    });
  });

  test('creates a user and membership when the draft has no user reference', async () => {
    const admin = await createAdmin();
    const { draft, payment, plan, identityRecord, sourceUserId } = await createPaidDraft({ paymentStatus: 'paid' });

    const result = await finalizeDraft(draft._id, admin.user._id);

    const user = await User.findById(result.memberId);
    const membership = await Membership.findById(result.membershipId);
    expect(membership).not.toBeNull();
    expect(user).toMatchObject({
      email: draft.email,
      firstName: draft.firstName,
      role: 'member',
      status: 'pending_activation',
    });
    expect(membership.toObject()).toMatchObject({
      user: user._id,
      plan: plan._id,
      status: 'pending_approval',
    });
    expect(await Payment.findById(payment._id)).toMatchObject({
      user: user._id,
      membership: membership._id,
    });
    expect(String(identityRecord.user)).toBe(String(sourceUserId));
    expect(String((await IdentityVerification.findById(identityRecord._id)).user)).toBe(String(user._id));
    expect(await MembershipDraft.findById(draft._id)).toBeNull();
  });

  test('dry-runs and relinks legacy identity records using their archived encrypted values', async () => {
    const admin = await createAdmin();
    const { draft, identityRecord } = await createPaidDraft();
    const result = await finalizeDraft(draft._id, admin.user._id);
    const archive = await MembershipDraftArchive.findOne({ draftId: draft._id });
    const legacyUserId = new mongoose.Types.ObjectId();
    await IdentityVerification.updateOne({ _id: identityRecord._id }, { $set: { user: legacyUserId } });

    const dryRun = await relinkArchivedIdentityVerifications({ dryRun: true });
    expect(dryRun.relinked).toBe(1);
    expect(String((await IdentityVerification.findById(identityRecord._id)).user)).toBe(String(legacyUserId));

    const applied = await relinkArchivedIdentityVerifications({ dryRun: false });
    expect(applied.relinked).toBe(1);
    expect(String((await IdentityVerification.findById(identityRecord._id)).user)).toBe(result.memberId);
    expect(String(archive.membership)).toBe(result.membershipId);
  });

  test('keeps the draft when user creation fails', async () => {
    const admin = await createAdmin();
    const { draft } = await createPaidDraft({ paymentStatus: 'paid' });
    const createUser = jest.spyOn(User, 'create').mockRejectedValueOnce(new Error('user write failed'));

    try {
      await expect(finalizeDraft(draft._id, admin.user._id)).rejects.toThrow('user write failed');
      expect(await MembershipDraft.findById(draft._id)).not.toBeNull();
      expect(await MembershipDraftArchive.findOne({ draftId: draft._id })).toBeNull();
      expect(await User.findOne({ email: draft.email })).toBeNull();
      expect(await Membership.countDocuments({})).toBe(0);
    } finally {
      createUser.mockRestore();
    }
  });

  test('does not list a paid payment draft', async () => {
    const { draft, payment } = await createPaidDraft({ paymentStatus: 'paid' });
    const listed = await listDraftMembers({});
    expect(listed.items.some((item) => item._id === String(draft._id))).toBe(false);
    expect(await Payment.findById(payment._id)).not.toBeNull();
  });
});
