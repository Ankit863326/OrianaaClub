// Phase 6: Load every Mongoose model and synchronize its declared database indexes.
import mongoose from 'mongoose';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { env } from '../src/config/env.js';

const modelsDirectory = fileURLToPath(new URL('../src/models/', import.meta.url));

async function syncIndexes() {
  if (env.nodeEnv === 'production' && env.confirmIndexSync !== 'YES') {
    throw new Error('Production index synchronization can remove undeclared indexes. Set CONFIRM_INDEX_SYNC=YES after reviewing the index plan.');
  }

  await connectDatabase();
  const files = (await readdir(modelsDirectory)).filter((file) => file.endsWith('.js'));
  for (const file of files) {
    await import(pathToFileURL(join(modelsDirectory, file)).href);
  }

  for (const modelName of mongoose.modelNames()) {
    const model = mongoose.model(modelName);
    const changedIndexes = await model.syncIndexes();
    console.log(`Synchronized indexes for ${modelName}: ${changedIndexes.length} changed.`);
  }
}

syncIndexes()
  .catch((error) => {
    console.error(`[db:indexes] ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
