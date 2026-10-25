import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import Counter from '../src/models/Counter.js';
import Membership from '../src/models/Membership.js';

// Rollback: restore a pre-migration database snapshot for exact reversal. This
// migration preserves every record, but status normalization and default fields
// are not safely reversible by simply unsetting the values it wrote.
const migratedStatuses = new Set([
  'profile_only',
  'payment_pending',
  'pending_approval',
  'active',
]);

function normalizeStatus(status) {
  if (migratedStatuses.has(status)) return { status, legacyStatus: '' };
  const statusMap = {
    draft: 'profile_only',
    pending_payment: 'payment_pending',
    pending_verification: 'pending_approval',
    expired: 'profile_only',
    cancelled: 'profile_only',
  };
  return {
    status: statusMap[status] || 'profile_only',
    legacyStatus: status || '',
  };
}

export async function migrateFamilyMembership() {
  const memberships = await Membership.collection
    .find({ memberType: { $in: [null, ''] } })
    .project({ _id: 1, status: 1, memberNumber: 1 })
    .toArray();

  const operations = memberships.map(({ _id, status, memberNumber }) => {
    const normalized = normalizeStatus(status);
    return {
      updateOne: {
        filter: { _id, memberType: { $in: [null, ''] } },
        update: {
          $set: {
            memberType: 'primary',
            memberNo: memberNumber || '',
            linkedTo: null,
            parentSide: null,
            earlyBird: false,
            discountPct: 0,
            status: normalized.status,
            legacyStatus: normalized.legacyStatus,
          },
        },
      },
    };
  });

  if (operations.length) await Membership.collection.bulkWrite(operations);

  await Counter.updateOne(
    { name: 'approvalSeq' },
    { $setOnInsert: { name: 'approvalSeq', key: 'approvalSeq', value: 0, seq: 0 } },
    { upsert: true },
  );

  console.log(`Migrated ${operations.length} existing memberships to primary members.`);
}

async function runMigration() {
  await connectDatabase();
  await migrateFamilyMembership();
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runMigration()
    .catch((error) => {
      console.error(`[db:migrate:family-membership] ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
