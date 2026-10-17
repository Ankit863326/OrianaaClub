import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import Counter from '../src/models/Counter.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Setting, { DEFAULT_SETTINGS_ID } from '../src/models/Setting.js';

const plans = [
  { name: 'Founder Legacy', price: 300000, earlyBirdPoints: 600000, defaultPoints: 480000, renewalPoints: 420000 },
  { name: 'Platinum Crest', price: 500000, earlyBirdPoints: 1050000, defaultPoints: 850000, renewalPoints: 750000 },
  { name: 'Imperial Signature', price: 700000, earlyBirdPoints: 1550000, defaultPoints: 1260000, renewalPoints: 1190000 },
  { name: 'Presidential Elite', price: 1000000, earlyBirdPoints: 2300000, defaultPoints: 2050000, renewalPoints: 1800000 },
  { name: "Chairman's Privilege", price: 1500000, earlyBirdPoints: 3600000, defaultPoints: 3000000, renewalPoints: 2700000 },
  { name: 'Founder Circle', price: 2500000, earlyBirdPoints: 6250000, defaultPoints: 5250000, renewalPoints: 4750000 },
  {
    name: 'Corporate',
    price: 2000000,
    earlyBirdPoints: 4000000,
    defaultPoints: 3500000,
    renewalPoints: 3000000,
    requiresCompanyDetails: true,
  },
  {
    name: 'Privileged',
    price: 700000,
    earlyBirdPoints: 1400000,
    defaultPoints: 1200000,
    renewalPoints: 950000,
    requiresVerification: true,
  },
].map((plan, index) => ({ ...plan, sortOrder: index + 1, isActive: true }));

export async function seedMembershipData() {
  for (const plan of plans) {
    await MembershipPlan.updateOne(
      { name: plan.name },
      { $set: plan },
      { upsert: true, runValidators: true },
    );
  }

  await Setting.updateOne(
    { _id: DEFAULT_SETTINGS_ID },
    {
      $setOnInsert: {
        discountPercent: 50,
        pointsValidityYears: 11,
        membershipValidityYears: 25,
        maxFamilyMembers: 6,
        childAgeLimit: 18,
        earlyBirdLimit: 1000,
      },
    },
    { upsert: true, runValidators: true },
  );

  await Counter.updateOne(
    { name: 'memberNumber' },
    [{
      $set: {
        name: 'memberNumber',
        key: 'memberNumber',
        value: { $ifNull: ['$value', { $ifNull: ['$seq', 0] }] },
        seq: { $ifNull: ['$seq', { $ifNull: ['$value', 0] }] },
      },
    }],
    { upsert: true },
  );

  console.log(`Seeded ${plans.length} membership plans, default settings, and member-number counter.`);
}

async function runSeed() {
  await connectDatabase();
  await seedMembershipData();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runSeed()
    .catch((error) => {
      console.error(`[seed:membership] ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
