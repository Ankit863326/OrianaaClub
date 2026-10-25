import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import TermsConsent from '../src/models/TermsConsent.js';

async function migrateTermsConsents() {
  await connectDatabase();
  const collection = TermsConsent.collection;
  const exists = await mongoose.connection.db
    .listCollections({ name: collection.collectionName }, { nameOnly: true })
    .hasNext();
  if (!exists) await collection.createCollection();
  await collection.createIndex(
    { application_id: 1, terms_version: 1 },
    { name: 'terms_consents_application_version' },
  );
  await collection.createIndex(
    { application_id: 1, terms_version: 1, language: 1 },
    { name: 'terms_consents_application_version_language_unique', unique: true },
  );
  console.log('Terms consent collection and indexes are ready.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  migrateTermsConsents()
    .catch((error) => {
      console.error(`[db:migrate:terms-consents] ${safeErrorMessage(error)}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect();
    });
}
