import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import mongoose from 'mongoose';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';

const scriptPath = fileURLToPath(import.meta.url);
const backupDirectory = resolve(dirname(scriptPath), '../backups');

export async function removeRefundRules() {
  await connectDatabase();
  const settings = mongoose.connection.collection('settings');
  const redemptions = mongoose.connection.collection('redemptions');
  const [settingsWithPolicy, redemptionsWithPercent] = await Promise.all([
    settings.find({ cancellationPolicy: { $exists: true } })
      .project({ _id: 1, cancellationPolicy: 1 })
      .toArray(),
    redemptions.find({ refundPercent: { $exists: true } })
      .project({ _id: 1, refundPercent: 1 })
      .toArray(),
  ]);

  await mkdir(backupDirectory, { recursive: true });
  const backupPath = resolve(
    backupDirectory,
    `refund-rules-backup-${new Date().toISOString().replaceAll(':', '-')}.json`,
  );
  await writeFile(backupPath, JSON.stringify({
    createdAt: new Date().toISOString(),
    settings: settingsWithPolicy,
    redemptions: redemptionsWithPercent,
  }, null, 2), { flag: 'wx' });

  const [settingsResult, redemptionsResult] = await Promise.all([
    settings.updateMany(
      { cancellationPolicy: { $exists: true } },
      { $unset: { cancellationPolicy: '' } },
    ),
    redemptions.updateMany(
      { refundPercent: { $exists: true } },
      { $unset: { refundPercent: '' } },
    ),
  ]);

  console.log(`Legacy settings cleaned: ${settingsResult.modifiedCount}`);
  console.log(`Legacy redemption percentages cleaned: ${redemptionsResult.modifiedCount}`);
  console.log(`Backup written to ${backupPath}`);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  removeRefundRules()
    .catch((error) => {
      console.error(`[remove-refund-rules] ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
