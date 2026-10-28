import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDatabase, safeErrorMessage } from '../src/config/db.js';

const apply = process.argv.includes('--apply');
const productionConfirmation = process.argv.includes('--confirm-production');
const batchSize = 250;
const stats = {
  mode: apply ? 'apply' : 'dry-run',
  repaired: {},
  danglingOptionalReferencesCleared: {},
  unresolvedRequiredReferences: { membership: 0, payment: 0 },
  duplicateCounters: 0,
  duplicateInvoices: 0,
  indexes: [],
};

if (apply && env.nodeEnv === 'production' && !productionConfirmation) {
  throw new Error('Production repairs require both --apply and --confirm-production.');
}

function isObjectId(value) {
  return value instanceof mongoose.Types.ObjectId
    || (typeof value === 'string' && mongoose.isValidObjectId(value));
}

function idKey(value) {
  return isObjectId(value) ? String(value) : '';
}

async function idsIn(collection, values) {
  const ids = [...new Set(values.map(idKey).filter(Boolean))];
  if (!ids.length) return new Set();
  const rows = await collection.find({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } })
    .project({ _id: 1 })
    .toArray();
  return new Set(rows.map((row) => String(row._id)));
}

function bump(bucket, key, amount = 1) {
  bucket[key] = (bucket[key] || 0) + amount;
}

async function repairBatch(collection, documents, database, config) {
  const referenceSets = new Map();
  const valuesByCollection = new Map();
  for (const reference of config.references) {
    const values = valuesByCollection.get(reference.collection) || [];
    values.push(...documents.map((document) => document[reference.field]));
    valuesByCollection.set(reference.collection, values);
  }
  for (const [collectionName, values] of valuesByCollection) {
    referenceSets.set(collectionName, await idsIn(database.collection(collectionName), values));
  }
  const planIds = documents.map((document) => document.plan);
  const [legacyPlanIds, membershipPlanIds] = await Promise.all([
    idsIn(database.collection('plans'), planIds),
    idsIn(database.collection('membershipplans'), planIds),
  ]);
  const updates = [];

  for (const document of documents) {
    const set = {};
    for (const [field, value] of Object.entries(config.defaults)) {
      if (document[field] === undefined || document[field] === null) set[field] = value;
    }

    if (config.repairMemberPair) {
      const users = referenceSets.get('users');
      const user = idKey(document.user);
      const customer = idKey(document.customer);
      const usable = [user, customer].find((id) => users.has(id));
      if (usable) {
        if (!users.has(user)) set.user = new mongoose.Types.ObjectId(usable);
        if (!users.has(customer)) set.customer = new mongoose.Types.ObjectId(usable);
      } else {
        stats.unresolvedRequiredReferences.membership += 1;
      }
    }

    const model = document.planModel;
    const planId = idKey(document.plan);
    const inLegacyPlans = legacyPlanIds.has(planId);
    const inMembershipPlans = membershipPlanIds.has(planId);
    const planExists = model === 'Plan'
      ? inLegacyPlans
      : model === 'MembershipPlan'
        ? inMembershipPlans
        : inLegacyPlans || inMembershipPlans;
    if (!planExists) stats.unresolvedRequiredReferences[config.kind] += 1;
    if (!['Plan', 'MembershipPlan'].includes(model) || !planExists) {
      if (inLegacyPlans !== inMembershipPlans) {
        set.planModel = inLegacyPlans ? 'Plan' : 'MembershipPlan';
      } else if (inLegacyPlans && inMembershipPlans && !['Plan', 'MembershipPlan'].includes(model)) {
        set.planModel = 'Plan';
      }
    }

    for (const field of config.requiredReferences || []) {
      if (config.repairMemberPair && ['user', 'customer'].includes(field)) continue;
      if (!referenceSets.get(config.references.find((reference) => reference.field === field)?.collection)
        ?.has(idKey(document[field]))) {
        stats.unresolvedRequiredReferences[config.kind] += 1;
      }
    }

    for (const reference of config.references) {
      if (!reference.optional) continue;
      const value = document[reference.field];
      if (value && !referenceSets.get(reference.collection).has(idKey(value))) {
        set[reference.field] = null;
        bump(stats.danglingOptionalReferencesCleared, `${config.kind}.${reference.field}`);
      }
    }

    if (Object.keys(set).length) {
      bump(stats.repaired, config.kind);
      updates.push({ updateOne: { filter: { _id: document._id }, update: { $set: set } } });
    }
  }

  if (apply && updates.length) await collection.bulkWrite(updates, { ordered: false });
}

async function repairCollection(database, name, config) {
  const collection = database.collection(name);
  const cursor = collection.find({}).batchSize(batchSize);
  let batch = [];
  for await (const document of cursor) {
    batch.push(document);
    if (batch.length === batchSize) {
      await repairBatch(collection, batch, database, config);
      batch = [];
    }
  }
  if (batch.length) await repairBatch(collection, batch, database, config);
}

async function findDuplicates(collection, field, requireNonEmptyString = false) {
  const match = requireNonEmptyString
    ? { [field]: { $type: 'string', $gt: '' } }
    : { [field]: { $exists: true } };
  return collection.aggregate([
    { $match: match },
    { $group: { _id: `$${field}`, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 100 },
  ]).toArray();
}

async function ensureIndex(collection, field, options = {}) {
  const indexes = await collection.indexes();
  const current = indexes.find((index) => (
    Object.keys(index.key || {}).length === 1 && index.key[field] === 1
  ));
  if (current) {
    const partial = options.partialFilterExpression;
    const hasExpectedPartial = !partial || (
      current.partialFilterExpression?.[field]?.$type === partial[field].$type
      && current.partialFilterExpression?.[field]?.$gt === partial[field].$gt
    );
    if (current.unique && hasExpectedPartial) {
      stats.indexes.push(`${collection.collectionName}.${field}: already enforced`);
      return;
    }
    throw new Error(
      `${collection.collectionName}.${field} has an incompatible existing index; no index was dropped or replaced.`,
    );
  }
  await collection.createIndex({ [field]: 1 }, options);
  stats.indexes.push(`${collection.collectionName}.${field}: created`);
}

async function main() {
  await connectDatabase();
  const database = mongoose.connection.db;
  const counters = database.collection('counters');
  const payments = database.collection('payments');
  const counterDuplicates = await findDuplicates(counters, 'name');
  const invoiceDuplicates = await findDuplicates(payments, 'invoiceNumber', true);
  const missingCounterValues = await counters.countDocuments({
    $or: [{ value: { $exists: false } }, { value: null }],
  });
  if (missingCounterValues) bump(stats.repaired, 'counter', missingCounterValues);
  stats.duplicateCounters = counterDuplicates.length;
  stats.duplicateInvoices = invoiceDuplicates.length;

  await repairCollection(database, 'memberships', {
    kind: 'membership',
    repairMemberPair: true,
    defaults: {
      pointsBalance: 0,
      pointsGranted: 0,
      pointsExpiryPendingAmount: 0,
      familyVersion: 0,
      termNumber: 1,
      parentSide: null,
    },
    references: [
      { field: 'user', collection: 'users' },
      { field: 'customer', collection: 'users' },
      { field: 'approvedBy', collection: 'users', optional: true },
      { field: 'eligibilityVerifiedBy', collection: 'users', optional: true },
      { field: 'linkedTo', collection: 'memberships', optional: true },
      { field: 'previousMembership', collection: 'memberships', optional: true },
      { field: 'familyMember', collection: 'familymembers', optional: true },
      { field: 'nominee', collection: 'familymembers', optional: true },
      { field: 'pendingNominee', collection: 'familymembers', optional: true },
    ],
    requiredReferences: ['user', 'customer'],
  });
  await repairCollection(database, 'payments', {
    kind: 'payment',
    defaults: {
      reference: '',
      utr: '',
      invoiceNumber: '',
      receiptNumber: '',
      razorpayOrderId: '',
      razorpayPaymentId: '',
      refunds: [],
    },
    references: [
      { field: 'user', collection: 'users' },
      { field: 'membership', collection: 'memberships' },
      { field: 'recordedBy', collection: 'users', optional: true },
      { field: 'confirmedBy', collection: 'users', optional: true },
      { field: 'verifiedBy', collection: 'users', optional: true },
      { field: 'familyMember', collection: 'familymembers', optional: true },
    ],
    requiredReferences: ['user', 'membership'],
  });

  if (apply) {
    await counters.updateMany(
      { $or: [{ value: { $exists: false } }, { value: null }] },
      { $set: { value: 0 } },
    );
    if (counterDuplicates.length === 0) {
      await ensureIndex(counters, 'name', { unique: true });
    }
    if (invoiceDuplicates.length === 0) {
      await ensureIndex(payments, 'invoiceNumber', {
        unique: true,
        partialFilterExpression: { invoiceNumber: { $type: 'string', $gt: '' } },
      });
    }
  }

  console.log(JSON.stringify({
    ...stats,
    duplicateCounterNames: counterDuplicates.map((item) => item._id),
    duplicateInvoiceNumbers: invoiceDuplicates.map((item) => item._id),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(`Legacy data repair stopped without deleting records: ${safeErrorMessage(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
