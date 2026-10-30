import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import Event from '../src/models/Event.js';
import Post from '../src/models/Post.js';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';
import { slugify } from '../src/utils/slugify.js';

const models = [
  { name: 'post', Model: Post, fallback: 'post' },
  { name: 'event', Model: Event, fallback: 'event' },
];

export async function backfillContentSlugs({ dryRun = true } = {}) {
  await connectDatabase();
  try {
    let updated = 0;
    for (const { name, Model, fallback } of models) {
      const records = await Model.find().select('_id title slug').sort({ createdAt: 1, _id: 1 }).lean();
      const occupied = new Set(
        records.map(({ slug }) => String(slug || '').trim().toLowerCase()).filter(Boolean),
      );
      const missing = records.filter(({ slug }) => !String(slug || '').trim());

      for (const record of missing) {
        const base = slugify(record.title) || fallback;
        let candidate = base;
        let suffix = 2;
        while (occupied.has(candidate)) {
          candidate = `${base}-${suffix}`;
          suffix += 1;
        }
        occupied.add(candidate);

        if (dryRun) {
          console.log(`Would set ${name} ${record._id} slug to "${candidate}".`);
        } else {
          const result = await Model.collection.updateOne(
            { _id: record._id, $or: [{ slug: { $exists: false } }, { slug: null }, { slug: '' }, { slug: /^\s*$/ }] },
            { $set: { slug: candidate } },
          );
          if (result.modifiedCount !== 1) {
            throw new Error(`${name} ${record._id} changed before its slug could be set.`);
          }
          console.log(`Set ${name} ${record._id} slug to "${candidate}".`);
        }
        updated += 1;
      }
    }

    console.log(`${dryRun ? 'Would update' : 'Updated'} ${updated} content slug(s).`);
    return { dryRun, updated };
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
  if (dryRun) console.log('Dry run enabled; no records will be changed.');
  await backfillContentSlugs({ dryRun });
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run().catch((error) => {
    console.error(`[db:backfill:content-slugs] ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  });
}
