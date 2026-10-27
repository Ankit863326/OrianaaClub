import Counter from '../models/Counter.js';
import { MEMBER_ID_COUNTER_NAME } from '../config/member-id.js';
import { buildMemberId } from '../utils/memberCode.js';

export async function getNextMemberIdSequence(session) {
  const options = { new: true, upsert: true, returnDocument: 'after' };
  if (session) options.session = session;
  const filter = { name: MEMBER_ID_COUNTER_NAME };
  const update = [{
    $set: {
      name: MEMBER_ID_COUNTER_NAME,
      key: MEMBER_ID_COUNTER_NAME,
      value: { $add: [{ $ifNull: ['$value', 0] }, 1] },
      seq: { $add: [{ $ifNull: ['$value', 0] }, 1] },
    },
  }];

  try {
    const counter = await Counter.findOneAndUpdate(filter, update, options);
    if (!counter) throw new Error('Could not allocate a member ID sequence.');
    return counter.seq;
  } catch (error) {
    if (error?.code !== 11000) throw error;

    const counter = await Counter.findOneAndUpdate(
      filter,
      update,
      { ...options, upsert: false },
    );
    if (!counter) throw error;
    return counter.seq;
  }
}

export async function allocateMemberId({ activatedAt, expiresAt, suffix = '', session }) {
  const sequence = await getNextMemberIdSequence(session);
  return buildMemberId({ activatedAt, expiresAt, sequence, suffix });
}
