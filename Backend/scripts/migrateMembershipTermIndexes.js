import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import Membership from '../src/models/Membership.js';

const targetIndexes = [
  {
    name: 'membership_user_pending_unique',
    key: { user: 1 },
    unique: true,
    partialFilterExpression: {
      status: { $in: ['draft', 'pending_payment', 'pending_verification'] },
    },
  },
  {
    name: 'membership_active_member_code_unique',
    key: { memberCode: 1 },
    unique: true,
    partialFilterExpression: {
      status: 'active',
      memberCode: { $type: 'string', $gt: '' },
    },
  },
];

async function migrateMembershipTermIndexes() {
  await connectDatabase();
  const collection = Membership.collection;
  const exists = await mongoose.connection.db
    .listCollections({ name: collection.collectionName }, { nameOnly: true })
    .hasNext();
  if (!exists) await collection.createCollection();

  const indexes = await collection.indexes();
  for (const target of targetIndexes) {
    const sameKeyIndexes = indexes.filter((index) => (
      index.unique
      && Object.keys(index.key).length === 1
      && index.key[Object.keys(target.key)[0]] === 1
    ));
    const existingTarget = sameKeyIndexes.find((index) => index.name === target.name);
    for (const index of sameKeyIndexes) {
      if (index.name !== target.name) await collection.dropIndex(index.name);
    }
    if (!existingTarget) {
      await collection.createIndex(target.key, {
        name: target.name,
        unique: true,
        partialFilterExpression: target.partialFilterExpression,
      });
    }
  }
  console.log('Membership term indexes are ready.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  migrateMembershipTermIndexes()
    .catch((error) => {
      console.error(`[db:migrate:membership-terms] ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
