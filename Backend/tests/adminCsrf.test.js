import adminCsrf from '../src/middleware/adminCsrf.js';

function runGuard(method, headerValue) {
  let nextCalled = false;
  let statusCode = 200;
  let responseBody;
  const request = {
    method,
    get: (name) => (name === 'X-Admin-Request' ? headerValue : undefined),
  };
  const response = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      responseBody = body;
      return this;
    },
  };

  adminCsrf(request, response, () => { nextCalled = true; });
  return { nextCalled, statusCode, responseBody };
}

// Browser state-changing requests need the custom admin header.
describe('admin CSRF guard', () => {
  test.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s requires X-Admin-Request: 1', (method) => {
    const result = runGuard(method);
    expect(result.nextCalled).toBe(false);
    expect(result.statusCode).toBe(403);
    expect(result.responseBody.message).toBe('Missing or invalid X-Admin-Request header.');
  });

  test.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s accepts the expected header', (method) => {
    expect(runGuard(method, '1').nextCalled).toBe(true);
  });

  test('safe requests do not require the custom header', () => {
    expect(runGuard('GET').nextCalled).toBe(true);
  });
});
