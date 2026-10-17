import request from 'supertest';
import { createApp } from './helpers/createApp.js';

// Authentication responses must not be cached by browsers or proxies.
describe('authentication cache headers', () => {
  test.each(['/api/auth/me', '/api/admin/auth/me'])('%s is not cacheable', async (route) => {
    const response = await request(createApp()).get(route);
    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
  });
});
