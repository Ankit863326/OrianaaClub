import { unlink } from 'node:fs/promises';
import { jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import auth from '../src/middleware/auth.js';
import adminAuth from '../src/middleware/adminAuth.js';
import requireRole from '../src/middleware/requireRole.js';
import validate from '../src/middleware/validate.js';
import { profileSchema } from '../src/validators/member.schema.js';
import errorHandler from '../src/middleware/errorHandler.js';
import { eventImageUpload, postImageUpload, profilePhotoUpload } from '../src/middleware/upload.js';
import { sanitizeMongoQuery } from '../src/middleware/noSqlSanitizer.js';
import noSqlSanitizer from '../src/middleware/noSqlSanitizer.js';
import { createAdmin, createMember } from './helpers/factories.js';
import { createApp } from './helpers/createApp.js';
import path from 'node:path';
import { publicMediaDirectory } from '../src/utils/uploadDirectories.js';

// Minimal Express apps let middleware tests focus on status and request behavior.
function errorTestApp(middleware) {
  const app = express();
  app.get('/', middleware, (req, res) => res.json({ ok: true }));
  app.use(errorHandler);
  return app;
}

describe('authentication boundaries', () => {
  test('member cookie authenticates member APIs and not admin APIs', async () => {
    const { cookie } = await createMember();
    const app = createApp();
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/admin/auth/me').set('Cookie', cookie)).status).toBe(403);
  });

  test('admin cookie authenticates admin APIs and not member APIs', async () => {
    const { cookie } = await createAdmin();
    const app = createApp();
    expect((await request(app).get('/api/admin/auth/me').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/auth/me').set('Cookie', cookie)).status).toBe(401);
  });

  test('member auth rejects missing, malformed, and suspended accounts', async () => {
    const app = errorTestApp(auth);
    expect((await request(app).get('/')).status).toBe(401);
    expect((await request(app).get('/').set('Cookie', 'oc_access=not-a-jwt')).status).toBe(401);
    const member = await createMember({ status: 'suspended' });
    expect((await request(app).get('/').set('Cookie', member.cookie)).status).toBe(401);
  });

  test('role guard rejects unauthenticated and disallowed roles', async () => {
    const app = errorTestApp((req, res, next) => {
      req.user = req.headers.role ? { role: req.headers.role } : undefined;
      return requireRole('admin')(req, res, next);
    });
    expect((await request(app).get('/')).status).toBe(403);
    expect((await request(app).get('/').set('role', 'member')).status).toBe(403);
    expect((await request(app).get('/').set('role', 'admin')).status).toBe(200);
  });
});

describe('request validation and file upload', () => {
  test('JSON and URL-encoded requests can exceed the former 1 MB body limit', async () => {
    const app = createApp();
    const largeValue = 'x'.repeat(1024 * 1024 + 1);
    const json = await request(app).post('/api/auth/forgot-password').send({ email: largeValue });
    const urlencoded = await request(app).post('/api/auth/forgot-password')
      .type('form')
      .send(`email=${largeValue}`);
    expect(json.status).toBe(400);
    expect(urlencoded.status).toBe(400);
  });

  test('validation attaches parsed data and returns 400 for invalid input', async () => {
    const app = express();
    app.use(express.json());
    app.post('/', validate(profileSchema), (req, res) => res.json(req.validated.body));
    app.use(errorHandler);
    const valid = {
      fullName: 'Test Member', gender: 'other', countryCode: '+91',
      mobile: '9000000000', dob: '1990-01-01', interestArea: 'Travel',
    };
    expect((await request(app).post('/').send(valid)).status).toBe(200);
    expect((await request(app).post('/').send({ ...valid, gender: 'invalid' })).status).toBe(400);
  });

  test('upload rejects unsupported mime types and oversized files', async () => {
    const app = express();
    app.post('/photo', profilePhotoUpload, (req, res) => res.json({ uploaded: Boolean(req.file) }));
    app.use(errorHandler);
    const badType = await request(app).post('/photo')
      .attach('photo', Buffer.from('not an image'), { filename: 'bad.pdf', contentType: 'application/pdf' });
    expect(badType.status).toBe(400);
    const tooLarge = await request(app).post('/photo')
      .attach('photo', Buffer.alloc(10 * 1024 * 1024 + 1, 1), { filename: 'large.png', contentType: 'image/png' });
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body.message).toBe('Image must be 10 MB or smaller.');
    const invalidSignature = await request(app).post('/photo')
      .attach('photo', Buffer.from('plain text'), { filename: 'fake.png', contentType: 'image/png' });
    expect(invalidSignature.status).toBe(400);
    const validPngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect((await request(app).post('/photo')
      .attach('photo', validPngHeader, { filename: 'ok.png', contentType: 'image/png' })).status).toBe(200);
  });

  test('content image uploads accept valid signatures and remove the temporary test files', async () => {
    const app = express();
    app.post('/post-image', postImageUpload, (req, res) => res.json({ url: req.file.publicUrl }));
    app.post('/event-image', eventImageUpload, (req, res) => res.json({ url: req.file.publicUrl }));
    app.use(errorHandler);
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const createdUrls = [];
    try {
      const post = await request(app).post('/post-image')
        .attach('coverImage', png, { filename: 'post.png', contentType: 'image/png' });
      if (post.body.url) createdUrls.push(post.body.url);
      const event = await request(app).post('/event-image')
        .attach('image', png, { filename: 'event.png', contentType: 'image/png' });
      if (event.body.url) createdUrls.push(event.body.url);
      expect(post.status).toBe(200);
      expect(event.status).toBe(200);
    } finally {
      await Promise.all(createdUrls.map((url) => (
        unlink(path.join(publicMediaDirectory, path.basename(url))).catch(() => {})
      )));
    }
  });

  test('content image uploads reject files over 10 MB with a friendly response', async () => {
    const app = express();
    app.post('/post-image', postImageUpload, (req, res) => res.json({ uploaded: true }));
    app.use(errorHandler);
    const tooLarge = await request(app).post('/post-image')
      .attach('coverImage', Buffer.alloc(10 * 1024 * 1024 + 1), {
        filename: 'oversized.png',
        contentType: 'image/png',
      });
    expect(tooLarge.status).toBe(413);
    expect(tooLarge.body.message).toBe('Image must be 10 MB or smaller.');
  });

  test('public registration is not available', async () => {
    const response = await request(createApp()).post('/api/auth/register').send({});
    expect(response.status).toBe(404);
  });
});

describe('error responses and NoSQL input sanitizing', () => {
  test('development errors include a stack but not headers-sent errors are reprocessed', () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const response = {
      headersSent: false,
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    errorHandler(new Error('broken Bearer test-secret'), { method: 'GET', path: '/payments' }, response, jest.fn());
    expect(response.json.mock.calls[0][0]).toHaveProperty('stack');
    expect(response.json.mock.calls[0][0].message).toContain('broken');
    expect(response.json.mock.calls[0][0].message).not.toContain('test-secret');
    expect(log.mock.calls[0][0]).toContain('Error: broken Bearer [redacted]');
    expect(response.status).toHaveBeenCalledWith(500);
    const next = jest.fn();
    errorHandler(new Error('late failure'), {}, { headersSent: true }, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'late failure' }));
    log.mockRestore();
  });

  test('removes operator and dotted keys recursively without damaging raw buffers', () => {
    expect(sanitizeMongoQuery({
      email: { $ne: 'x' },
      'profile.hidden': true,
      nested: [{ $where: 'bad', name: 'safe' }],
    })).toEqual({ email: {}, nested: [{ name: 'safe' }] });
    const raw = Buffer.from('signature payload');
    expect(sanitizeMongoQuery(raw)).toBe(raw);
  });

  test('sanitizes query and JSON body before a route can use them', async () => {
    const app = express();
    app.use(express.json());
    app.use(noSqlSanitizer);
    app.post('/echo', (req, res) => res.json({ query: req.query, body: req.body }));
    const response = await request(app).post('/echo?name=1&%24where=bad&nested.value=no')
      .send({ email: { $ne: 'unsafe' }, visible: 'safe' });
    expect(response.body).toEqual({
      query: { name: '1' },
      body: { email: {}, visible: 'safe' },
    });
  });

  test('health route responds from the real app', async () => {
    const apiHealth = await request(createApp()).get('/api/health');
    const rootHealth = await request(createApp()).get('/health');
    expect(apiHealth.status).toBe(200);
    expect(apiHealth.body).toEqual({
      status: 'ok',
      database: 'connected',
      replicaSet: 'connected',
    });
    expect(rootHealth.status).toBe(200);
    expect(rootHealth.body).toEqual(apiHealth.body);
  });

  test('credentialed CORS accepts configured origins and rejects unknown origins', async () => {
    const app = createApp();
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.status).toBe(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const rejected = await request(app).get('/api/health').set('Origin', 'https://unknown.invalid');
    expect(rejected.status).toBe(403);
  });
});
