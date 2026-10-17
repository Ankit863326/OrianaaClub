import { join } from 'node:path';
import { identityDocumentDirectory } from './uploadDirectories.js';

export { identityDocumentDirectory };

export function identityDocumentPath(storageKey) {
  if (!/^[a-f\d-]{36}\.enc$/i.test(storageKey)) {
    throw new TypeError('Invalid identity document storage key.');
  }
  return join(identityDocumentDirectory, storageKey);
}
