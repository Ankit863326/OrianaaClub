import mongoose from 'mongoose';
import Membership from '../src/models/Membership.js';
import FamilyMember from '../src/models/FamilyMember.js';
import { getNextMemberNumber } from '../src/services/membership-id.service.js';
import { formatMemberCode } from '../src/utils/memberCode.js';
import Counter from '../src/models/Counter.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Setting, { getSettings, invalidateSettingsCache } from '../src/models/Setting.js';
import PointLedger from '../src/models/PointLedger.js';
import Verification from '../src/models/Verification.js';
import PointsLedger from '../src/models/PointsLedger.js';
import '../src/models/Redemption.js';
import '../src/models/ApiKey.js';
import { seedMembershipData } from '../scripts/seedMembership.js';
import { verifyMembershipIds } from '../scripts/checkMembershipIds.js';
import { migrateFamilyMembership } from '../scripts/migrateFamilyMembership.js';

describe('membership foundation', () => {
  afterEach(() => invalidateSettingsCache());

  test('seeds the new catalog, settings, and counter idempotently', async () => {
    await seedMembershipData();
    await seedMembershipData();

    expect(await MembershipPlan.countDocuments()).toBe(8);
    expect(await Setting.countDocuments()).toBe(1);
    expect(await Counter.countDocuments({ name: 'memberNumber' })).toBe(1);
    expect(await Counter.findOne({ name: 'approvalSeq' })).toMatchObject({ value: 0, seq: 0 });
    expect((await MembershipPlan.findOne({ name: 'Privileged' })).requiresVerification).toBe(true);
    expect((await MembershipPlan.findOne({ name: 'Corporate' })).requiresCompanyDetails).toBe(true);
    expect(await getSettings()).toMatchObject({
      discountPercent: 50,
      pointsValidityYears: 11,
      membershipValidityYears: 25,
      childAgeLimit: 18,
      earlyBirdLimit: 1000,
    });
    const settings = await getSettings();
    expect(settings.familyMembership).toMatchObject({
      gstPct: 18,
      pointsOnBase: true,
      multipliers: { earlyBird: 2, default: 1.6 },
      limits: { spouse: 1, parents: 4, children: null },
      reviewTargets: { verificationWorkingDays: 1, approvalHours: 24 },
      nomineesTakeApprovalSeq: true,
    });
    expect(settings.familyMembership.tiers).toHaveLength(8);
    expect(settings.familyMembership.tiers.find(({ tier }) => tier === 'founder-legacy').nomineeRoles)
      .toBe('free_text');
    expect(settings.familyMembership.tiers.find(({ tier }) => tier === 'corporate')).toMatchObject({
      familyEnabled: false,
      nomineeRoles: ['GM', 'HR'],
    });
    await Setting.updateOne({ _id: 'global' }, { $set: { discountPercent: 45 } });
    await Setting.updateOne({ _id: 'global' }, { $set: { 'familyMembership.gstPct': 20 } });
    await seedMembershipData();
    expect((await getSettings()).discountPercent).toBe(45);
    expect((await getSettings()).familyMembership.gstPct).toBe(20);
  });

  test('allocates distinct sequential numbers during concurrent requests', async () => {
    const numbers = await Promise.all(Array.from({ length: 20 }, () => getNextMemberNumber()));
    expect(new Set(numbers).size).toBe(20);
    expect([...numbers].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  test('continues the legacy member-number counter without reusing its sequence', async () => {
    await Counter.create({ name: 'memberNumber', value: 42 });
    expect(await getNextMemberNumber()).toBe(43);
    const counter = await Counter.findOne({ name: 'memberNumber' }).lean();
    expect(counter.value).toBe(43);
    expect(counter.seq).toBe(43);
  });

  test('generates unique member codes and formats the approved display shape', async () => {
    const { numbers, codes } = await verifyMembershipIds();
    expect(new Set(numbers).size).toBe(20);
    expect(codes).toHaveLength(20);
    expect(new Set(codes).size).toBe(20);
    expect(codes.every((code) => /^2651\d{8}$/.test(code))).toBe(true);
    expect(formatMemberCode(codes[0])).toBe(codes[0]);
    expect(formatMemberCode(`${codes[0].slice(0, 4)}-${codes[0].slice(4)}`)).toBe(codes[0]);
  });

  test('loads the new models and retains the singleton settings key', async () => {
    const names = mongoose.modelNames();
    for (const name of [
      'MembershipPlan',
      'PointLedger',
      'PointsLedger',
      'Verification',
      'Redemption',
      'Setting',
      'ApiKey',
    ]) {
      expect(names).toContain(name);
    }
    expect((await Setting.create({}))._id).toBe('global');
    await expect(new Setting({ _id: 'another-settings-document' }).validate()).rejects.toThrow(
      'Settings must use the singleton identifier',
    );
  });

  test('supplies family defaults for existing settings without family configuration', async () => {
    await Setting.collection.insertOne({ _id: 'global', discountPercent: 50 });
    invalidateSettingsCache();

    const settings = await getSettings();

    expect(settings.familyMembership.limits).toMatchObject({
      spouse: 1,
      parents: 4,
      parentsPerSide: 2,
      children: null,
    });
    expect(settings.familyMembership.tiers).toHaveLength(8);
  });

  test('validates family membership enums and verification lifecycle fields', async () => {
    const membership = new Membership({
      customer: new mongoose.Types.ObjectId(),
      plan: new mongoose.Types.ObjectId(),
      memberType: 'nominee_gm',
      status: 'pending_approval',
      discountPct: 50,
      memberNo: '100-S',
    });
    await expect(membership.validate()).resolves.toBeUndefined();
    membership.memberType = 'nominee_ceo';
    await expect(membership.validate()).rejects.toThrow();

    const familyMember = new FamilyMember({
      membership: new mongoose.Types.ObjectId(),
      name: 'Test Member',
      relation: 'child',
      memberType: 'child',
      memberNo: '100-C1',
    });
    await expect(familyMember.validate()).resolves.toBeUndefined();
    familyMember.memberType = 'nominee_ceo';
    await expect(familyMember.validate()).rejects.toThrow();

    const verification = new Verification({
      memberId: new mongoose.Types.ObjectId(),
      relation: 'child',
      status: 'pending',
      submittedAt: new Date('2026-10-23T12:00:00.000Z'),
    });
    await verification.validate();
    expect(verification.dueAt.toISOString()).toBe('2026-10-26T12:00:00.000Z');
    verification.status = 'approved';
    await expect(verification.validate()).rejects.toThrow();

    const points = new PointsLedger({
      memberId: new mongoose.Types.ObjectId(),
      pointsBasis: 100,
      multiplier: 1.6,
      phase: 'default',
      approvalSeq: 1,
      points: 160,
      creditedAt: new Date('2026-01-31T00:00:00.000Z'),
      expiresAt: new Date('2037-01-31T00:00:00.000Z'),
    });
    await points.validate();
    expect(points.expiresAt.toISOString()).toBe('2037-01-31T00:00:00.000Z');
    points.phase = 'late';
    await expect(points.validate()).rejects.toThrow();
  });

  test('migrates existing membership statuses idempotently without deleting records', async () => {
    const memberships = Membership.collection;
    const rows = [
      { status: 'draft', memberNumber: '701' },
      { status: 'pending_payment', memberNumber: '702' },
      { status: 'pending_verification', memberNumber: '703' },
      { status: 'active', memberNumber: '704' },
      { status: 'cancelled', memberNumber: '705' },
    ].map(({ status, memberNumber }) => ({
      _id: new mongoose.Types.ObjectId(),
      user: new mongoose.Types.ObjectId(),
      status,
      memberNumber,
    }));
    await memberships.insertMany(rows);

    await migrateFamilyMembership();
    await migrateFamilyMembership();

    const migrated = await memberships.find({ _id: { $in: rows.map(({ _id }) => _id) } }).toArray();
    expect(migrated).toHaveLength(5);
    expect(migrated.map(({ status }) => status)).toEqual([
      'profile_only',
      'payment_pending',
      'pending_approval',
      'active',
      'profile_only',
    ]);
    expect(migrated.every(({ memberType }) => memberType === 'primary')).toBe(true);
    expect(migrated[0].memberNo).toBe('701');
    expect(migrated.find(({ legacyStatus }) => legacyStatus === 'cancelled')).toBeDefined();
    expect(await Counter.countDocuments({ name: 'approvalSeq' })).toBe(1);
    expect((await Counter.findOne({ name: 'approvalSeq' })).value).toBe(0);
  });

  test('keeps active member codes unique and blocks ledger document deletion', async () => {
    const code = '265110100001';
    const plan = new mongoose.Types.ObjectId();
    await Membership.create({
      customer: new mongoose.Types.ObjectId(),
      plan,
      status: 'active',
      memberCode: code,
    });
    await expect(Membership.create({
      customer: new mongoose.Types.ObjectId(),
      plan,
      status: 'active',
      memberCode: code,
    })).rejects.toMatchObject({ code: 11000 });

    const ledgerEntry = await PointLedger.create({
      membership: new mongoose.Types.ObjectId(),
      type: 'credit_joining',
      amount: 1,
      direction: '+',
      balanceAfter: 1,
      createdBy: 'system',
    });
    await expect(ledgerEntry.deleteOne()).rejects.toThrow('append-only');
  });
});
