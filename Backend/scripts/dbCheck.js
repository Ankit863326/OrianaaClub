// Phase 0: Ping MongoDB Atlas and exit successfully only when the database responds.
import mongoose from 'mongoose';
import { logConnectionFailure } from '../src/config/db.js';
import { env } from '../src/config/env.js';

try {
  await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 10000 });
  await mongoose.connection.db.admin().ping();
  console.log(`MongoDB ping succeeded: ${env.mongodbHost}/${env.mongodbDatabase}`);
  await mongoose.disconnect();
} catch (error) {
  logConnectionFailure('db:check', error);
  await mongoose.disconnect().catch(() => {});
  process.exitCode = 1;
}
