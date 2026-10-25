import Counter from '../models/Counter.js';

function requireTransactionSession(session) {
  if (!session || typeof session.withTransaction !== 'function' || !session.inTransaction()) {
    throw new TypeError('Approval sequences must be assigned inside an active MongoDB transaction.');
  }
}

export async function assignSeqBatch(session, count) {
  requireTransactionSession(session);
  if (!Number.isSafeInteger(count) || count < 1) {
    throw new TypeError('Sequence batch count must be a positive safe integer.');
  }

  const counter = await Counter.findOneAndUpdate(
    { name: 'approvalSeq' },
    [{
      $set: {
        name: 'approvalSeq',
        key: 'approvalSeq',
        value: {
          $add: [
            { $max: [{ $ifNull: ['$value', 0] }, { $ifNull: ['$seq', 0] }] },
            count,
          ],
        },
        seq: {
          $add: [
            { $max: [{ $ifNull: ['$value', 0] }, { $ifNull: ['$seq', 0] }] },
            count,
          ],
        },
      },
    }],
    { new: true, upsert: true, session },
  );
  if (!counter || !Number.isSafeInteger(counter.value)) {
    throw new RangeError('Approval sequence exceeds the supported integer range.');
  }
  const first = counter.value - count + 1;
  return Array.from({ length: count }, (_, index) => first + index);
}

export async function assignApprovalSeq(session) {
  const [sequence] = await assignSeqBatch(session, 1);
  return sequence;
}
