import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import MembershipDraft from '../src/models/MembershipDraft.js';
import MembershipDraftArchive from '../src/models/MembershipDraftArchive.js';
import Payment from '../src/models/Payment.js';
import User from '../src/models/User.js';
import { connectDatabase } from '../src/config/db.js';
import { finalizeDraft } from '../src/services/admin-drafts.service.js';

function optionValue(name) {
  const index = process.argv.indexOf(name);
  if (index >= 0) return process.argv[index + 1] || '';
  return process.argv.find((argument) => argument.startsWith(`${name}=`))?.slice(name.length + 1) || '';
}

async function findPaidDrafts(email) {
  const match = {
    $and: [
      { $or: [{ status: { $in: ['paid', 'password_pending', 'active'] } }, { payment: { $ne: null } }] },
      ...(email ? [{ email: email.trim().toLowerCase() }] : []),
    ],
  };
  const [result] = await MembershipDraft.aggregate([
    { $match: match },
    {
      $lookup: {
        from: Payment.collection.name,
        let: { paymentId: '$payment', userId: '$user' },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $and: [{ $ne: ['$$paymentId', null] }, { $eq: ['$_id', '$$paymentId'] }] },
                  { $and: [{ $eq: ['$$paymentId', null] }, { $ne: ['$$userId', null] }, { $eq: ['$user', '$$userId'] }] },
                ],
              },
            },
          },
          { $sort: { createdAt: -1 } },
          { $limit: 1 },
          { $project: { status: 1 } },
        ],
        as: 'paymentRecord',
      },
    },
    {
      $match: {
        $or: [
          { status: { $in: ['paid', 'password_pending', 'active'] } },
          { 'paymentRecord.0.status': { $in: ['paid', 'confirmed'] } },
        ],
      },
    },
    { $project: { _id: 1, email: 1, status: 1, paymentRecord: 1 } },
    { $sort: { updatedAt: 1, _id: 1 } },
  ]);
  return result || [];
}

export async function cleanupPaidMembershipDrafts({
  dryRun = true,
  email = '',
  adminId = '',
} = {}) {
  await connectDatabase();
  try {
    const drafts = await findPaidDrafts(email);
    if (dryRun) {
      console.log(`Dry run: ${drafts.length} paid membership draft(s) would be finalized.`);
      drafts.forEach((draft) => {
        console.log(`${draft._id} ${draft.email} status=${draft.status} payment=${draft.paymentRecord?.[0]?.status || 'unknown'}`);
      });
      return { dryRun: true, count: drafts.length };
    }

    const resolvedAdmin = adminId
      ? await User.findOne({ _id: adminId, role: 'admin', status: 'active' }).select('_id')
      : await User.findOne({ role: 'admin', status: 'active' }).sort({ createdAt: 1 }).select('_id');
    if (!resolvedAdmin) throw new Error('An active admin account is required to finalize paid drafts.');

    let finalized = 0;
    for (const draft of drafts) {
      if (await MembershipDraftArchive.exists({ draftId: draft._id })) continue;
      await finalizeDraft(draft._id, resolvedAdmin._id);
      finalized += 1;
      console.log(`Finalized ${draft._id} (${draft.email}).`);
    }
    return { dryRun: false, count: finalized };
  } finally {
    await mongoose.disconnect();
  }
}

async function run() {
  const apply = process.argv.includes('--apply');
  const dryRun = process.argv.includes('--dry-run') || !apply;
  if (apply && process.argv.includes('--dry-run')) {
    throw new Error('Use either --dry-run or --apply, not both.');
  }
  const result = await cleanupPaidMembershipDrafts({
    dryRun,
    email: optionValue('--email'),
    adminId: optionValue('--admin-id'),
  });
  if (dryRun) console.log('No records were changed. Re-run with --apply to execute.');
  else console.log(`Finalized ${result.count} paid membership draft(s).`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch(async (error) => {
    console.error(`Paid-draft cleanup failed: ${error.message}`);
    await mongoose.disconnect().catch(() => {});
    process.exitCode = 1;
  });
}
