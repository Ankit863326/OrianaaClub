import mongoose from 'mongoose';
import Membership from '../src/models/Membership.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Payment from '../src/models/Payment.js';
import PointsLedger from '../src/models/PointsLedger.js';
import PointLedger from '../src/models/PointLedger.js';
import { createAdmin, createMember } from './helpers/factories.js';
import { getPayableAmount, paiseToRupees } from '../src/utils/money.js';
import { calculatePoints } from '../src/services/points-ledger.service.js';
import { invalidateSettingsCache } from '../src/models/Setting.js';
import { getMyMembership, getMyPointsHistory } from '../src/services/member-read.service.js';
import { getMembershipLedger } from '../src/services/membership-admin.service.js';

const { confirmOfflineMembershipPayment } = await import('../src/services/payment.service.js');
const {
  createMembershipUpgrade,
  quoteMembershipUpgrade,
} = await import('../src/services/membership-upgrade.service.js');

async function createPlan(name, price) {
  return MembershipPlan.create({
    name,
    price,
    earlyBirdPoints: price * 2,
    defaultPoints: price * 1.6,
    renewalPoints: price,
    sortOrder: price / 100000,
    isActive: true,
  });
}

async function createActiveMember({
  earlyBird = true,
  activatedAt = new Date('2025-01-01T00:00:00.000Z'),
  endDate = new Date('2050-01-01T00:00:00.000Z'),
  status = 'active',
  tier = 'founder-legacy',
} = {}) {
  const currentPlan = await createPlan('Founder Legacy', 300000);
  const member = await createMember({
    membership: {
      plan: currentPlan._id,
      planModel: 'MembershipPlan',
      status,
      memberType: 'primary',
      tier,
      earlyBird,
      earlyBirdApplied: earlyBird,
      approvalSeq: 1,
      activatedAt,
      startDate: activatedAt,
      endDate,
      membershipExpireAt: endDate,
      pointsBalance: 200000,
      pointsGranted: 200000,
      pointsExpireAt: new Date('2036-01-01T00:00:00.000Z'),
      baseAmount: 300000,
      gstAmount: 54000,
      totalPaid: 354000,
    },
  });
  return { ...member, currentPlan };
}

describe('membership plan upgrades', () => {
  afterEach(() => invalidateSettingsCache());

  test('calculates the required early-bird and standard upgrade points', () => {
    expect(calculatePoints(200000, 2)).toBe(400000);
    expect(calculatePoints(200000, 1.6)).toBe(320000);
    expect(calculatePoints(400000, 2)).toBe(800000);
  });

  test('calculates GST on the 2L difference only, for a 2.36L total', () => {
    const breakdown = getPayableAmount({ price: 200000 }, {
      enabled: true,
      rate: 18,
      label: 'GST',
    });
    expect(paiseToRupees(breakdown.totalAmount)).toBe(236000);
    expect(paiseToRupees(breakdown.gstAmount)).toBe(36000);
  });

  test.each([
    [true, 500000, 400000, 236000],
    [false, 500000, 320000, 236000],
    [true, 700000, 800000, 472000],
  ])('quotes an upgrade with earlyBird=%s to price %i', async (earlyBird, targetPrice, points, totalPayable) => {
    const member = await createActiveMember({ earlyBird });
    const target = await createPlan(`Quote ${targetPrice}`, targetPrice);
    const quote = await quoteMembershipUpgrade(member.user._id);
    expect(quote.eligibility).toBe(true);
    expect(quote.currentPlan.price).toBe(300000);
    expect(quote.pointsBalance).toBe(200000);
    expect(quote.plans.find((plan) => plan._id === String(target._id))).toMatchObject({
      baseDifference: targetPrice - 300000,
      gstAmount: (targetPrice - 300000) * 0.18,
      totalPayable,
      upgradePoints: points,
      newBalance: 200000 + points,
      isUpgradeAllowed: true,
    });
  });

  test.each([
    ['same price', 300000],
    ['lower price', 200000],
  ])('rejects a %s target', async (_label, targetPrice) => {
    const member = await createActiveMember();
    const target = await createPlan(`Target ${targetPrice}`, targetPrice);
    await expect(createMembershipUpgrade(member.user._id, String(target._id)))
      .rejects.toThrow('Only a higher-priced plan');
  });

  test('rejects a member who has not completed three months', async () => {
    const member = await createActiveMember({ activatedAt: new Date(Date.now() - 30 * 86400000) });
    const target = await createPlan('Platinum Crest', 500000);
    await expect(createMembershipUpgrade(member.user._id, String(target._id)))
      .rejects.toThrow('not eligible to upgrade');
  });

  test.each([
    ['expired membership', { endDate: new Date(Date.now() - 86400000) }],
    ['inactive membership', { status: 'expired' }],
  ])('rejects an %s', async (_label, overrides) => {
    const member = await createActiveMember(overrides);
    const target = await createPlan(`Target ${new mongoose.Types.ObjectId()}`, 500000);
    await expect(createMembershipUpgrade(member.user._id, String(target._id)))
      .rejects.toThrow('not eligible to upgrade');
  });

  test('blocks a second pending upgrade for the same membership', async () => {
    const member = await createActiveMember();
    const target = await createPlan('Platinum Crest', 500000);
    await createMembershipUpgrade(member.user._id, String(target._id));
    await expect(createMembershipUpgrade(member.user._id, String(target._id)))
      .rejects.toThrow('already pending');
  });

  test('confirms twice without crediting upgrade points twice', async () => {
    const member = await createActiveMember();
    const admin = await createAdmin();
    const target = await createPlan('Platinum Crest', 500000);
    const baseDifference = 200000;
    const breakdown = getPayableAmount({ price: baseDifference }, { enabled: true, rate: 18, label: 'GST' });
    const [payment] = await Payment.create([{
      user: member.user._id,
      membership: member.membership._id,
      plan: target._id,
      planModel: 'MembershipPlan',
      targetPlan: target._id,
      targetPlanModel: 'MembershipPlan',
      oldPlan: member.currentPlan._id,
      oldPlanModel: 'MembershipPlan',
      purpose: 'upgrade',
      amount: baseDifference,
      method: 'bank_transfer',
      status: 'pending',
      reference: 'UPGRADE123456',
      baseDifference: breakdown.baseAmount,
      upgradePoints: 400000,
      earlyBirdApplied: true,
      ...breakdown,
    }]);

    await confirmOfflineMembershipPayment(payment._id, admin.user._id);
    await confirmOfflineMembershipPayment(payment._id, admin.user._id);

    const upgraded = await Membership.findById(member.membership._id);
    expect(String(upgraded.plan)).toBe(String(target._id));
    expect(upgraded.tier).toBe(target.name);
    expect(upgraded.pointsBalance).toBe(600000);
    expect(upgraded.pointsGranted).toBe(600000);
    await expect(getMyMembership(member.user._id)).resolves.toMatchObject({ pointsBalance: 600000 });
    expect(upgraded.endDate).toEqual(member.membership.endDate);
    await expect(PointsLedger.countDocuments({
      memberId: member.membership._id,
      source: 'upgrade',
      payment: payment._id,
    })).resolves.toBe(1);
    await expect(PointLedger.countDocuments({
      membership: member.membership._id,
      type: 'upgrade',
      idempotencyKey: `membership-upgrade:${payment._id}`,
    })).resolves.toBe(1);
    const memberHistory = await getMyPointsHistory(member.user._id, { page: 1, limit: 20 });
    expect(memberHistory.items.filter((entry) => entry.type === 'upgrade')).toHaveLength(1);
    const adminHistory = await getMembershipLedger(member.membership._id, { page: 1, limit: 20 });
    expect(adminHistory.items.filter((entry) => entry.type === 'upgrade')).toHaveLength(1);
    await expect(Payment.findById(payment._id)).resolves.toMatchObject({ status: 'confirmed' });
  });
});
