import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import Membership from '../src/models/Membership.js';
import Redemption from '../src/models/Redemption.js';
import { generateMemberCode } from '../src/utils/memberCode.js';

function sequenceCode(memberNumber) {
  const value = String(memberNumber ?? '');
  return /^\d{1,8}$/.test(value) && Number(value) > 0
    ? generateMemberCode(value)
    : null;
}

export async function migrateMemberCodes() {
  await connectDatabase();
  const memberships = await Membership.find({
    $or: [
      { memberCode: { $type: 'string', $gt: '' } },
      { memberNumber: { $type: 'string', $gt: '' } },
    ],
  }).select('_id memberCode memberNumber previousMembership status').lean();
  const replacementsByCode = new Map();

  for (const membership of memberships) {
    const replacement = sequenceCode(membership.memberNumber);
    if (!membership.memberCode || !replacement) continue;
    const existingReplacement = replacementsByCode.get(membership.memberCode);
    if (existingReplacement && existingReplacement !== replacement) {
      throw new Error(`Member code ${membership.memberCode} maps to multiple member numbers.`);
    }
    replacementsByCode.set(membership.memberCode, replacement);
  }

  const membershipsById = new Map(memberships.map((membership) => [
    String(membership._id),
    membership,
  ]));
  const resolvedById = new Map();
  function resolveMembershipCode(membership, visited = new Set()) {
    const id = String(membership._id);
    if (resolvedById.has(id)) return resolvedById.get(id);
    if (visited.has(id)) throw new Error(`Membership renewal chain contains a cycle at ${id}.`);
    visited.add(id);

    const byNumber = sequenceCode(membership.memberNumber);
    const byExistingCode = membership.memberCode
      ? replacementsByCode.get(membership.memberCode)
        || (/^2651\d{8}$/.test(membership.memberCode) ? membership.memberCode : null)
      : null;
    if (byNumber && byExistingCode && byNumber !== byExistingCode) {
      throw new Error(`Member code ${membership.memberCode} does not match member number ${membership.memberNumber}.`);
    }
    const previous = membership.previousMembership
      ? membershipsById.get(String(membership.previousMembership))
      : null;
    const resolved = byNumber || byExistingCode
      || (previous ? resolveMembershipCode(previous, visited) : null);
    visited.delete(id);
    if (resolved) resolvedById.set(id, resolved);
    return resolved;
  }

  const membershipOperations = [];
  for (const membership of memberships) {
    if (membership.memberNumber && !sequenceCode(membership.memberNumber)) {
      throw new Error(`Member number ${membership.memberNumber} cannot fit the 12-digit member-code format.`);
    }
    const replacement = resolveMembershipCode(membership);
    if (!replacement && membership.memberCode) {
      throw new Error(`Could not map member code ${membership.memberCode} to a member number.`);
    }
    if (replacement && membership.memberCode !== replacement) {
      membershipOperations.push({
        updateOne: {
          filter: { _id: membership._id },
          update: { $set: { memberCode: replacement } },
        },
      });
      if (membership.memberCode) replacementsByCode.set(membership.memberCode, replacement);
    }
  }

  const redemptions = await Redemption.find({ memberCode: { $type: 'string', $gt: '' } })
    .select('_id memberCode membership')
    .lean();
  const redemptionOperations = [];
  for (const redemption of redemptions) {
    if (/^2651\d{8}$/.test(redemption.memberCode)) continue;
    const membership = membershipsById.get(String(redemption.membership));
    const replacement = replacementsByCode.get(redemption.memberCode)
      || (membership ? resolveMembershipCode(membership) : null);
    if (!replacement) {
      throw new Error(`Could not map redemption member code ${redemption.memberCode}.`);
    }
    redemptionOperations.push({
      updateOne: {
        filter: { _id: redemption._id },
        update: { $set: { memberCode: replacement } },
      },
    });
  }

  if (redemptionOperations.length) await Redemption.bulkWrite(redemptionOperations);
  if (membershipOperations.length) await Membership.bulkWrite(membershipOperations);
  console.log(
    `Migrated ${membershipOperations.length} membership codes and ${redemptionOperations.length} redemption codes.`,
  );
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  migrateMemberCodes()
    .catch((error) => {
      console.error(`[db:migrate:member-codes] ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
