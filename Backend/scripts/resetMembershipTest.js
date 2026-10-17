import mongoose from 'mongoose';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import Counter from '../src/models/Counter.js';
import FamilyMember from '../src/models/FamilyMember.js';
import Membership from '../src/models/Membership.js';
import Payment from '../src/models/Payment.js';
import PointLedger from '../src/models/PointLedger.js';
import Redemption from '../src/models/Redemption.js';

async function resetMembershipTestData() {
  if (env.nodeEnv.toLowerCase() === 'production') {
    throw new Error('Refusing to reset membership test data in production.');
  }
  if (!process.argv.includes('--confirm')) {
    throw new Error('Pass --confirm to delete membership, points, payment, family, and redemption data.');
  }

  try {
    await connectDatabase();
    const [memberships, pointLedgers, payments, familyMembers, redemptions] = await Promise.all([
      Membership.deleteMany({}),
      PointLedger.collection.deleteMany({}),
      Payment.deleteMany({}),
      FamilyMember.deleteMany({}),
      Redemption.deleteMany({}),
      Counter.findOneAndUpdate(
        { name: 'memberNumber' },
        { $set: { name: 'memberNumber', key: 'memberNumber', value: 0, seq: 0 } },
        { new: true, upsert: true, setDefaultsOnInsert: true },
      ),
    ]);
    console.log(
      `[reset:membership-test] Deleted ${memberships.deletedCount} memberships, `
      + `${pointLedgers.deletedCount} point ledgers, ${payments.deletedCount} payments, `
      + `${familyMembers.deletedCount} family members, and ${redemptions.deletedCount} redemptions; `
      + 'reset memberNumber counter to 0. Plans, Settings, and API keys were kept.',
    );
  } finally {
    await mongoose.disconnect();
  }
}

resetMembershipTestData().catch((error) => {
  console.error(`[reset:membership-test] ${safeErrorMessage(error)}`);
  process.exitCode = 1;
});
