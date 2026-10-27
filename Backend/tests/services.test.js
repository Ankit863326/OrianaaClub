import { jest } from '@jest/globals';
import { createHmac } from 'node:crypto';
import EmailToken from '../src/models/EmailToken.js';
import EmailCooldown from '../src/models/EmailCooldown.js';
import EmailLog from '../src/models/EmailLog.js';
import AuditLog from '../src/models/AuditLog.js';
import MembershipDraft from '../src/models/MembershipDraft.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import Payment from '../src/models/Payment.js';
import Membership from '../src/models/Membership.js';
import PointLedger from '../src/models/PointLedger.js';
import PointsLedger from '../src/models/PointsLedger.js';
import Redemption from '../src/models/Redemption.js';
import PointsTransaction from '../src/models/PointsTransaction.js';
import TermsConsent from '../src/models/TermsConsent.js';
import { createAdmin, createMember, createPlan } from './helpers/factories.js';
import {
  consumeEmailToken,
  createEmailToken,
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyEmailToken,
  verifyRefreshToken,
} from '../src/services/token.service.js';
import { sendMail } from '../src/services/mail.service.js';
import {
  activateAccount,
  inspectActivation,
  requestDraftPasswordLink,
} from '../src/services/auth.service.js';
import { verifyRecaptcha } from '../src/services/recaptcha.service.js';
import { listActivePlans, findActivePlan } from '../src/services/plan.service.js';
import { recordAdminAction, recordAdminAuthAttempt } from '../src/services/audit.service.js';
import * as pointsService from '../src/services/points.service.js';
import { formatMemberId, getMembershipCohort, getPointsTier } from '../src/services/membership.service.js';
import { createRazorpayOrder, finalizePayment, verifyRazorpayPayment } from '../src/services/payment.service.js';
import { verifyMembershipDraftRazorpayPayment } from '../src/services/membership-draft.service.js';
import { cancelRedemption, createBillingApiKey } from '../src/services/billing.service.js';

async function acceptTerms(applicationId, userId = null) {
  const acceptedAt = new Date();
  return TermsConsent.create({
    application_id: applicationId,
    user_id: userId,
    terms_version: 'v1',
    language: 'hi',
    document_sha256: 'a'.repeat(64),
    accepted_at: acceptedAt,
    ip_address: '127.0.0.1',
    user_agent: 'service-test',
    read_to_end: true,
    scroll_completed_at: acceptedAt,
  });
}

// These service tests use the in-memory database and the shared fake integrations.
describe('single-use tokens and signed sessions', () => {
  test('stores only a hash, verifies, and consumes an email token once', async () => {
    const { user } = await createMember();
    const token = await createEmailToken(user._id, 'activation');
    const record = await EmailToken.findOne({ user: user._id, type: 'activation' });
    expect(token).toMatch(/^[a-f\d]{64}$/);
    expect(record.tokenHash).not.toBe(token);
    expect((await verifyEmailToken(token.toUpperCase(), 'activation')).user._id.toString()).toBe(user._id.toString());
    await consumeEmailToken(token, 'activation');
    await expect(consumeEmailToken(token, 'activation')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('replaces old tokens, rejects expired tokens, and rejects unknown token types', async () => {
    const { user } = await createMember();
    const older = await createEmailToken(user._id, 'reset');
    const newer = await createEmailToken(user._id, 'reset');
    expect(older).not.toBe(newer);
    expect(await EmailToken.countDocuments({ user: user._id, type: 'reset' })).toBe(1);
    await EmailToken.updateOne({ user: user._id, type: 'reset' }, { $set: { expiresAt: new Date(0) } });
    await expect(verifyEmailToken(newer, 'reset')).rejects.toMatchObject({ statusCode: 400 });
    await expect(createEmailToken(user._id, 'unknown')).rejects.toThrow('Unsupported email token type');
  });

  test('signs and verifies access and refresh tokens and rejects expiry or wrong token use', async () => {
    const { user } = await createMember();
    expect(verifyAccessToken(signAccessToken(user._id)).sub).toBe(user._id.toString());
    expect(verifyRefreshToken(signRefreshToken(user._id)).sub).toBe(user._id.toString());
    await expect(Promise.resolve().then(() => verifyAccessToken(signRefreshToken(user._id))))
      .rejects.toMatchObject({ statusCode: 401 });
    const jwt = (await import('jsonwebtoken')).default;
    const expired = jwt.sign({ tokenUse: 'access' }, process.env.JWT_ACCESS_SECRET, {
      subject: user._id.toString(), expiresIn: -1,
    });
    expect(() => verifyAccessToken(expired)).toThrow(expect.objectContaining({ statusCode: 401 }));
  });
});

describe('redemption cancellation', () => {
  test('cancels without calculating or crediting points', async () => {
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'active', pointsBalance: 350 },
    });
    const admin = await createAdmin();
    const apiKey = await createBillingApiKey(admin.user._id, 'Cancellation test');
    const billId = 'manual-cancellation-test';
    const redemption = await Redemption.create({
      membership: member.membership._id,
      memberCode: '265100000001',
      billId,
      bookingId: 'manual-cancellation-booking',
      channel: 'billing_counter',
      serviceType: 'banquet',
      eventDate: new Date(Date.now() + 30 * 86_400_000),
      billAmount: 100,
      discountPercent: 50,
      discountedAmount: 50,
      pointsUsed: 50,
      remainingToPay: 0,
      balanceAfter: 350,
      createdByApiKey: apiKey.id,
    });

    const cancelled = await cancelRedemption({ billId, cancelledAt: new Date() });

    expect(cancelled.status).toBe('cancelled');
    expect(cancelled).not.toHaveProperty('refundPercent');
    expect(cancelled.refundedPoints).toBe(0);
    expect((await Membership.findById(member.membership._id)).pointsBalance).toBe(350);
    expect(await PointLedger.countDocuments({ billId, type: 'refund' })).toBe(0);
    expect((await cancelRedemption({ billId, cancelledAt: new Date() })).status).toBe('cancelled');
  });
});

describe('guest membership payment verification', () => {
  test('uses the signed frontend callback in development and marks its payment paid', async () => {
    const plan = await MembershipPlan.create({
      name: 'Guest callback test plan',
      price: 10000,
      earlyBirdPoints: 1,
      defaultPoints: 1,
      renewalPoints: 1,
      sortOrder: 1,
    });
    const orderId = 'order_test_1';
    const paymentId = 'payment_guest_callback';
    const draft = await MembershipDraft.create({
      email: 'guest-callback@example.invalid',
      firstName: 'Guest',
      tokenHash: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      emailVerifiedAt: new Date(),
      profile: {
        fullName: 'Guest Member',
        gender: 'other',
        countryCode: '+91',
        mobile: '9000000000',
        dob: new Date('1998-10-14T00:00:00.000Z'),
        interestArea: 'Travel',
      },
      plan: plan._id,
      gstSnapshot: {
        enabled: true,
        rate: 18,
        label: 'GST',
        planFee: 10000,
        gstAmount: 1800,
        totalAmount: 11800,
      },
      paymentMethod: 'razorpay',
      razorpayOrderId: orderId,
      identity: {
        panCiphertext: 'encrypted-pan',
        panMask: 'ABCDE****F',
        idType: 'aadhaar',
        idCiphertext: 'encrypted-id',
        idMask: 'XXXX XXXX 1234',
        consentAt: new Date(),
        documents: ['pan_front', 'second_front', 'second_back'].map((kind) => ({
          id: `test-${kind}`,
          kind,
          storageKey: `test-${kind}.png`,
          mimeType: 'image/png',
        })),
      },
    });
    await acceptTerms(draft._id);
    const signature = createHmac('sha256', 'fake-razorpay-secret-never-used')
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    const razorpay = globalThis.__orianaRazorpayClient;
    razorpay.payments.fetch.mockClear();

    const result = await verifyMembershipDraftRazorpayPayment(draft, {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    });

    expect(result.status).toBe('paid');
    expect((await Payment.findOne({ razorpayOrderId: orderId })).status).toBe('paid');
    expect((await MembershipDraft.findById(draft._id)).status).toBe('paid');
    expect(razorpay.payments.fetch).not.toHaveBeenCalled();

    const paidDraft = await MembershipDraft.findById(draft._id);
    const linkResult = await requestDraftPasswordLink(paidDraft, paidDraft.email);
    expect(linkResult.sent).toBe(true);
    const sentEmail = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0];
    const rawToken = sentEmail.html.match(/token=([a-f\d]{64})/i)?.[1];
    const tokenRecord = await EmailToken.findOne({ user: result.userId, type: 'activation' });
    expect(tokenRecord.tokenHash).not.toBe(rawToken);
    expect(tokenRecord.expiresAt.getTime()).toBeGreaterThan(Date.now());
    await expect(inspectActivation(rawToken)).resolves.toMatchObject({ email: paidDraft.email });
    const activated = await activateAccount({ token: rawToken, password: 'GuestPassword123' });
    expect(activated.user.status).toBe('active');
  });

  test('releases the resend cooldown when password-link delivery fails', async () => {
    const plan = await createPlan();
    const member = await createMember({
      email: 'retry-password-link@example.invalid',
      status: 'pending',
      emailVerified: true,
      passwordHash: undefined,
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    const payment = await Payment.create({
      user: member.user._id,
      membership: member.membership._id,
      plan: plan._id,
      method: 'bank_transfer',
      status: 'pending',
      baseAmount: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
    });
    const draft = await MembershipDraft.create({
      email: member.user.email,
      firstName: member.user.firstName,
      tokenHash: 'b'.repeat(64),
      expiresAt: new Date(Date.now() + 60_000),
      status: 'payment_submitted',
      user: member.user._id,
      membership: member.membership._id,
      payment: payment._id,
    });
    const transport = globalThis.__orianaMailTransport;
    transport.sendMail.mockReset()
      .mockRejectedValueOnce(new Error('temporary local mail failure'))
      .mockResolvedValue({ messageId: 'retry-message' });
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    await expect(requestDraftPasswordLink(draft, member.user.email))
      .rejects.toThrow('temporary local mail failure');
    expect(await EmailCooldown.findOne({
      email: member.user.email,
      type: 'activation',
    })).toBeNull();
    await expect(requestDraftPasswordLink(draft, member.user.email))
      .resolves.toMatchObject({ sent: true });
    expect(await EmailCooldown.findOne({
      email: member.user.email,
      type: 'activation',
    })).toBeTruthy();
    errorLog.mockRestore();
  });
});

describe('mail, reCAPTCHA, plans, and audit services', () => {
  test('fills and escapes mail template values while configuring SMTP TLS by port', async () => {
    const transport = globalThis.__orianaMailTransport;
    transport.sendMail.mockReset().mockResolvedValue({ messageId: 'message-1' });
    await sendMail({
      to: 'member@example.invalid',
      subject: 'Welcome',
      template: 'activation',
      data: { firstName: '<A>', link: 'https://example.invalid?a=1&b=2' },
    });
    const message = transport.sendMail.mock.calls[0][0];
    expect(message.html).toContain('&lt;A&gt;');
    expect(message.html).toContain('https://example.invalid?a=1&amp;b=2');
    const nodemailer = (await import('nodemailer')).default;
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      port: 465, secure: true, auth: expect.objectContaining({ pass: 'fake-mail-password-never-used' }),
    }));
  });

  test('logs real SMTP failure details without exposing the fake password', async () => {
    const transport = globalThis.__orianaMailTransport;
    transport.sendMail.mockReset().mockRejectedValue(Object.assign(
      new Error('SMTP rejected fake-mail-password-never-used'),
      { code: 'ELOGIN fake-mail-password-never-used' },
    ));
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(sendMail({
      to: 'member@example.invalid', subject: 'Test', template: 'activation', data: { link: '' },
    })).rejects.toThrow(/SMTP rejected/);
    expect(log.mock.calls.flat().join(' ')).toContain('ELOGIN');
    expect(log.mock.calls.flat().join(' ')).not.toContain('fake-mail-password-never-used');
    const record = await EmailLog.findOne({ status: 'failed' }).lean();
    expect(record.error).toContain('ELOGIN');
    expect(record.error).not.toContain('fake-mail-password-never-used');
    log.mockRestore();
  });

  test('reCAPTCHA only reaches the local fake and handles invalid responses and network errors', async () => {
    await verifyRecaptcha('fake-token');
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://www.google.com/recaptcha/api/siteverify',
      expect.objectContaining({ method: 'POST' }),
    );
    globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) });
    await expect(verifyRecaptcha('invalid-token')).rejects.toMatchObject({ statusCode: 400 });
    globalThis.fetch.mockRejectedValueOnce(new Error('offline'));
    await expect(verifyRecaptcha('offline-token')).rejects.toMatchObject({ statusCode: 502 });
  });

  test('reads active plans and reports unknown or inactive plans', async () => {
    const plan = await createPlan({ slug: 'active-plan' });
    await createPlan({ slug: 'inactive-plan', isActive: false });
    expect((await listActivePlans()).map((row) => row.slug)).toContain('active-plan');
    expect((await findActivePlan('active-plan'))._id.toString()).toBe(plan._id.toString());
    await expect(findActivePlan('inactive-plan')).rejects.toMatchObject({ statusCode: 404 });
  });

  test('writes audit events for admin actions and login outcomes', async () => {
    const { user } = await createMember({ role: 'admin' });
    await recordAdminAction({
      adminId: user._id, action: 'member.updated', entityType: 'member', entityId: user._id,
      summary: 'Member updated', ip: 'x'.repeat(200),
    });
    await recordAdminAuthAttempt({ adminId: user._id, success: false, ip: '127.0.0.1' });
    const entries = await AuditLog.find().sort({ action: 1 }).lean();
    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.action === 'member.updated').ip).toHaveLength(100);
    expect(entries.find((entry) => entry.action === 'login_failed').entityType).toBe('authentication');
  });
});

describe('points and payment services', () => {
  test('resolves cohort and points tier from the assigned member number and formats its member ID', () => {
    const plan = {
      pointsTiers: [
        { label: 'Founder', points: 100, fromMember: 1, toMember: 10 },
        { label: 'Standard', points: 50, fromMember: 11, toMember: null },
      ],
      cohorts: [
        { label: 'Founder', amount: 100000 },
        { label: 'Standard', amount: 50000 },
      ],
    };
    expect(getPointsTier(plan, '7').points).toBe(100);
    expect(getPointsTier(plan, '11').points).toBe(50);
    expect(getMembershipCohort(plan, 7).amount).toBe(100000);
    expect(getMembershipCohort(plan, 11).amount).toBe(50000);
    expect(getMembershipCohort(plan, 0)).toBeNull();
    expect(formatMemberId({
      activatedAt: new Date('2026-01-01T00:00:00.000Z'),
      expiresAt: new Date('2051-01-01T00:00:00.000Z'),
      sequence: 12,
    })).toBe('OC-265111000012');
  });

  test('credits and debits points atomically, supports idempotency, and blocks overspending', async () => {
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'active', pointsBalance: 0 } });
    const membershipId = member.membership._id;
    const first = await pointsService.credit({
      membershipId, amount: 20, category: 'food', reason: 'Dining', idempotencyKey: 'credit-once',
    });
    const repeated = await pointsService.credit({
      membershipId, amount: 20, category: 'food', reason: 'Dining', idempotencyKey: 'credit-once',
    });
    expect(repeated._id.toString()).toBe(first._id.toString());
    expect(await pointsService.getBalance(membershipId)).toBe(20);
    await pointsService.debit({ membershipId, amount: 5, category: 'food', reason: 'Dining' });
    await expect(pointsService.debit({ membershipId, amount: 99, category: 'food', reason: 'Overspend' }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(await pointsService.getBalance(membershipId)).toBe(15);
    expect(await PointsTransaction.countDocuments({ membership: membershipId })).toBe(2);
    expect(await pointsService.reconcileBalances()).toMatchObject({ mismatchCount: 0 });
    await Membership.updateOne({ _id: membershipId }, { $inc: { pointsBalance: 1 } });
    expect(await pointsService.reconcileBalances()).toMatchObject({
      mismatchCount: 1,
      mismatches: [expect.objectContaining({ storedBalance: 16, ledgerBalance: 15 })],
    });
  });

  test('awards the correct points tier for a member number and bulk credits active memberships', async () => {
    const plan = await createPlan({
      pointsTiers: [
        { label: 'Founders', points: 100, fromMember: 1, toMember: 10 },
        { label: 'Standard', points: 50, fromMember: 11, toMember: null },
      ],
    });
    const founder = await createMember({
      membership: { plan: plan._id, status: 'active', memberNumber: '4', pointsBalance: 0 },
    });
    const later = await createMember({
      membership: { plan: plan._id, status: 'active', memberNumber: '12', pointsBalance: 0 },
    });
    expect((await pointsService.awardMembershipPoints(founder.membership._id)).amount).toBe(100);
    expect((await pointsService.awardMembershipPoints(later.membership._id)).amount).toBe(50);
    const result = await pointsService.bulkCredit({
      membershipIds: [String(founder.membership._id), String(later.membership._id)], amount: 5, reason: 'Campaign',
    });
    expect(result).toMatchObject({ total: 2, succeeded: 2 });
  });

  test('serializes simultaneous balance changes and exposes paginated points history', async () => {
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'active', pointsBalance: 0 },
    });
    const membershipId = member.membership._id;
    await Promise.all([
      pointsService.credit({ membershipId, amount: 10, category: 'food', reason: 'First' }),
      pointsService.credit({ membershipId, amount: 10, category: 'food', reason: 'Second' }),
    ]);
    expect(await pointsService.getBalance(membershipId)).toBe(20);
    const history = await pointsService.getHistory(membershipId, { page: '1', limit: '1' });
    expect(history).toMatchObject({ page: 1, limit: 1, total: 2, pages: 2 });
    expect(history.items).toHaveLength(1);
    expect((await pointsService.getActiveMemberPoints(member.user._id)).balance).toBe(20);
    expect((await pointsService.getAdminPointsForUser(member.user._id)).balance).toBe(20);
    expect((await pointsService.getMemberPoints(member.user._id)).balance).toBe(20);
  });

  test('rejects invalid points changes and returns empty balance for a member without a membership', async () => {
    const plan = await createPlan();
    const member = await createMember({ membership: { plan: plan._id, status: 'active' } });
    await expect(pointsService.credit({
      membershipId: member.membership._id, amount: 0, category: 'food', reason: 'Invalid',
    })).rejects.toMatchObject({ statusCode: 400 });
    await expect(pointsService.debit({
      membershipId: member.membership._id, amount: 1, category: 'unsupported', reason: 'Invalid',
    })).rejects.toMatchObject({ statusCode: 400 });
    const noMembership = await createMember();
    expect(await pointsService.getMemberPoints(noMembership.user._id)).toMatchObject({
      balance: 0, membership: null,
    });
    await expect(pointsService.getActiveMemberPoints(noMembership.user._id))
      .rejects.toMatchObject({ statusCode: 404 });
  });

  test('creates payment orders from the persisted plan price and validates signatures', async () => {
    const plan = await createPlan({
      price: 1234,
      pointsTiers: [{ label: 'Standard', points: 10, fromMember: 1, toMember: null }],
    });
    const member = await createMember({ membership: { plan: plan._id, status: 'pending_payment' } });
    await acceptTerms(member.user._id, member.user._id);
    const result = await createRazorpayOrder(member.user._id, member.membership._id, 'upi');
    const razorpay = globalThis.__orianaRazorpayClient;
    expect(result).toEqual({ orderId: 'order_test_1', keyId: 'rzp_test_only' });
    expect(razorpay.orders.create).toHaveBeenCalledWith(expect.objectContaining({
      amount: 145612, currency: 'INR',
    }));
    const record = await Payment.findOne({ user: member.user._id });
    await expect(verifyRazorpayPayment(member.user._id, {
      razorpay_order_id: record.razorpayOrderId,
      razorpay_payment_id: 'payment-test',
      razorpay_signature: '0'.repeat(64),
    })).rejects.toMatchObject({ statusCode: 400 });
    const signature = createHmac('sha256', 'fake-razorpay-secret-never-used')
      .update(`${record.razorpayOrderId}|payment-valid`).digest('hex');
    await expect(verifyRazorpayPayment(member.user._id, {
      razorpay_order_id: record.razorpayOrderId,
      razorpay_payment_id: 'payment-valid',
      razorpay_signature: signature,
    })).resolves.toMatchObject({ status: 'paid' });
  });

  test('confirms a payment for approval without assigning a number or crediting points', async () => {
    const plan = await createPlan({
      pointsTiers: [{ label: 'Standard', points: 10, fromMember: 1, toMember: null }],
    });
    const member = await createMember({
      membership: { plan: plan._id, status: 'pending_payment', pointsBalance: 0 },
    });
    const payment = await Payment.create({
      user: member.user._id,
      membership: member.membership._id,
      plan: plan._id,
      method: 'manual',
      status: 'created',
      baseAmount: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
    });
    const transport = globalThis.__orianaMailTransport;
    transport.sendMail.mockClear();
    const first = await finalizePayment(payment._id);
    const second = await finalizePayment(payment._id);
    expect(first.status).toBe('confirmed');
    expect(second.status).toBe('confirmed');
    const confirmedMembership = await Membership.findById(member.membership._id);
    expect(confirmedMembership).toMatchObject({
      status: 'pending_approval',
      baseAmount: 100,
      gstAmount: 18,
      totalPaid: 118,
    });
    expect(confirmedMembership.paymentConfirmedAt).toBeInstanceOf(Date);
    expect(confirmedMembership.approvalDueAt.getTime() - confirmedMembership.paymentConfirmedAt.getTime())
      .toBe(24 * 60 * 60 * 1000);
    expect(confirmedMembership.approvalSeq).toBeNull();
    expect(await PointsTransaction.countDocuments({ membership: member.membership._id })).toBe(0);
    expect(await PointsLedger.countDocuments({ memberId: member.membership._id })).toBe(0);
    expect(transport.sendMail).not.toHaveBeenCalled();
  });
});
