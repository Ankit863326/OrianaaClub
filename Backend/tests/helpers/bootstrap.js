import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { jest } from '@jest/globals';

const backendDirectory = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const fakeEnvPath = join(backendDirectory, '.env.test');

dotenv.config({ path: fakeEnvPath, override: true });
process.env.IDENTITY_DOCUMENT_ENCRYPTION_KEY = '0123456789abcdef'.repeat(4);
process.env.NODE_ENV = 'test';
process.env.ACTIVATION_TEST_MONGODB_URI = 'memory-test-only';

let memoryUri;
try {
  memoryUri = readFileSync(join(tmpdir(), 'orianaaclub-jest-memory-mongo-uri'), 'utf8').trim();
} catch {
  throw new Error('Refusing to run tests: the in-memory MongoDB URI is unavailable.');
}

if (!/_(test)|memory/i.test(memoryUri)) {
  throw new Error('Refusing to run tests: MONGODB_URI must contain "_test" or "memory".');
}
process.env.MONGODB_URI = memoryUri;

// These fakes make accidental external service calls fail locally and predictably.
globalThis.__orianaMailTransport = {
  sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
};
globalThis.__orianaRazorpayClient = {
  orders: { create: jest.fn().mockResolvedValue({ id: 'order_test_1' }) },
  payments: {
    fetch: jest.fn().mockResolvedValue({
      order_id: 'order_test_1',
      amount: 145612,
      currency: 'INR',
      status: 'captured',
    }),
    refund: jest.fn().mockResolvedValue({ id: 'refund_test_1' }),
  },
};

jest.unstable_mockModule('nodemailer', () => ({
  default: {
    createTransport: jest.fn(() => globalThis.__orianaMailTransport),
  },
}));

jest.unstable_mockModule('razorpay', () => ({
  default: jest.fn(() => globalThis.__orianaRazorpayClient),
}));

globalThis.fetch = jest.fn(async (input) => {
  const url = String(input);
  if (!url.startsWith('https://www.google.com/recaptcha/api/siteverify')) {
    throw new Error(`Blocked external fetch in tests: ${url}`);
  }
  return { ok: true, json: async () => ({ success: true }) };
});
