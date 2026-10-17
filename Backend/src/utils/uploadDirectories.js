import { chmod, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { env } from '../config/env.js';

export const publicMediaDirectory = join(env.uploadDir, 'public-media');
export const identityDocumentDirectory = join(env.uploadDir, 'private', 'identity');
export const verificationDocumentDirectory = join(env.uploadDir, 'private', 'verification');

export async function ensureUploadDirectories() {
  await mkdir(publicMediaDirectory, { recursive: true, mode: 0o750 });
  await mkdir(identityDocumentDirectory, { recursive: true, mode: 0o700 });
  await mkdir(verificationDocumentDirectory, { recursive: true, mode: 0o700 });
  await chmod(publicMediaDirectory, 0o750);
  await chmod(identityDocumentDirectory, 0o700);
  await chmod(verificationDocumentDirectory, 0o700);
}
