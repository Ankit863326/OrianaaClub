import { join } from 'node:path';
import { verificationDocumentDirectory } from './uploadDirectories.js';

export { verificationDocumentDirectory };

export function verificationDocumentPath(storageKey) {
  if (!/^[a-f\d-]{36}\.(jpg|png|webp|pdf)$/i.test(storageKey)) {
    throw new TypeError('Invalid verification document storage key.');
  }
  return join(verificationDocumentDirectory, storageKey);
}
