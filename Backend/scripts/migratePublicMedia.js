import { constants } from 'node:fs';
import { chmod, copyFile, mkdir, readdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  identityDocumentDirectory,
  publicMediaDirectory,
  verificationDocumentDirectory,
} from '../src/utils/uploadDirectories.js';

const legacyDirectories = [
  [fileURLToPath(new URL('../uploads/', import.meta.url)), publicMediaDirectory],
  [fileURLToPath(new URL('../private-uploads/identity/', import.meta.url)), identityDocumentDirectory],
  [fileURLToPath(new URL('../private-uploads/verification/', import.meta.url)), verificationDocumentDirectory],
];

async function moveFiles(sourceDirectory, destinationDirectory) {
  let entries;
  try {
    entries = await readdir(sourceDirectory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return 0;
    throw error;
  }

  const isPrivateDirectory = destinationDirectory !== publicMediaDirectory;
  await mkdir(destinationDirectory, { recursive: true, mode: isPrivateDirectory ? 0o700 : 0o750 });
  await chmod(destinationDirectory, isPrivateDirectory ? 0o700 : 0o750);
  let migrated = 0;
  for (const entry of entries) {
    if (entry.isDirectory() && path.resolve(sourceDirectory, entry.name) === path.resolve(destinationDirectory)) {
      continue;
    }
    if (!entry.isFile()) {
      throw new Error(`Unexpected non-file entry in a legacy upload directory: ${entry.name}`);
    }
    const source = path.join(sourceDirectory, entry.name);
    const destination = path.join(destinationDirectory, entry.name);
    await copyFile(source, destination, constants.COPYFILE_EXCL);
    await chmod(destination, isPrivateDirectory ? 0o600 : 0o640);
    await unlink(source);
    migrated += 1;
  }
  return migrated;
}

async function migrateUploads() {
  let total = 0;
  for (const [source, destination] of legacyDirectories) {
    total += await moveFiles(source, destination);
  }
  console.log(`Moved ${total} legacy file(s) into UPLOAD_DIR subdirectories.`);
}

migrateUploads().catch((error) => {
  console.error(`[uploads:migrate] ${error.message}`);
  process.exitCode = 1;
});
