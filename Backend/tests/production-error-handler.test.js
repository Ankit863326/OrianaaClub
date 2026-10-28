import { jest } from '@jest/globals';

// Production responses must hide stack traces and unexpected internal details.
jest.unstable_mockModule('../../src/config/env.js', () => ({
  env: { nodeEnv: 'production' },
}));

const { default: errorHandler } = await import('../src/middleware/errorHandler.js');

test('production error handler returns a safe action message and hides stack', () => {
  const response = {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  errorHandler(new Error('private detail'), {}, response, () => {});
  expect(response.statusCode).toBe(500);
  expect(response.body.message).toBe('The server could not complete this request. Please try again shortly.');
  expect(response.body).not.toHaveProperty('stack');
});

test('production error handler gives a safe message for duplicate records', () => {
  const response = {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  errorHandler({ name: 'MongoServerError', code: 11000, message: 'duplicate private-index detail' }, {}, response, () => {});
  expect(response.statusCode).toBe(409);
  expect(response.body.message).toBe('A record with the same unique value already exists. Refresh and try again.');
});

test('production error handler returns the safe identity-encryption configuration message', () => {
  const response = {
    headersSent: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
  };
  const error = new Error(
    'Identity document encryption is not configured. Set IDENTITY_DOCUMENT_ENCRYPTION_KEY in Backend/.env.',
  );
  error.code = 'IDENTITY_DOCUMENT_ENCRYPTION_NOT_CONFIGURED';

  errorHandler(error, {}, response, () => {});

  expect(response.statusCode).toBe(503);
  expect(response.body).toEqual({
    message: 'Identity document encryption is not configured. Set IDENTITY_DOCUMENT_ENCRYPTION_KEY in Backend/.env.',
  });
});
