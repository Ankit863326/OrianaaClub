// Seed the public membership catalog by slug so running this script is repeatable.
import mongoose from 'mongoose';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import Plan from '../src/models/Plan.js';

const planDefinitions = [
  {
    slug: 'founder-legacy',
    name: 'Founder Legacy',
    subtitle: '3 Lakhs Standard',
    price: 300000,
    benefits: [
      { points: 600000, label: 'First 1,000 members' },
      { points: 480000, label: 'Next members only' },
      { points: 420000, label: 'Standard points' },
    ],
  },
  {
    slug: 'platinum-crest',
    name: 'Platinum Crest',
    subtitle: '5 Lakhs Standard',
    price: 500000,
    benefits: [
      { points: 1050000, label: 'First 1,000 members' },
      { points: 850000, label: 'Next members only' },
      { points: 750000, label: 'Standard points' },
    ],
  },
  {
    slug: 'imperial-signature',
    name: 'Imperial Signature',
    subtitle: '7 Lakhs Standard',
    price: 700000,
    benefits: [
      { points: 1550000, label: 'First 1,000 members' },
      { points: 1260000, label: 'Next members only' },
      { points: 1190000, label: 'Standard points' },
    ],
  },
  {
    slug: 'presidential-elite',
    name: 'Presidential Elite',
    subtitle: '10 Lakhs Standard',
    price: 1000000,
    benefits: [
      { points: 2300000, label: 'First 1,000 members' },
      { points: 2050000, label: 'Next members only' },
      { points: 1800000, label: 'Standard points' },
    ],
  },
  {
    slug: 'chairmans-privilege',
    name: "Chairman's Privilege",
    subtitle: '15 Lakhs Standard',
    price: 1500000,
    benefits: [
      { points: 3600000, label: 'First 1,000 members' },
      { points: 3000000, label: 'Next members only' },
      { points: 2700000, label: 'Standard points' },
    ],
  },
  {
    slug: 'founder-circle',
    name: 'Founder Circle',
    subtitle: '25 Lakhs Standard',
    price: 2500000,
    benefits: [
      { points: 6250000, label: 'First 200 members' },
      { points: 5250000, label: 'Next members only' },
      { points: 4750000, label: 'Standard points' },
    ],
  },
  {
    slug: 'corporate',
    name: 'Corporate',
    subtitle: 'Maximum 4 Directors',
    price: 2000000,
    benefits: [
      { points: 4000000, label: 'First 1,000 members' },
      { points: 3500000, label: 'Next members only' },
      { points: 3000000, label: 'Standard points' },
    ],
  },
  {
    slug: 'privileged',
    name: 'Privileged',
    subtitle: 'Armed Forces & Gazetted Officers',
    price: 700000,
    benefits: [
      { points: 1400000, label: 'First 1,000 members' },
      { points: 1200000, label: 'Next members only' },
      { points: 950000, label: 'Standard points' },
    ],
  },
];

function legacyPointsTiers(benefits) {
  return benefits.map((benefit, index) => ({
    label: benefit.label,
    points: benefit.points,
    fromMember: index === 0 ? 1 : 1001,
    toMember: index === 0 ? (benefit.label.includes('200') ? 200 : 1000) : null,
  }));
}

async function seedPlans() {
  await connectDatabase();

  for (const [index, definition] of planDefinitions.entries()) {
    const points = definition.benefits.map(({ points: value, label }) => ({ amount: value, label }));
    const price = definition.price;
    const gst = Math.round(price * 18) / 100;
    const setFields = {
      ...definition,
      id: definition.slug,
      title: definition.name,
      numericPrice: price,
      gstPercent: 18,
      legacyCheckoutPayable: price + gst,
      cohorts: points,
      benefitsTitle: definition.name,
      benefitsCohorts: points,
      pointsTiers: legacyPointsTiers(definition.benefits),
      termYears: 25,
      displayOrder: index + 1,
      sortOrder: index + 1,
      maxFamilyMembers: 4,
      isActive: true,
      isFeatured: definition.slug === 'platinum-crest',
      displayPrice: `₹${price.toLocaleString('en-IN')}`,
      familyRules: ['Up to 4 additional family profiles during application.'],
    };

    await Plan.updateOne(
      { slug: definition.slug },
      {
        $set: setFields,
        $setOnInsert: {
          planFee: price,
          gst,
          total: price + gst,
          finalPayableRuleNote: 'The payable amount is calculated by the server from the selected plan.',
        },
      },
      { upsert: true, runValidators: true },
    );
  }

  console.log(`Seeded ${planDefinitions.length} membership plans by slug.`);
}

seedPlans()
  .catch((error) => {
    console.error(`[seed:plans] ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
