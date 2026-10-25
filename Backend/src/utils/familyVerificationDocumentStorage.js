import { join } from 'node:path';
import { verificationDocumentDirectory } from './uploadDirectories.js';

const familyVerificationDirectory = join(verificationDocumentDirectory, 'family');

export { familyVerificationDirectory };

export function familyVerificationDocumentPath(storageKey) {
  if (!/^[a-f\d-]{36}\.enc$/i.test(storageKey)) {
    throw new TypeError('Invalid family verification document storage key.');
  }
  return join(familyVerificationDirectory, storageKey);
}
