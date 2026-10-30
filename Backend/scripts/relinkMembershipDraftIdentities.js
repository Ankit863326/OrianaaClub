import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Membership from '../src/models/Membership.js';
import MembershipDraftArchive from '../src/models/MembershipDraftArchive.js';
import IdentityVerification from '../src/models/IdentityVerification.js';
import User from '../src/models/User.js';
import { connectDatabase } from '../src/config/db.js';

export async function relinkArchivedIdentityVerifications({ dryRun = true } = {}) {
  const archives = await MembershipDraftArchive.find({
    user: { $ne: null },
    membership: { $ne: null },
  }).select('user membership snapshot').lean();
  let relinked = 0;
  let skipped = 0;

  for (const archive of archives) {
    const identity = archive.snapshot?.identity;
    if (!identity?.panCiphertext || !identity?.idCiphertext) continue;

    const membership = await Membership.findOne({
      _id: archive.membership,
      user: archive.user,
    }).select('_id').lean();
    if (!membership || !await User.exists({ _id: archive.user, deletedAt: null })) {
      skipped += 1;
      console.warn(`Skipped archive ${archive._id}: member or membership reference is unavailable.`);
      continue;
    }

    const matches = await IdentityVerification.find({
      panCiphertext: identity.panCiphertext,
      idCiphertext: identity.idCiphertext,
    }).select('+panCiphertext +idCiphertext').lean();
    if (matches.length !== 1) {
      skipped += 1;
      if (matches.length > 1) {
        console.warn(`Skipped archive ${archive._id}: identity record match is ambiguous.`);
      }
      continue;
    }

    const [record] = matches;
    if (String(record.user) === String(archive.user)) continue;
    const targetRecord = await IdentityVerification.exists({
      user: archive.user,
      _id: { $ne: record._id },
    });
    if (targetRecord) {
      skipped += 1;
      console.warn(`Skipped archive ${archive._id}: target member already has an identity record.`);
      continue;
    }

    if (dryRun) {
      console.log(`Would relink identity record ${record._id} to member ${archive.user} (membership ${archive.membership}).`);
      relinked += 1;
      continue;
    }

    const result = await IdentityVerification.updateOne(
      { _id: record._id, user: record.user },
      { $set: { user: archive.user } },
    );
    if (result.modifiedCount !== 1) {
      throw new Error(`Identity record ${record._id} changed before it could be relinked.`);
    }
    console.log(`Relinked identity record ${record._id} to member ${archive.user}.`);
    relinked += 1;
  }

  return { dryRun, relinked, skipped };
}

async function run() {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;
  if (apply && process.argv.includes('--dry-run')) {
    throw new Error('Use either --dry-run or --apply, not both.');
  }
  await connectDatabase();
  try {
    const result = await relinkArchivedIdentityVerifications({ dryRun });
    console.log(`${dryRun ? 'Dry run' : 'Complete'}: ${result.relinked} identity record(s) ${dryRun ? 'would be relinked' : 'relinked'}; ${result.skipped} skipped.`);
    if (dryRun) console.log('No records were changed. Re-run with --apply to execute.');
  } finally {
    await mongoose.disconnect();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch(async (error) => {
    console.error(`Identity verification relink failed: ${error.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
