import mongoose from 'mongoose';
import { jest } from '@jest/globals';
import AuditLog from '../src/models/AuditLog.js';
import Counter from '../src/models/Counter.js';
import FamilyMember from '../src/models/FamilyMember.js';
import Membership from '../src/models/Membership.js';
import Payment from '../src/models/Payment.js';
import PointsLedger from '../src/models/PointsLedger.js';
import Setting, { invalidateSettingsCache } from '../src/models/Setting.js';
import {
  approveMembership,
  confirmNomineeEmail,
  expirePointsLedger,
  getMembershipApprovalQueue,
  runApprovalOverdueJob,
} from '../src/services/membership-approval.service.js';
import { finalizePayment } from '../src/services/payment.service.js';
import { createPaymentReceipt } from '../src/services/receipt.service.js';
import { getMyMembership, getMyPointsHistory } from '../src/services/member-read.service.js';
import { createAdmin, createMember, createPlan } from './helpers/factories.js';

async function createPaidMembership({ tier = 'founder-legacy', baseAmount = 300000 } = {}) {
  const uniqueSlug = `${tier}-${new mongoose.Types.ObjectId()}`;
  const plan = await createPlan({
    slug: uniqueSlug,
    id: uniqueSlug,
    name: tier,
    title: tier,
  });
  const member = await createMember({
    membership: {
      plan: plan._id,
      planModel: 'Plan',
      status: 'pending_approval',
      memberType: 'primary',
      tier,
      baseAmount,
      gstAmount: Math.round(baseAmount * 0.18),
      totalPaid: baseAmount + Math.round(baseAmount * 0.18),
      paymentConfirmedAt: new Date(),
      approvalDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  return { ...member, plan };
}

async function addNominee(membership, { role, memberType = 'nominee', emailConfirmedAt = null }) {
  return FamilyMember.create({
    membership: membership._id,
    name: `${role} Nominee`,
    relation: 'nominee',
    type: 'adult',
    memberType,
    nomineeRole: role,
    email: `${role.toLowerCase()}-${new mongoose.Types.ObjectId()}@example.invalid`,
    isNominee: true,
    emailConfirmedAt,
  });
}

describe('membership approval workflow', () => {
  test('payment confirmation stores rupee totals and waits for approval without points or a sequence', async () => {
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    const payment = await Payment.create({
      user: member.user._id,
      membership: member.membership._id,
      plan: plan._id,
      method: 'manual',
      status: 'created',
      baseAmount: 30000000,
      gstAmount: 5400000,
      totalAmount: 35400000,
    });

    const confirmed = await finalizePayment(payment._id);
    const membership = await Membership.findById(member.membership._id);
    expect(confirmed).toMatchObject({
      status: 'confirmed',
      invoiceNumber: expect.stringMatching(/^INV-\d{4}-\d{6}$/),
      receiptNumber: expect.stringMatching(/^OC-R-\d{4}-\d{6}$/),
    });
    expect(membership).toMatchObject({
      status: 'pending_approval',
      baseAmount: 300000,
      gstAmount: 54000,
      totalPaid: 354000,
      approvalSeq: null,
    });
    expect(membership.approvalDueAt.getTime() - membership.paymentConfirmedAt.getTime())
      .toBe(24 * 60 * 60 * 1000);
    expect(await PointsLedger.countDocuments({ memberId: membership._id })).toBe(0);
  });

  test('confirms later family payments from payment_pending to pending_approval', async () => {
    const plan = await createPlan();
    const primary = await createMember({
      membership: { plan: plan._id, status: 'active', memberNo: '42', memberType: 'primary' },
    });
    const familyMember = await createMember({
      membership: {
        plan: plan._id,
        status: 'payment_pending',
        memberType: 'spouse',
        linkedTo: primary.membership._id,
      },
    });
    const payment = await Payment.create({
      user: familyMember.user._id,
      membership: familyMember.membership._id,
      plan: plan._id,
      method: 'manual',
      status: 'created',
      baseAmount: 15000000,
      gstAmount: 2700000,
      totalAmount: 17700000,
    });

    await finalizePayment(payment._id);
    expect(await Membership.findById(familyMember.membership._id)).toMatchObject({
      status: 'pending_approval',
      memberType: 'spouse',
      linkedTo: primary.membership._id,
      baseAmount: 150000,
      gstAmount: 27000,
      totalPaid: 177000,
    });
  });

  test('approval atomically assigns sequence, activates the member and credits points', async () => {
    const member = await createPaidMembership();
    const admin = await createAdmin();

    const result = await approveMembership(member.membership._id, admin.user._id);

    expect(result.membership).toMatchObject({
      status: 'active',
      approvalSeq: 1,
      earlyBird: true,
      pointsBalance: 600000,
    });
    expect(result.membership.memberCode).toMatch(/^OC-\d{12}$/);
    expect(result.membership.memberNo).toBe(result.membership.memberCode);
    expect(await PointsLedger.findOne({ memberId: member.membership._id })).toMatchObject({
      pointsBasis: 300000,
      multiplier: 2,
      phase: 'early_bird',
      approvalSeq: 1,
      points: 600000,
    });
    expect(await FamilyMember.findOne({ membership: member.membership._id, isPrimary: true }))
      .toMatchObject({
        memberType: 'primary',
        memberNo: result.membership.memberCode,
        approvalSeq: 1,
        status: 'active',
      });
    const dashboard = await getMyMembership(member.user._id);
    expect(dashboard).toMatchObject({
      status: 'active',
      memberNo: result.membership.memberCode,
      memberCode: result.membership.memberCode,
      pointsBalance: 600000,
    });
    expect(dashboard.membershipExpireAt).toEqual(result.membership.membershipExpireAt);
    expect(dashboard.pointsExpireAt).toEqual(result.membership.pointsExpireAt);
    expect(dashboard.membershipValidityYears).toBe(25);
    expect(dashboard.pointsValidityYears).toBe(11);
    expect(dashboard).not.toHaveProperty('expiresAt');
    expect(dashboard).not.toHaveProperty('expiresAt');
    expect(dashboard).not.toHaveProperty('earlyBirdApplied');
    expect(dashboard).not.toHaveProperty('approvalSeq');
    const pointsHistory = await getMyPointsHistory(member.user._id, { page: 1, limit: 20 });
    expect(pointsHistory.items).toMatchObject([{
      points: 600000,
      amountBasis: 300000,
      status: 'active',
    }]);
    expect(Object.keys(pointsHistory.items[0]).sort()).toEqual(['amountBasis', 'date', 'points', 'status']);
    expect(pointsHistory.items[0]).not.toHaveProperty('expiresAt');
    expect(await AuditLog.countDocuments({ entityId: String(member.membership._id), action: 'membership.approve' })).toBe(1);
  });

  test('keeps points hidden from the member dashboard until approval', async () => {
    const member = await createPaidMembership();
    const dashboard = await getMyMembership(member.user._id);

    expect(dashboard.status).toBe('pending_approval');
    expect(dashboard).not.toHaveProperty('pointsBalance');
    expect(dashboard).not.toHaveProperty('earlyBirdApplied');
  });

  test('rolls back status, sequence and ledger if points cannot be credited', async () => {
    const member = await createPaidMembership({ baseAmount: 5_000_000_000_000_000 });
    const admin = await createAdmin();

    await expect(approveMembership(member.membership._id, admin.user._id))
      .rejects.toThrow('Points exceed the supported integer range.');

    const unchanged = await Membership.findById(member.membership._id);
    expect(unchanged.status).toBe('pending_approval');
    expect(unchanged.approvalSeq).toBeNull();
    expect(await Counter.findOne({ name: 'approvalSeq' })).toBeNull();
    expect(await PointsLedger.countDocuments({ memberId: member.membership._id })).toBe(0);
  });

  test('two concurrent administrators receive distinct approval numbers', async () => {
    const [first, second] = await Promise.all([createPaidMembership(), createPaidMembership()]);
    const admin = await createAdmin();

    await Promise.all([
      approveMembership(first.membership._id, admin.user._id),
      approveMembership(second.membership._id, admin.user._id),
    ]);

    const approvals = await Membership.find({ _id: { $in: [first.membership._id, second.membership._id] } })
      .select('approvalSeq');
    expect(new Set(approvals.map((membership) => membership.approvalSeq)).size).toBe(2);
  });

  test.each([
    [999, 'early_bird', true],
    [1000, 'early_bird', true],
    [1001, 'default', false],
  ])('applies early-bird phase at approval sequence %s', async (sequence, phase, earlyBird) => {
    await Counter.create({ name: 'approvalSeq', key: 'approvalSeq', value: sequence - 1, seq: sequence - 1 });
    const member = await createPaidMembership();
    const admin = await createAdmin();

    await approveMembership(member.membership._id, admin.user._id);

    expect(await Membership.findById(member.membership._id)).toMatchObject({ approvalSeq: sequence, earlyBird });
    expect(await PointsLedger.findOne({ memberId: member.membership._id })).toMatchObject({ approvalSeq: sequence, phase });
  });

  test('Corporate approval waits for confirmed nominees and does not assign nominee codes', async () => {
    const member = await createPaidMembership({ tier: 'corporate' });
    const admin = await createAdmin();
    const gm = await addNominee(member.membership, { role: 'GM', memberType: 'nominee_gm' });
    const hr = await addNominee(member.membership, { role: 'HR', memberType: 'nominee_hr' });

    await expect(approveMembership(member.membership._id, admin.user._id))
      .rejects.toThrow('Every added Corporate nominee must confirm their email');
    await confirmNomineeEmail(gm._id);
    await confirmNomineeEmail(hr._id);
    const result = await approveMembership(member.membership._id, admin.user._id);

    expect(result.membership.approvalSeq).toBe(1);
    expect(await FamilyMember.findById(gm._id)).toMatchObject({ approvalSeq: 2, memberNo: '', status: 'active' });
    expect(await FamilyMember.findById(hr._id)).toMatchObject({ approvalSeq: 3, memberNo: '', status: 'active' });
    expect(await PointsLedger.countDocuments({ memberId: { $in: [gm._id, hr._id] } })).toBe(0);
    expect(await AuditLog.findOne({
      action: 'nominee.activate',
      entityId: String(gm._id),
      memberNo: '',
    })).toMatchObject({
      before: { status: 'pending_approval' },
      after: { status: 'active', approvalSeq: 2, memberNo: '' },
    });
  });

  test('other tiers do not block approval and sequence confirmed nominees in added order', async () => {
    const member = await createPaidMembership();
    const admin = await createAdmin();
    const first = await addNominee(member.membership, { role: 'Friend' });
    const second = await addNominee(member.membership, {
      role: 'Mentor',
      emailConfirmedAt: new Date(),
    });

    await approveMembership(member.membership._id, admin.user._id);
    expect(await FamilyMember.findById(second._id)).toMatchObject({
      approvalSeq: 2,
      memberNo: '',
      status: 'active',
    });
    expect(await FamilyMember.findById(first._id)).toMatchObject({ approvalSeq: null, status: 'pending_approval' });

    await confirmNomineeEmail(first._id);
    expect(await FamilyMember.findById(first._id)).toMatchObject({
      approvalSeq: 3,
      memberNo: '',
      status: 'active',
    });
    expect(await PointsLedger.countDocuments({ memberId: { $in: [first._id, second._id] } })).toBe(0);
  });

  test('member approval email contains neither expiry nor early-bird language', async () => {
    const member = await createPaidMembership();
    const admin = await createAdmin();
    const transport = globalThis.__orianaMailTransport;
    transport.sendMail.mockClear();

    await approveMembership(member.membership._id, admin.user._id);

    const html = transport.sendMail.mock.calls[0][0].html.toLowerCase();
    expect(html).not.toMatch(/expir|early.?bird/);
  });

  test('flags overdue memberships and sends only one admin email per item', async () => {
    const member = await createPaidMembership();
    const admin = await createAdmin();
    const now = new Date();
    await Membership.updateOne(
      { _id: member.membership._id },
      { $set: { approvalDueAt: new Date(now.getTime() - 60 * 60 * 1000) } },
    );
    const transport = globalThis.__orianaMailTransport;
    transport.sendMail.mockClear();
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(getMembershipApprovalQueue({}, now)).resolves.toMatchObject({
        items: [{ overdue: true }],
      });
      await expect(runApprovalOverdueJob(now)).resolves.toMatchObject({ notified: 1, failed: 0 });
      await expect(runApprovalOverdueJob(now)).resolves.toMatchObject({ notified: 0 });
      expect(transport.sendMail).toHaveBeenCalledTimes(1);
      expect(await Membership.findById(member.membership._id)).toMatchObject({
        approvalOverdueAt: expect.any(Date),
        approvalOverdueNotifiedAt: expect.any(Date),
      });
    } finally {
      errorLog.mockRestore();
    }
  });

  test('nightly expiry marks elapsed points-ledger entries expired', async () => {
    const member = await createPaidMembership();
    await PointsLedger.create({
      memberId: member.membership._id,
      pointsBasis: 100,
      multiplier: 2,
      phase: 'early_bird',
      approvalSeq: 1,
      points: 200,
      creditedAt: new Date('2014-01-01T00:00:00.000Z'),
      expiresAt: new Date('2025-01-01T00:00:00.000Z'),
      status: 'active',
    });

    await expect(expirePointsLedger(new Date('2026-01-01T00:00:00.000Z')))
      .resolves.toEqual({ expired: 1 });
    expect(await PointsLedger.findOne({ memberId: member.membership._id })).toMatchObject({ status: 'expired' });
  });

  test('membership HSN/SAC configuration is editable and cached settings refresh', async () => {
    await Setting.create({ _id: 'global', receiptHsnSac: 'TEST-CODE' });
    invalidateSettingsCache();
    expect(await Setting.findById('global').then((settings) => settings.receiptHsnSac)).toBe('TEST-CODE');
  });

  test('GST receipt issuance requires configured HSN/SAC and uses the existing invoice series', async () => {
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'pending_approval' },
    });
    const payment = await Payment.create({
      user: member.user._id,
      membership: member.membership._id,
      plan: plan._id,
      method: 'manual',
      status: 'confirmed',
      baseAmount: 30000000,
      gstAmount: 5400000,
      totalAmount: 35400000,
      invoiceNumber: 'INV-2026-000001',
      receiptNumber: 'OC-R-2026-000001',
      confirmedAt: new Date(),
    });
    await Setting.findOneAndUpdate(
      { _id: 'global' },
      { $set: { receiptHsnSac: '' } },
      { upsert: true, new: true },
    );
    invalidateSettingsCache();
    await expect(createPaymentReceipt(payment._id, member.user._id))
      .rejects.toThrow('Configure the GST HSN/SAC setting');

    await Setting.updateOne({ _id: 'global' }, { $set: { receiptHsnSac: 'TEST-CODE' } });
    invalidateSettingsCache();
    const receipt = await createPaymentReceipt(payment._id, member.user._id);
    expect(receipt.receiptNumber).toBe('OC-R-2026-000001');
    receipt.document.on('data', () => {});
    receipt.document.resume();
  });
});
