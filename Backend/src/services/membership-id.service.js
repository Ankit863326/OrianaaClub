import Counter from '../models/Counter.js';

export async function getNextMemberNumber(session) {
  const options = { new: true, upsert: true, returnDocument: 'after' };
  if (session) options.session = session;
  const filter = { name: 'memberNumber' };
  const update = [{
    $set: {
      name: 'memberNumber',
      key: 'memberNumber',
      value: { $add: [{ $ifNull: ['$value', 0] }, 1] },
      seq: { $add: [{ $ifNull: ['$value', 0] }, 1] },
    },
  }];

  try {
    const counter = await Counter.findOneAndUpdate(filter, update, options);
    if (!counter) throw new Error('Could not allocate a member number.');
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
