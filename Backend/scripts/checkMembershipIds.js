import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { getNextMemberNumber } from '../src/services/membership-id.service.js';
import { formatMemberCode, generateMemberCode } from '../src/utils/memberCode.js';

export async function verifyMembershipIds() {
  const numbers = await Promise.all(Array.from({ length: 20 }, () => getNextMemberNumber()));
  if (new Set(numbers).size !== numbers.length) {
    throw new Error('Concurrent member-number generation produced duplicates.');
  }
  const codes = numbers.map(generateMemberCode);
  if (new Set(codes).size !== codes.length) {
    throw new Error('Member-code generation produced duplicates.');
  }
  return { numbers, codes };
}

async function checkMembershipIds() {
  await connectDatabase();
  const { numbers, codes } = await verifyMembershipIds();
  console.log(`Verified ${numbers.length} unique member numbers and ${codes.length} unique 12-digit member codes.`);
  console.log(`Example formatted member code: ${formatMemberCode(codes[0])}`);
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
