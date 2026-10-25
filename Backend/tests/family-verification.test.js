import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { jest } from '@jest/globals';
import FamilyMember from '../src/models/FamilyMember.js';
import Membership from '../src/models/Membership.js';
import Verification from '../src/models/Verification.js';
import VerificationEmailCode from '../src/models/VerificationEmailCode.js';
import VerificationDocumentAccess from '../src/models/VerificationDocumentAccess.js';
import IdentityVerification from '../src/models/IdentityVerification.js';
import AuditLog from '../src/models/AuditLog.js';
import { createMember, createPlan, createAdmin } from './helpers/factories.js';
import request from 'supertest';
import app from '../src/app.js';
import {
  calculateVerificationDueAt,
  confirmFamilyVerificationCode,
  decideFamilyVerification,
  getAdminFamilyVerificationDetail,
  getFamilyVerificationStatus,
  invalidateVerificationAfterProfileChange,
  removeFamilyVerificationForNominee,
  readSignedFamilyVerificationDocument,
  runFamilyVerificationOverdueJob,
  saveFamilyVerificationDraft,
  sendFamilyVerificationCode,
  submitFamilyVerificationDocuments,
} from '../src/services/family-verification.service.js';
import { hashIdentityValue, decryptDocumentFile, encryptDocumentFile } from '../src/utils/identityDocumentCrypto.js';
import { familyVerificationDocumentPath } from '../src/utils/familyVerificationDocumentStorage.js';
import { calculateMemberPrice } from '../src/services/pricing.service.js';
import {
  familyVerificationCodeSchema,
  familyVerificationSubmitSchema,
} from '../src/validators/family-verification.schema.js';

let nextMembershipNo = 100;

async function createOwnedFamily({ relation = 'mother', email = '', nominee = false, overrides = {} } = {}) {
  const plan = await createPlan();
  const owner = await createMember({
    membership: { plan: plan._id, status: 'active', memberNo: String(nextMembershipNo++), ...overrides },
  });
  const member = await FamilyMember.create({
    membership: owner.membership._id,
    name: nominee ? 'Nominee Name' : 'Family Name',
    relation,
    email,
    workEmail: nominee ? 'nominee.work@example.invalid' : '',
    memberType: nominee
      ? 'nominee'
      : relation === 'mother'
        ? 'mother'
        : ['son', 'daughter', 'child'].includes(relation)
          ? 'child'
          : 'spouse',
    isNominee: nominee,
    type: 'adult',
  });
  return { owner, member };
}

function sentCode() {
  const call = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)?.[0];
  const match = call?.html?.match(/>(\d{6})</);
  if (!match) throw new Error('The email test transport did not receive a six-digit code.');
  return match[1];
}

describe('family verification email codes', () => {
  beforeEach(() => globalThis.__orianaMailTransport.sendMail.mockClear());

  test('uses the primary email for a parent without an email and stores only a hash', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'mother' });
    const now = new Date('2026-06-01T10:00:00.000Z');
    const result = await sendFamilyVerificationCode(owner.user._id, member._id, '192.0.2.10', now);
    const record = await VerificationEmailCode.findOne({ memberId: member._id }).select('+codeHash +ipHash');
    const code = sentCode();
    const mail = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0];

    expect(result.codeSentTo).toBe('primary');
    expect(mail.to).toBe(owner.user.email);
    expect(record.codeHash).not.toContain(code);
    expect(record.ipHash).not.toContain('192.0.2.10');
    await expect(sendFamilyVerificationCode(owner.user._id, member._id, '192.0.2.10', new Date(now.getTime() + 29_000)))
      .rejects.toMatchObject({ statusCode: 429 });
    await confirmFamilyVerificationCode(owner.user._id, member._id, code, new Date(now.getTime() + 31_000));
    expect((await Verification.findOne({ memberId: member._id })).emailConfirmedAt).toBeTruthy();
  });

  test('expires codes after ten minutes and locks after five incorrect attempts', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'mother' });
    const now = new Date('2026-06-01T10:00:00.000Z');
    await sendFamilyVerificationCode(owner.user._id, member._id, '192.0.2.11', now);
    const code = sentCode();
    await expect(confirmFamilyVerificationCode(owner.user._id, member._id, code, new Date(now.getTime() + 10 * 60_000)))
      .rejects.toMatchObject({ statusCode: 400 });

    await sendFamilyVerificationCode(owner.user._id, member._id, '192.0.2.12', new Date(now.getTime() + 31_000));
    const validCode = sentCode();
    const incorrectCode = validCode === '000000' ? '000001' : '000000';
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(confirmFamilyVerificationCode(
        owner.user._id,
        member._id,
        incorrectCode,
        new Date(now.getTime() + 32_000 + attempt),
      )).rejects.toMatchObject({ statusCode: 400 });
    }
    const record = await VerificationEmailCode.findOne({ memberId: member._id });
    expect(record.attempts).toBe(5);
    await expect(confirmFamilyVerificationCode(owner.user._id, member._id, validCode))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  test('sends nominee codes to work email and confirms without a Verification document', async () => {
    const { owner, member } = await createOwnedFamily({ nominee: true });
    await sendFamilyVerificationCode(owner.user._id, member._id, '192.0.2.13');
    const mail = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0];
    expect(mail.to).toBe(member.workEmail);
    expect(mail.html).toContain('No identity documents are required');
    expect(await Verification.countDocuments({ memberId: member._id })).toBe(0);

    await confirmFamilyVerificationCode(owner.user._id, member._id, sentCode());
    const updated = await FamilyMember.findById(member._id);
    expect(updated.emailConfirmedAt).toBeTruthy();
    expect(updated.status).toBe('active');
    expect(updated.approvalSeq).toBeGreaterThan(0);
    expect(await Verification.countDocuments({ memberId: member._id })).toBe(0);
  });

  test('sends a minor child code to the primary email even when the child has an email', async () => {
    const { owner, member } = await createOwnedFamily({
      relation: 'son',
      email: 'child@example.invalid',
    });
    member.dob = new Date('2012-06-01T00:00:00.000Z');
    await member.save();
    await sendFamilyVerificationCode(owner.user._id, member._id, '192.0.2.14');
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].to).toBe(owner.user.email);
    expect((await Verification.findOne({ memberId: member._id })).codeSentTo).toBe('primary');
  });

  test('rate limits code sending per IP across different family members', async () => {
    const owner = await createOwnedFamily({ relation: 'mother' });
    for (let index = 0; index < 5; index += 1) {
      const member = await FamilyMember.create({
        membership: owner.owner.membership._id,
        name: `Parent ${index}`,
        relation: 'mother',
        memberType: 'mother',
      });
      await sendFamilyVerificationCode(owner.owner.user._id, member._id, '192.0.2.15');
    }
    const sixth = await FamilyMember.create({
      membership: owner.owner.membership._id,
      name: 'Sixth Parent',
      relation: 'mother',
      memberType: 'mother',
    });
    await expect(sendFamilyVerificationCode(owner.owner.user._id, sixth._id, '192.0.2.15'))
      .rejects.toMatchObject({ statusCode: 429 });
  });

  test('rate limits code sending per family member across different IPs', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'mother' });
    const start = new Date('2026-06-01T10:00:00.000Z');
    for (let index = 0; index < 5; index += 1) {
      await sendFamilyVerificationCode(
        owner.user._id,
        member._id,
        `192.0.3.${index + 1}`,
        new Date(start.getTime() + index * 31_000),
      );
    }
    await expect(sendFamilyVerificationCode(
      owner.user._id,
      member._id,
      '192.0.3.6',
      new Date(start.getTime() + 5 * 31_000),
    )).rejects.toMatchObject({ statusCode: 429 });
  });

  test('prevents access to another member’s family profile', async () => {
    const { member } = await createOwnedFamily({ relation: 'mother' });
    const other = await createMember();
    await expect(getFamilyVerificationStatus(other.user._id, member._id))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('binds confirmation to the email address that received the code', async () => {
    const { owner, member } = await createOwnedFamily({
      relation: 'wife',
      email: 'original@example.invalid',
    });
    await sendFamilyVerificationCode(owner.user._id, member._id, '192.0.2.16');
    const code = sentCode();
    member.email = 'updated@example.invalid';
    await member.save();
    await expect(confirmFamilyVerificationCode(owner.user._id, member._id, code))
      .rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('family document verification', () => {
  beforeEach(() => globalThis.__orianaMailTransport.sendMail.mockClear());

  test('saves a draft, stores encrypted documents, and returns no expiry fields to members', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'wife', email: 'family@example.invalid' });
    const now = new Date('2026-06-05T10:00:00.000Z');
    await saveFamilyVerificationDraft(owner.user._id, member._id, {
      relation: 'wife',
      docType: 'aadhaar_digilocker',
      nameOnDocument: 'Family Name',
      relationLine: `W/O ${owner.profile.fullName}`,
      applicantAddress: '',
    });
    const verification = await Verification.findOne({ memberId: member._id });
    verification.emailConfirmedAt = now;
    await verification.save();
    const image = { buffer: Buffer.from([0xff, 0xd8, 0xff, 0x00]), mimetype: 'image/jpeg' };
    const result = await submitFamilyVerificationDocuments(
      owner.user._id,
      member._id,
      {
        relation: 'wife',
        docType: 'aadhaar_digilocker',
        aadhaarNumber: '236323869904',
        nameOnDocument: 'Family Name',
        relationLine: `W/O ${owner.profile.fullName}`,
      },
      { document: image },
      now,
    );
    const stored = await Verification.findOne({ memberId: member._id }).select('+aadhaarHash');
    const encrypted = await readFile(familyVerificationDocumentPath(stored.fileRef));
    const status = await getFamilyVerificationStatus(owner.user._id, member._id);
    const allKeys = JSON.stringify(status);

    expect(stored.status).toBe('pending');
    expect(stored.aadhaarHash).toBe(hashIdentityValue('236323869904'));
    expect(decryptDocumentFile(encrypted)).toEqual(image.buffer);
    expect(result.nonRefundableNotice).toBeUndefined();
    expect(allKeys).not.toMatch(/expiresAt|dueAt|expiry/i);
    expect(status.nonRefundableNotice).toBe(true);
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].html)
      .toContain('within one working day');
    await unlink(familyVerificationDocumentPath(stored.fileRef));
  });

  test('blocks duplicate Aadhaar hashes and requires the husband extra document', async () => {
    const first = await createOwnedFamily({ relation: 'wife' });
    const second = await createOwnedFamily({ relation: 'wife' });
    const husband = await createOwnedFamily({ relation: 'husband' });
    await Verification.create({
      memberId: first.member._id,
      status: 'not_added',
      emailConfirmedAt: new Date(),
      aadhaarHash: hashIdentityValue('236323869904'),
    });
    await Verification.create({
      memberId: second.member._id,
      status: 'not_added',
      emailConfirmedAt: new Date(),
      relation: 'wife',
    });
    await Verification.create({
      memberId: husband.member._id,
      status: 'not_added',
      emailConfirmedAt: new Date(),
      relation: 'husband',
    });
    const image = { buffer: Buffer.from([0xff, 0xd8, 0xff]), mimetype: 'image/jpeg' };
    await expect(submitFamilyVerificationDocuments(
      second.owner.user._id,
      second.member._id,
      { relation: 'wife', docType: 'aadhaar_upload', aadhaarNumber: '236323869904' },
      { document: image },
    )).rejects.toMatchObject({ statusCode: 409 });
    await expect(submitFamilyVerificationDocuments(
      husband.owner.user._id,
      husband.member._id,
      { relation: 'husband', docType: 'aadhaar_upload', aadhaarNumber: '236323869904' },
      { document: image },
    )).rejects.toThrow('marriage certificate');
    await expect(submitFamilyVerificationDocuments(
      husband.owner.user._id,
      husband.member._id,
      {
        relation: 'husband',
        docType: 'aadhaar_upload',
        extraDocType: 'family_card',
        aadhaarNumber: '236323869904',
      },
      { document: image, extraDocument: image },
    )).rejects.toThrow('must be a marriage certificate');

    const primaryDuplicate = await createOwnedFamily({ relation: 'wife' });
    await Verification.create({
      memberId: primaryDuplicate.member._id,
      status: 'not_added',
      emailConfirmedAt: new Date(),
      relation: 'wife',
    });
    await IdentityVerification.create({
      user: primaryDuplicate.owner.user._id,
      panCiphertext: 'cipher',
      panMask: 'ABCDE****F',
      idType: 'aadhaar',
      idCiphertext: 'cipher',
      idMask: 'XXXX XXXX 9904',
      aadhaarLast4: '9904',
      aadhaarHash: hashIdentityValue('236323869904'),
      consentAt: new Date(),
    });
    await expect(submitFamilyVerificationDocuments(
      primaryDuplicate.owner.user._id,
      primaryDuplicate.member._id,
      { relation: 'wife', docType: 'aadhaar_upload', aadhaarNumber: '236323869904' },
      { document: image },
    )).rejects.toMatchObject({ statusCode: 409 });
  });

  test('admin detail masks both identity numbers and signed document links expire', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'wife' });
    const verification = await Verification.create({
      memberId: member._id,
      status: 'pending',
      relation: 'wife',
      emailConfirmedAt: new Date(),
      aadhaarLast4: '9904',
      aadhaarHash: hashIdentityValue('236323869904'),
      fileRef: '12345678-1234-1234-1234-123456789012.enc',
      fileMimeType: 'image/jpeg',
      submittedAt: new Date(),
      dueAt: new Date(Date.now() + 60_000),
    });
    await IdentityVerification.create({
      user: owner.user._id,
      panCiphertext: 'cipher',
      panMask: 'ABCDE****F',
      idType: 'aadhaar',
      idCiphertext: 'cipher',
      idMask: 'XXXX XXXX 0007',
      aadhaarLast4: '0007',
      aadhaarHash: hashIdentityValue('236323860007'),
      consentAt: new Date(),
    });
    const key = familyVerificationDocumentPath(verification.fileRef);
    const admin = await createAdmin();
    const detail = await getAdminFamilyVerificationDetail(admin.user._id, member._id);
    expect(detail.verification.aadhaar).toBe('XXXX-XXXX-9904');
    expect(detail.primary.aadhaar).toBe('XXXX-XXXX-0007');
    expect(detail.checks.contactConfirmed.status).toBe('ok');
    expect(detail.checks.aadhaarHashUnique.status).toBe('ok');
    expect(detail.verification.documentUrl).not.toContain('expiresAt');

    await mkdir(dirname(key), { recursive: true });
    await writeFile(key, encryptDocumentFile(Buffer.from('private family document')));
    const readableToken = new URL(detail.verification.documentUrl, 'https://api.example.invalid').searchParams.get('token');
    const viewed = await readSignedFamilyVerificationDocument(admin.user._id, readableToken);
    expect(viewed.buffer.toString()).toBe('private family document');
    const viewAudit = await AuditLog.findOne({
      action: 'family_verification.document.document.viewed',
      entityId: String(member._id),
    });
    expect(viewAudit).toBeTruthy();
    expect(viewAudit.memberNo).toBeTruthy();

    const refreshedDetail = await getAdminFamilyVerificationDetail(admin.user._id, member._id);
    const refreshedToken = new URL(refreshedDetail.verification.documentUrl, 'https://api.example.invalid').searchParams.get('token');
    const refreshedTokenHash = createHash('sha256').update(refreshedToken).digest('hex');
    await VerificationDocumentAccess.updateOne(
      { tokenHash: refreshedTokenHash },
      { $set: { expiresAt: new Date(0) } },
    );
    await expect(readSignedFamilyVerificationDocument(admin.user._id, refreshedToken))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(await Membership.findById(owner.membership._id)).toBeTruthy();
    expect(key).toContain('family');
  });

  test('validates upload type and the 5 MB server-side limit', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'wife' });
    const invalidType = await request(app)
      .post(`/api/member/family/${member._id}/verification/documents`)
      .set('Cookie', owner.cookie)
      .attach('document', Buffer.from('not an image'), {
        filename: 'document.txt',
        contentType: 'text/plain',
      });
    expect(invalidType.status).toBe(400);

    const oversized = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(5 * 1024 * 1024),
    ]);
    const tooLarge = await request(app)
      .post(`/api/member/family/${member._id}/verification/documents`)
      .set('Cookie', owner.cookie)
      .attach('document', oversized, {
        filename: 'document.jpg',
        contentType: 'image/jpeg',
      });
    expect(tooLarge.status).toBe(413);
  });

  test('sends a single overdue admin alert and records approve or re-upload decisions', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'wife', email: 'family@example.invalid' });
    const admin = await createAdmin();
    const verification = await Verification.create({
      memberId: member._id,
      status: 'pending',
      relation: 'wife',
      submittedAt: new Date(Date.now() - 3 * 86_400_000),
      dueAt: new Date(Date.now() - 86_400_000),
      fileRef: '12345678-1234-1234-1234-123456789012.enc',
    });
    const queueResponse = await request(app)
      .get('/api/admin/family-verifications')
      .set('Cookie', admin.cookie);
    expect(queueResponse.status).toBe(200);
    expect(queueResponse.body.data[0]).toMatchObject({ memberId: member._id.toString(), overdue: true });
    expect(await runFamilyVerificationOverdueJob()).toEqual({ notified: 1 });
    expect(await runFamilyVerificationOverdueJob()).toEqual({ notified: 0 });
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls.filter(
      ([mail]) => mail.subject === 'Family verification review is overdue',
    )).toHaveLength(1);
    expect((await Verification.findById(verification._id)).overdueNotifiedAt).toBeTruthy();
    expect((await Verification.findById(verification._id)).overdueAt).toBeTruthy();

    const result = await decideFamilyVerification(admin.user._id, member._id, 'request_reupload', 'Image is unreadable.');
    expect(result).toMatchObject({ status: 'rejected', rejectionReason: 'Image is unreadable.' });
    expect(await AuditLog.findOne({
      action: 'family.verification.reupload_requested',
      entityId: String(member._id),
      memberNo: owner.membership.memberNo,
    })).toMatchObject({
      reason: 'Image is unreadable.',
      after: { status: 'rejected', discountReleased: false },
    });
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].html).toContain('Image is unreadable.');
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].html)
      .toContain(`/dashboard/family/${member._id}/verification`);
    await Verification.updateOne({ _id: verification._id }, { $set: { status: 'pending' } });
    await expect(decideFamilyVerification(admin.user._id, member._id, 'approve'))
      .resolves.toMatchObject({ status: 'verified' });
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].subject)
      .toBe('Your family verification is complete.');
    expect(await AuditLog.findOne({
      action: 'family.verification.approved',
      entityId: String(member._id),
      memberNo: owner.membership.memberNo,
    })).toMatchObject({ after: { status: 'verified', discountReleased: true } });
    const auditResponse = await request(app)
      .get(`/api/admin/audit-logs?memberNo=${encodeURIComponent(owner.membership.memberNo)}&action=family.verification.approved`)
      .set('Cookie', admin.cookie);
    expect(auditResponse.status).toBe(200);
    expect(auditResponse.body.data.items.some((entry) => entry.entityId === String(member._id))).toBe(true);
  });

  test('calculates the next working day and never exposes review deadlines to members', async () => {
    expect(calculateVerificationDueAt(new Date('2026-06-05T12:00:00.000Z')))
      .toEqual(new Date('2026-06-08T12:00:00.000Z'));
  });

  test('only unlocks the family rate after an administrator verifies the profile', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'wife' });
    const pricingRequest = {
      plan: { slug: 'founder-legacy', price: 300000 },
      memberType: 'spouse',
      member: { _id: member._id, memberType: 'spouse' },
      linkedPrimary: owner.membership,
    };
    await expect(calculateMemberPrice(pricingRequest))
      .rejects.toMatchObject({ statusCode: 409 });
    await Verification.create({ memberId: member._id, status: 'verified' });
    await expect(calculateMemberPrice(pricingRequest)).resolves.toMatchObject({ discountPct: 50 });
  });

  test('invalidates verification when identity-bearing profile fields change', async () => {
    const { owner, member } = await createOwnedFamily({ relation: 'wife' });
    const record = await Verification.create({ memberId: member._id, status: 'verified' });
    const before = member.toObject();
    member.name = 'Updated Family Name';
    await member.save();
    await invalidateVerificationAfterProfileChange(member, before, owner.user._id, 'member');
    await expect(Verification.findById(record._id)).resolves.toMatchObject({
      status: 'rejected',
      rejectionReason: 'Family profile details changed; submit documents again.',
    });
  });

  describe('family verification validation', () => {
    test('validates six-digit codes and the family document types', () => {
      expect(familyVerificationCodeSchema.safeParse({ code: '123456' }).success).toBe(true);
      expect(familyVerificationCodeSchema.safeParse({ code: '12345' }).success).toBe(false);
      const validSubmission = {
        relation: 'daughter',
        docType: 'aadhaar_digilocker',
        aadhaarNumber: '236323869904',
      };
      expect(familyVerificationSubmitSchema.safeParse(validSubmission).success).toBe(true);
      expect(familyVerificationSubmitSchema.safeParse({
        ...validSubmission,
        docType: 'sms_otp',
      }).success).toBe(false);
    });
  });

  test('removes identity verification records and document access when a profile becomes a nominee', async () => {
    const { member } = await createOwnedFamily({ relation: 'wife' });
    const admin = await createAdmin();
    const record = await Verification.create({
      memberId: member._id,
      status: 'verified',
      fileRef: '12345678-1234-1234-1234-123456789012.enc',
    });
    await VerificationDocumentAccess.create({
      tokenHash: 'a'.repeat(64),
      verificationId: record._id,
      familyMemberId: member._id,
      documentKind: 'document',
      fileRef: record.fileRef,
      mimeType: 'image/jpeg',
      expiresAt: new Date(Date.now() + 60_000),
    });
    await removeFamilyVerificationForNominee(admin.user._id, member._id);
    expect(await Verification.countDocuments({ memberId: member._id })).toBe(0);
    expect(await VerificationDocumentAccess.countDocuments({ verificationId: record._id })).toBe(0);
  });
});
