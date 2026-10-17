import mongoose from 'mongoose';
import Membership from '../src/models/Membership.js';
import { getNextMemberNumber } from '../src/services/membership-id.service.js';
import { formatMemberCode } from '../src/utils/memberCode.js';
import Counter from '../src/models/Counter.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Setting, { getSettings, invalidateSettingsCache } from '../src/models/Setting.js';
import PointLedger from '../src/models/PointLedger.js';
import '../src/models/Redemption.js';
import '../src/models/ApiKey.js';
import { seedMembershipData } from '../scripts/seedMembership.js';
import { verifyMembershipIds } from '../scripts/checkMembershipIds.js';

describe('membership foundation', () => {
  afterEach(() => invalidateSettingsCache());

  test('seeds the new catalog, settings, and counter idempotently', async () => {
    await seedMembershipData();
    await seedMembershipData();

    expect(await MembershipPlan.countDocuments()).toBe(8);
    expect(await Setting.countDocuments()).toBe(1);
    expect(await Counter.countDocuments({ name: 'memberNumber' })).toBe(1);
    expect((await MembershipPlan.findOne({ name: 'Privileged' })).requiresVerification).toBe(true);
    expect((await MembershipPlan.findOne({ name: 'Corporate' })).requiresCompanyDetails).toBe(true);
    expect(await getSettings()).toMatchObject({
      discountPercent: 50,
      pointsValidityYears: 11,
      membershipValidityYears: 25,
      maxFamilyMembers: 6,
      childAgeLimit: 18,
      earlyBirdLimit: 1000,
    });
    await Setting.updateOne({ _id: 'global' }, { $set: { discountPercent: 45 } });
    expect((await getSettings()).discountPercent).toBe(45);
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

  test('generates unique 10-character codes and formats the approved display shape', async () => {
    const { numbers, codes } = await verifyMembershipIds();
    expect(new Set(numbers).size).toBe(20);
    expect(new Set(codes).size).toBe(1000);
    expect(codes.every((code) => /^[A-HJ-NP-Z2-9]{10}$/.test(code))).toBe(true);
    expect(formatMemberCode(codes[0])).toMatch(/^OC-[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/);
    expect(formatMemberCode(`OC-${codes[0].slice(0, 5)}-${codes[0].slice(5)}`)).toBe(
      `OC-${codes[0].slice(0, 5)}-${codes[0].slice(5)}`,
    );
  });

  test('loads the new models and retains the singleton settings key', async () => {
    const names = mongoose.modelNames();
    for (const name of ['MembershipPlan', 'PointLedger', 'Redemption', 'Setting', 'ApiKey']) {
      expect(names).toContain(name);
    }
    expect((await Setting.create({}))._id).toBe('global');
    await expect(new Setting({ _id: 'another-settings-document' }).validate()).rejects.toThrow(
      'Settings must use the singleton identifier',
    );
  });

  test('keeps member codes unique across statuses and blocks ledger document deletion', async () => {
    const code = 'ABCDEFGHJK';
    const plan = new mongoose.Types.ObjectId();
    await Membership.create({
      customer: new mongoose.Types.ObjectId(),
      plan,
      status: 'cancelled',
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
