import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

const uriFile = join(tmpdir(), 'orianaaclub-jest-memory-mongo-uri');

export default async function globalSetup() {
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  globalThis.__ORIANAA_TEST_MONGO__ = mongo;
  const uri = mongo.getUri('oriana_test');

  if (!/_(test)|memory/i.test(uri)) {
    await mongo.stop();
    throw new Error('Refusing to start tests: the MongoDB URI is not clearly test-only.');
  }

  await writeFile(uriFile, uri, { encoding: 'utf8', mode: 0o600 });
}
