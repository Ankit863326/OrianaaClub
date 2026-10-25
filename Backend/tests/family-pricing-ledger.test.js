import mongoose from 'mongoose';
import Membership from '../src/models/Membership.js';
import FamilyMember from '../src/models/FamilyMember.js';
import Counter from '../src/models/Counter.js';
import PointsLedger from '../src/models/PointsLedger.js';
import Setting, {
  DEFAULT_FAMILY_MEMBERSHIP_CONFIG,
  getSettings,
  invalidateSettingsCache,
} from '../src/models/Setting.js';
import {
  calculateMemberPrice,
} from '../src/services/pricing.service.js';
import {
  assignApprovalSeq,
  assignSeqBatch,
} from '../src/services/approval-sequence.service.js';
import {
  creditPoints,
  getBalance,
  getMemberSafeLedger,
  toMemberSafeLedgerEntry,
} from '../src/services/points-ledger.service.js';

const standardPlan = { slug: 'founder-legacy', price: 300000 };
const corporatePlan = { slug: 'corporate', price: 2000000 };

async function activePrimary(plan = standardPlan) {
  return Membership.create({
    customer: new mongoose.Types.ObjectId(),
    plan: new mongoose.Types.ObjectId(),
    tier: plan.slug,
    status: 'active',
    baseAmount: plan.price,
    totalPaid: plan.price,
  });
}

async function transaction(run) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await run(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}

describe('family membership pricing', () => {
  afterEach(() => invalidateSettingsCache());

  test.each([
    ['spouse', { memberType: 'spouse' }, { baseAmount: 150000, gstAmount: 27000, totalPayable: 177000, discountPct: 50 }],
    ['parent', { memberType: 'father', parentSide: 'member' }, { baseAmount: 150000, gstAmount: 27000, totalPayable: 177000, discountPct: 50 }],
    ['child', { memberType: 'child', dob: new Date('2010-01-01T00:00:00.000Z') }, { baseAmount: 75000, gstAmount: 13500, totalPayable: 88500, discountPct: 75 }],
  ])('calculates %s discount and GST from the discounted base', async (_label, values, expected) => {
    const linkedPrimary = await activePrimary();
    await expect(calculateMemberPrice({
      plan: standardPlan,
      ...values,
      purchaseDate: new Date('2026-10-24T00:00:00.000Z'),
      linkedPrimary,
    })).resolves.toEqual(expected);
  });

  test('rounds the discounted base, then GST, half up to whole rupees', async () => {
    await Setting.create({
      familyMembership: {
        ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG,
        gstPct: 50,
        discounts: { ...DEFAULT_FAMILY_MEMBERSHIP_CONFIG.discounts, spouse: 50 },
      },
    });
    invalidateSettingsCache();
    const linkedPrimary = await activePrimary({ ...standardPlan, price: 1 });
    const result = await calculateMemberPrice({
      plan: { ...standardPlan, price: 1 },
      memberType: 'spouse',
      linkedPrimary,
    });
    expect(result).toEqual({ baseAmount: 1, gstAmount: 1, totalPayable: 2, discountPct: 50 });
  });

  test('checks child age on purchase date, allowing 18 years 364 days but rejecting after 19', async () => {
    const linkedPrimary = await activePrimary();
    const dob = new Date('2007-10-25T00:00:00.000Z');
    await expect(calculateMemberPrice({
      plan: standardPlan,
      memberType: 'child',
      dob,
      purchaseDate: new Date('2026-10-24T00:00:00.000Z'),
      linkedPrimary,
    })).resolves.toMatchObject({ discountPct: 75 });
    await expect(calculateMemberPrice({
      plan: standardPlan,
      memberType: 'child',
      dob: new Date('2007-10-23T00:00:00.000Z'),
      purchaseDate: new Date('2026-10-24T00:00:00.000Z'),
      linkedPrimary,
    })).rejects.toThrow('needs own membership');
  });

  test('enforces active primary, spouse, total parent, and per-side parent limits', async () => {
    const inactivePrimary = await Membership.create({
      customer: new mongoose.Types.ObjectId(),
      plan: new mongoose.Types.ObjectId(),
      status: 'pending_approval',
    });
    await expect(calculateMemberPrice({
      plan: standardPlan,
      memberType: 'spouse',
      linkedPrimary: inactivePrimary,
    })).rejects.toThrow('must be active');

    const linkedPrimary = await activePrimary();
    await FamilyMember.create({
      membership: linkedPrimary._id,
      name: 'Existing spouse',
      relation: 'spouse',
      memberType: 'spouse',
      status: 'active',
    });
    await expect(calculateMemberPrice({
      plan: standardPlan, memberType: 'spouse', linkedPrimary,
    })).rejects.toThrow('up to 1 spouse');

    await FamilyMember.create([
      { membership: linkedPrimary._id, name: 'Father', relation: 'father', memberType: 'father', parentSide: 'member' },
      { membership: linkedPrimary._id, name: 'Mother', relation: 'mother', memberType: 'mother', parentSide: 'member' },
    ]);
    await expect(calculateMemberPrice({
      plan: standardPlan, memberType: 'father', parentSide: 'member', linkedPrimary,
    })).rejects.toThrow('per side');
    await FamilyMember.create([
      { membership: linkedPrimary._id, name: 'Spouse father', relation: 'father', memberType: 'father', parentSide: 'spouse' },
      { membership: linkedPrimary._id, name: 'Spouse mother', relation: 'mother', memberType: 'mother', parentSide: 'spouse' },
    ]);
    await expect(calculateMemberPrice({
      plan: standardPlan, memberType: 'mother', parentSide: 'member', linkedPrimary,
    })).rejects.toThrow('up to 4 parents');
  });

  test('rejects Corporate family pricing and restricts its nominees to one GM and one HR', async () => {
    const linkedPrimary = await activePrimary(corporatePlan);
    await expect(calculateMemberPrice({
      plan: corporatePlan, memberType: 'spouse', linkedPrimary,
    })).rejects.toThrow('not enabled');
    await expect(calculateMemberPrice({
      plan: corporatePlan, memberType: 'nominee', member: { nomineeRole: 'Director' }, linkedPrimary,
    })).rejects.toThrow('GM, HR');

    const gmPrice = await calculateMemberPrice({
      plan: corporatePlan, memberType: 'nominee_gm', linkedPrimary,
    });
    const hrPrice = await calculateMemberPrice({
      plan: corporatePlan, memberType: 'nominee_hr', linkedPrimary,
    });
    expect(gmPrice).toEqual({ baseAmount: 0, gstAmount: 0, totalPayable: 0, discountPct: 0 });
    expect(hrPrice).toEqual(gmPrice);
    await FamilyMember.create({
      membership: linkedPrimary._id,
      name: 'Existing GM',
      relation: 'nominee',
      memberType: 'nominee_gm',
      nomineeRole: 'GM',
      isNominee: true,
      status: 'active',
    });
    await expect(calculateMemberPrice({
      plan: corporatePlan, memberType: 'nominee_gm', linkedPrimary,
    })).rejects.toThrow('already registered');
  });

  test('allows non-Corporate nominees up to configured max with free-text roles', async () => {
    const linkedPrimary = await activePrimary();
    await FamilyMember.create([
      { membership: linkedPrimary._id, name: 'First', relation: 'nominee', memberType: 'nominee', nomineeRole: 'Friend', isNominee: true, status: 'active' },
      { membership: linkedPrimary._id, name: 'Second', relation: 'nominee', memberType: 'nominee', nomineeRole: 'Colleague', isNominee: true, status: 'active' },
    ]);
    await expect(calculateMemberPrice({
      plan: standardPlan,
      memberType: 'nominee',
      member: { nomineeRole: 'Mentor' },
      linkedPrimary,
    })).rejects.toThrow('up to 2 nominees');
  });
});

describe('approval sequence and points ledger', () => {
  test('allocates sequence batches atomically and early bird includes sequence 1000', async () => {
    await Counter.create({ name: 'approvalSeq', key: 'approvalSeq', value: 998, seq: 998 });
    const member = await activePrimary();
    const numbers = await transaction((session) => assignSeqBatch(session, 3));
    expect(numbers).toEqual([999, 1000, 1001]);

    const ledger = [];
    for (const approvalSeq of numbers) {
      ledger.push(await transaction((session) => creditPoints(session, member, approvalSeq)));
    }
    expect(ledger.map(({ phase }) => phase)).toEqual(['early_bird', 'early_bird', 'default']);
    expect(ledger.map(({ points }) => points)).toEqual([600000, 600000, 480000]);
  });

  test('50 concurrent transactional approvals never receive duplicate numbers', async () => {
    const allocations = await Promise.all(Array.from({ length: 50 }, () => (
      transaction((session) => assignApprovalSeq(session))
    )));
    expect(new Set(allocations).size).toBe(50);
    expect([...allocations].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 50 }, (_, index) => index + 1),
    );
  });

  test('credits points from base or total paid, rounds half up, and expires by editable config', async () => {
    const member = await activePrimary();
    member.baseAmount = 10001;
    member.totalPaid = 12345;
    const first = await transaction((session) => creditPoints(session, member, 1001));
    expect(first).toMatchObject({ pointsBasis: 10001, multiplier: 1.6, points: 16002, phase: 'default' });
    expect(first.expiresAt.getUTCFullYear() - first.creditedAt.getUTCFullYear()).toBe(11);

    await Setting.updateOne(
      { _id: 'global' },
      { $set: { 'familyMembership.pointsOnBase': false } },
    );
    invalidateSettingsCache();
    const second = await transaction((session) => creditPoints(session, member, 1001));
    expect(second).toMatchObject({ pointsBasis: 12345, points: 19752, phase: 'default' });
    expect(await getBalance(member._id)).toBe(16002 + 19752);
  });

  test('uses discounted bases for spouse and child point credits', async () => {
    const spouse = await activePrimary();
    spouse.memberType = 'spouse';
    spouse.baseAmount = 150000;
    const child = await activePrimary();
    child.memberType = 'child';
    child.baseAmount = 75000;

    const earlySpouse = await transaction((session) => creditPoints(session, spouse, 1000));
    const standardSpouse = await transaction((session) => creditPoints(session, spouse, 1001));
    const earlyChild = await transaction((session) => creditPoints(session, child, 1000));
    const standardChild = await transaction((session) => creditPoints(session, child, 1001));

    expect([earlySpouse.points, standardSpouse.points]).toEqual([300000, 240000]);
    expect([earlyChild.points, standardChild.points]).toEqual([150000, 120000]);
  });

  test('rounds fractional points half up', async () => {
    const member = await activePrimary();
    member.baseAmount = 5;
    await getSettings({ forceRefresh: true });
    await Setting.updateOne(
      { _id: 'global' },
      { $set: { 'familyMembership.multipliers.default': 1.1 } },
      { upsert: true },
    );
    invalidateSettingsCache();
    const entry = await transaction((session) => creditPoints(session, member, 1001));
    expect(entry.points).toBe(6);
  });

  test('never credits nominees and strips expiresAt from member-facing ledger views', async () => {
    const nominee = { _id: new mongoose.Types.ObjectId(), memberType: 'nominee_gm' };
    await expect(transaction((session) => creditPoints(session, nominee, 1))).resolves.toBeNull();
    const member = await activePrimary();
    await transaction((session) => creditPoints(session, member, 1001));
    const entries = await getMemberSafeLedger(member._id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).not.toHaveProperty('expiresAt');
    expect(toMemberSafeLedgerEntry({ _id: 'entry', expiresAt: new Date(), points: 1 }))
      .not.toHaveProperty('expiresAt');
    expect(await PointsLedger.countDocuments({ memberId: nominee._id })).toBe(0);
  });
});
