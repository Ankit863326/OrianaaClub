import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const uriFile = join(tmpdir(), 'orianaaclub-jest-memory-mongo-uri');

export default async function globalTeardown() {
  await globalThis.__ORIANAA_TEST_MONGO__?.stop();
  await unlink(uriFile).catch(() => {});
}
