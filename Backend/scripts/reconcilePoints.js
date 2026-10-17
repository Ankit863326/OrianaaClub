// Phase 3: Compare stored membership balances with the net total of ledger entries.
import mongoose from 'mongoose';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { reconcileBalances } from '../src/services/points.service.js';

async function reconcilePoints() {
  await connectDatabase();
  const { mismatchCount, mismatches } = await reconcileBalances();
  if (mismatchCount) {
    for (const mismatch of mismatches) {
      console.error(`Mismatch membership=${mismatch.membershipId} stored=${mismatch.storedBalance} ledger=${mismatch.ledgerBalance}`);
    }
    console.error(`Points reconciliation found ${mismatchCount} mismatch(es).`);
    process.exitCode = 1;
  } else {
    console.log('Points reconciliation passed: every membership balance matches its ledger.');
  }
}

reconcilePoints()
  .catch((error) => {
    console.error(`[points:reconcile] Reconciliation could not complete: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
