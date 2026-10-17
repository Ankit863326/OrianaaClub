import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import ApiError from './ApiError.js';

function encryptionKey() {
  if (!env.identityDocumentEncryptionKeyIsValid) {
    const error = new ApiError(
      503,
      'Identity document encryption is not configured. Set IDENTITY_DOCUMENT_ENCRYPTION_KEY in Backend/.env.',
    );
    error.code = 'IDENTITY_DOCUMENT_ENCRYPTION_NOT_CONFIGURED';
    throw error;
  }
  return Buffer.from(env.identityDocumentEncryptionKey, 'hex');
}

export function encryptIdentityValue(value) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
}

export function decryptIdentityValue(encoded) {
  const key = encryptionKey();
  const payload = Buffer.from(encoded, 'base64');
  if (payload.length < 29) throw new ApiError(500, 'Stored identity data could not be read.');
  const decipher = createDecipheriv('aes-256-gcm', key, payload.subarray(0, 12));
  decipher.setAuthTag(payload.subarray(12, 28));
  return Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8');
}

export function hashIdentityValue(value) {
  return createHmac('sha256', encryptionKey()).update(value, 'utf8').digest('hex');
}

export function encryptDocumentFile(buffer) {
  const key = encryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptDocumentFile(buffer) {
  const key = encryptionKey();
  if (buffer.length < 29) throw new ApiError(500, 'Stored identity document could not be read.');
  const decipher = createDecipheriv('aes-256-gcm', key, buffer.subarray(0, 12));
  decipher.setAuthTag(buffer.subarray(12, 28));
  return Buffer.concat([decipher.update(buffer.subarray(28)), decipher.final()]);
}
