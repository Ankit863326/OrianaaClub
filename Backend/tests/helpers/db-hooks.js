import mongoose from 'mongoose';

export async function clearDatabase() {
  const { collections } = mongoose.connection;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

globalThis.beforeAll(async () => {
  const uri = process.env.MONGODB_URI || '';
  if (!/_(test)|memory/i.test(uri)) {
    throw new Error('Refusing to connect tests: MONGODB_URI must contain "_test" or "memory".');
  }
  await mongoose.connect(uri);
});

globalThis.afterEach(async () => {
  await clearDatabase();
});

globalThis.afterAll(async () => {
  await mongoose.disconnect();
});
