import { createHash, randomBytes } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import mongoose from 'mongoose';
import request from 'supertest';
import { jest } from '@jest/globals';
import { createApp } from './helpers/createApp.js';
import MembershipDraft from '../src/models/MembershipDraft.js';
import TermsConsent from '../src/models/TermsConsent.js';
import {
  buildTermsManifest,
  getCurrentTermsManifest,
  initializeTermsManifest,
} from '../src/config/terms.js';

const app = createApp();
let termsFixtureDirectory;
let draft;
let draftCookie;

async function makeDraft() {
  const token = randomBytes(32).toString('hex');
  const result = await MembershipDraft.create({
    email: `${token.slice(0, 8)}@example.invalid`,
    firstName: 'Terms',
    tokenHash: createHash('sha256').update(token).digest('hex'),
    expiresAt: new Date(Date.now() + 60_000),
    plan: new mongoose.Types.ObjectId(),
  });
  return { draft: result, cookie: `oc_membership_draft=${token}` };
}

beforeAll(async () => {
  termsFixtureDirectory = await mkdtemp(path.join(tmpdir(), 'oriana-terms-'));
  const versionDirectory = path.join(termsFixtureDirectory, 'v1');
  await mkdir(versionDirectory, { recursive: true });
  for (const code of ['hi', 'mr', 'gu', 'en']) {
    const headings = Array.from({ length: 21 }, (_, index) => (
      `<h2 id="s${index + 1}">Section ${index + 1}</h2>`
    )).join('');
    await writeFile(path.join(versionDirectory, `${code}.html`), `<main>${headings}</main>`);
    await writeFile(path.join(versionDirectory, `${code}.pdf`), Buffer.from(`%PDF-${code}`));
  }
  await initializeTermsManifest(termsFixtureDirectory);
  app.set('trust proxy', 1);
});

beforeEach(async () => {
  ({ draft, cookie: draftCookie } = await makeDraft());
});

afterAll(async () => {
  await initializeTermsManifest();
  await rm(termsFixtureDirectory, { recursive: true, force: true });
});

describe('membership agreement manifest and consent', () => {
  test('builds a data-driven manifest with per-file hashes and cache validators', async () => {
    const manifest = await buildTermsManifest(termsFixtureDirectory);
    expect(manifest).toMatchObject({
      version: 'v1',
      effectiveFrom: '2026-10-20',
      keyPoints: expect.arrayContaining([expect.stringContaining('long-term lifestyle membership')]),
    });
    expect(manifest.languages.map(({ code }) => code)).toEqual(['en', 'hi', 'mr', 'gu']);
    expect(manifest.languages.find(({ code }) => code === 'hi')).toMatchObject({
      label: 'हिन्दी',
      pdfUrl: '/terms/v1/hi.pdf',
      htmlUrl: '/terms/v1/hi.html',
      sha256: createHash('sha256')
        .update(await readFile(path.join(termsFixtureDirectory, 'v1', 'hi.html')))
        .digest('hex'),
    });
    const response = await request(app).get('/api/terms/current');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('max-age=300');
    expect(response.headers.etag).toBeTruthy();
    expect(response.body.languages).toHaveLength(4);
  });

  test('lists Hindi, Marathi, and Gujarati when optional English files are absent', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'oriana-terms-no-en-'));
    const versionDirectory = path.join(directory, 'v1');
    await mkdir(versionDirectory, { recursive: true });
    const headings = Array.from({ length: 21 }, (_, index) => (
      `<h2 id="s${index + 1}">Section ${index + 1}</h2>`
    )).join('');

    try {
      for (const code of ['hi', 'mr', 'gu']) {
        await writeFile(path.join(versionDirectory, `${code}.html`), `<main>${headings}</main>`);
        await writeFile(path.join(versionDirectory, `${code}.pdf`), Buffer.from(`%PDF-${code}`));
      }

      const manifest = await buildTermsManifest(directory);
      expect(manifest.languages.map(({ code }) => code)).toEqual(['hi', 'mr', 'gu']);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('refreshes an empty startup manifest when agreement files are added', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'oriana-terms-late-files-'));
    const versionDirectory = path.join(directory, 'v1');
    await mkdir(versionDirectory, { recursive: true });

    try {
      await initializeTermsManifest(directory);
      expect((await getCurrentTermsManifest(directory)).languages).toEqual([]);

      const headings = Array.from({ length: 21 }, (_, index) => (
        `<h2 id="s${index + 1}">Section ${index + 1}</h2>`
      )).join('');
      for (const code of ['hi', 'mr', 'gu']) {
        await writeFile(path.join(versionDirectory, `${code}.html`), `<main>${headings}</main>`);
        await writeFile(path.join(versionDirectory, `${code}.pdf`), Buffer.from(`%PDF-${code}`));
      }

      expect((await getCurrentTermsManifest(directory)).languages.map(({ code }) => code))
        .toEqual(['hi', 'mr', 'gu']);
    } finally {
      await initializeTermsManifest(termsFixtureDirectory);
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('returns an empty language list and warns when the terms directory is empty', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'oriana-terms-empty-'));
    await mkdir(path.join(directory, 'v1'));
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const manifest = await buildTermsManifest(directory);
      expect(manifest.languages).toEqual([]);
      expect(warning).toHaveBeenCalledWith(expect.stringContaining(path.join(directory, 'v1')));
      expect(warning).toHaveBeenCalledWith(expect.stringContaining('en.html, en.pdf'));

      await initializeTermsManifest(directory);
      const response = await request(app).get('/api/terms/current');
      expect(response.status).toBe(200);
      expect(response.body.languages).toEqual([]);
    } finally {
      await initializeTermsManifest(termsFixtureDirectory);
      warning.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('accepts English consent and returns the existing record for a duplicate', async () => {
    const endpoint = `/api/membership/applications/${draft._id}/terms-consent`;
    const payload = { version: 'v1', language: 'en', readToEnd: true };
    const first = await request(app)
      .post(endpoint)
      .set('Cookie', draftCookie)
      .set('User-Agent', 'TermsConsentTest/1.0')
      .send(payload);
    const second = await request(app)
      .post(endpoint)
      .set('Cookie', draftCookie)
      .set('User-Agent', 'TermsConsentTest/1.0')
      .send(payload);

    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ version: 'v1', language: 'en' });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);
  });

  test('rejects a stale version, unsupported language, and an application owned by another caller', async () => {
    const staleVersion = await request(app)
      .post(`/api/membership/applications/${draft._id}/terms-consent`)
      .set('Cookie', draftCookie)
      .send({ version: 'v0', language: 'hi', readToEnd: true });
    expect(staleVersion.status).toBe(400);

    const unsupportedLanguage = await request(app)
      .post(`/api/membership/applications/${draft._id}/terms-consent`)
      .set('Cookie', draftCookie)
      .send({ version: 'v1', language: 'zz', readToEnd: true });
    expect(unsupportedLanguage.status).toBe(400);

    const wrongOwner = await request(app)
      .post(`/api/membership/applications/${new mongoose.Types.ObjectId()}/terms-consent`)
      .set('Cookie', draftCookie)
      .send({ version: 'v1', language: 'hi', readToEnd: true });
    expect(wrongOwner.status).toBe(403);
  });

  test('stores server-side evidence, uses the proxy IP, and is idempotent', async () => {
    const endpoint = `/api/membership/applications/${draft._id}/terms-consent`;
    const first = await request(app)
      .post(endpoint)
      .set('Cookie', draftCookie)
      .set('X-Forwarded-For', '203.0.113.17')
      .set('User-Agent', 'TermsConsentTest/1.0')
      .send({
        version: 'v1',
        language: 'hi',
        readToEnd: true,
        ipAddress: '198.51.100.24',
        acceptedAt: '2000-01-01T00:00:00.000Z',
      });
    expect(first.status).toBe(201);
    expect(first.body.data).toMatchObject({ version: 'v1', language: 'hi' });

    const second = await request(app)
      .post(endpoint)
      .set('Cookie', draftCookie)
      .send({ version: 'v1', language: 'hi', readToEnd: true });
    expect(second.status).toBe(201);
    expect(second.body.data.id).toBe(first.body.data.id);

    const record = await TermsConsent.findById(first.body.data.id).lean();
    expect(record).toMatchObject({
      application_id: draft._id,
      user_id: null,
      terms_version: 'v1',
      language: 'hi',
      document_sha256: expect.stringMatching(/^[a-f\d]{64}$/),
      ip_address: '203.0.113.17',
      user_agent: 'TermsConsentTest/1.0',
      read_to_end: true,
    });
    expect(record.scroll_completed_at).toEqual(record.accepted_at);
    expect(record.accepted_at.getTime()).toBeGreaterThan(Date.now() - 10_000);
    expect(record.ip_address).not.toBe('198.51.100.24');

    const application = await request(app)
      .get(`/api/membership/applications/${draft._id}`)
      .set('Cookie', draftCookie);
    expect(application.body.data.termsConsent).toMatchObject({
      version: 'v1',
      language: 'hi',
    });
  });

  test('blocks payment-order creation when the current terms have not been accepted', async () => {
    const response = await request(app)
      .post('/api/membership/draft/purchase')
      .set('Cookie', draftCookie)
      .send({ planId: String(draft.plan), paymentMethod: 'razorpay' });
    expect(response.status).toBe(409);
    expect(response.body.code).toBe('TERMS_NOT_ACCEPTED');
  });
});
