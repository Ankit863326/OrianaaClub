import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { getNextMemberIdSequence } from '../src/services/member-id.service.js';
import { buildMemberId, formatMemberCode } from '../src/utils/memberCode.js';

export async function verifyMembershipIds() {
  const sequences = await Promise.all(Array.from({ length: 20 }, () => getNextMemberIdSequence()));
  const dates = { activatedAt: new Date('2026-01-01T00:00:00.000Z'), expiresAt: new Date('2051-01-01T00:00:00.000Z') };
  const codes = sequences.map((sequence) => buildMemberId({ ...dates, sequence }));
  if (new Set(codes).size !== codes.length) {
    throw new Error('Concurrent member ID generation produced duplicates.');
  }
  return { numbers: sequences, codes };
}

async function checkMembershipIds() {
  await connectDatabase();
  const { numbers, codes } = await verifyMembershipIds();
  console.log(`Verified ${numbers.length} unique member ID sequences and ${codes.length} unique member IDs.`);
  console.log(`Example formatted member ID: ${formatMemberCode(codes[0])}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  checkMembershipIds()
    .catch((error) => {
      console.error(`[check:membership-ids] ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
