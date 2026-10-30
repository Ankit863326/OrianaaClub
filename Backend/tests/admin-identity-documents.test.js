import { jest } from '@jest/globals';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import request from 'supertest';
import { createAdmin, createMember, createPlan } from './helpers/factories.js';
import { createApp } from './helpers/createApp.js';
import IdentityVerification from '../src/models/IdentityVerification.js';
import MembershipDraftArchive from '../src/models/MembershipDraftArchive.js';
import { encryptDocumentFile } from '../src/utils/identityDocumentCrypto.js';
import { identityDocumentDirectory, identityDocumentPath } from '../src/utils/identityDocumentStorage.js';

const app = createApp();
const storedFiles = new Set();

function adminRequest(admin, method, path) {
  return request(app)[method](path).set('Cookie', admin.cookie).set('X-Admin-Request', '1');
}

async function storeDocument() {
  await mkdir(identityDocumentDirectory, { recursive: true });
  const storageKey = `${randomUUID()}.enc`;
  const filePath = identityDocumentPath(storageKey);
  await writeFile(filePath, encryptDocumentFile(Buffer.from('private identity proof')), { flag: 'wx' });
  storedFiles.add(filePath);
  return storageKey;
}

async function createIdentityForMember(member, { stored = true, userId = member.user._id } = {}) {
  const documentId = randomUUID();
  return IdentityVerification.create({
    user: userId,
    panCiphertext: 'encrypted-pan',
    panMask: 'ABCDE****F',
    idType: 'driving_licence',
    idCiphertext: 'encrypted-licence',
    idMask: 'KA**1234',
    status: 'pending',
    consentAt: new Date(),
    documents: [{
      id: documentId,
      kind: 'pan_front',
      storageKey: stored ? await storeDocument() : `${randomUUID()}.enc`,
      mimeType: 'application/pdf',
    }],
  });
}

afterEach(async () => {
  jest.restoreAllMocks();
  await Promise.all([...storedFiles].map((filePath) => unlink(filePath).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  })));
  storedFiles.clear();
});

describe('admin identity document access', () => {
  test('serves a document through its membership id and user id', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'pending_verification' } });
    const identity = await createIdentityForMember(member);

    const response = await adminRequest(
      admin,
      'get',
      `/api/admin/memberships/${member.membership._id}/identity-documents/${identity.documents[0].id}`,
    );

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.body.toString()).toBe('private identity proof');
  });

  test('finds a document saved under the original draft id', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'pending_verification' } });
    const draftId = new mongoose.Types.ObjectId();
    const identity = await createIdentityForMember(member, { userId: draftId });
    await MembershipDraftArchive.create({
      draftId,
      user: member.user._id,
      membership: member.membership._id,
      snapshot: {},
    });

    const response = await adminRequest(
      admin,
      'get',
      `/api/admin/memberships/${member.membership._id}/identity-documents/${identity.documents[0].id}`,
    );

    expect(response.status).toBe(200);
    expect(response.body.toString()).toBe('private identity proof');
  });

  test('distinguishes a missing storage file and still permits identity rejection', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'pending_verification' } });
    const identity = await createIdentityForMember(member, { stored: false });

    const missing = await adminRequest(
      admin,
      'get',
      `/api/admin/memberships/${member.membership._id}/identity-documents/${identity.documents[0].id}`,
    );
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('File missing. Ask the member to re-upload.');

    const rejected = await adminRequest(
      admin,
      'patch',
      `/api/admin/memberships/${member.membership._id}/identity-verification`,
    ).send({ status: 'rejected', reason: 'File missing. Ask the member to re-upload.' });
    expect(rejected.status).toBe(200);
    expect(rejected.body.data).toMatchObject({
      status: 'rejected',
      rejectionReason: 'File missing. Ask the member to re-upload.',
    });
  });

  test('denies identity document requests without administrator permission', async () => {
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'pending_verification' } });
    const identity = await createIdentityForMember(member);
    const response = await request(app)
      .get(`/api/admin/memberships/${member.membership._id}/identity-documents/${identity.documents[0].id}`);

    expect([401, 403]).toContain(response.status);
  });
});
