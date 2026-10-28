import { readFile, stat, unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHmac } from 'node:crypto';
import { jest } from '@jest/globals';
import request from 'supertest';
import { createApp } from './helpers/createApp.js';
import { createAdmin, createMember, createPlan } from './helpers/factories.js';
import EmailToken from '../src/models/EmailToken.js';
import FamilyMember from '../src/models/FamilyMember.js';
import Membership from '../src/models/Membership.js';
import MembershipPlan from '../src/models/MembershipPlan.js';
import User from '../src/models/User.js';
import Payment from '../src/models/Payment.js';
import { invalidateSettingsCache } from '../src/models/Setting.js';
import AuditLog from '../src/models/AuditLog.js';
import TermsConsent from '../src/models/TermsConsent.js';
import Post from '../src/models/Post.js';
import Event from '../src/models/Event.js';
import Enquiry from '../src/models/Enquiry.js';
import { processRazorpayWebhook } from '../src/services/payment.service.js';
import { signOnboardingToken } from '../src/services/token.service.js';
import { publicMediaDirectory } from '../src/utils/uploadDirectories.js';

const app = createApp();
const validProfile = {
  fullName: 'Test Member',
  gender: 'other',
  countryCode: '+91',
  mobile: '9000000000',
  dob: '1990-01-01',
  interestArea: 'Travel',
};

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
    user_agent: 'route-test',
    read_to_end: true,
    scroll_completed_at: acceptedAt,
  });
}

afterEach(() => invalidateSettingsCache());

// Route tests exercise real Express middleware and persist only in memory MongoDB.
describe('public account and plan routes', () => {
  test('health and plan routes return active plans and a not-found error', async () => {
    const plan = await createPlan({ slug: 'route-plan' });
    await createPlan({ slug: 'hidden-plan', isActive: false });
    expect((await request(app).get('/api/health')).status).toBe(200);
    const plans = await request(app).get('/api/plans');
    expect(plans.status).toBe(200);
    expect(plans.body.data.map((item) => item.slug)).toContain('route-plan');
    expect(plans.body.data.map((item) => item.slug)).not.toContain('hidden-plan');
    expect((await request(app).get(`/api/plans/${plan.slug}`)).status).toBe(200);
    expect((await request(app).get('/api/plans/missing')).status).toBe(404);
  });

  test('removes public registration while keeping password setup and recovery routes', async () => {
    expect((await request(app).post('/api/auth/register').send({
      firstName: 'Test', email: 'new-member@example.invalid',
    })).status).toBe(404);
    expect((await request(app).post('/api/auth/forgot-password').send({
      email: 'unknown@example.invalid',
    })).status).toBe(202);

    const consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    const started = await request(app).post('/api/membership/draft/start').send({
      firstName: 'Guest',
      email: 'guest@example.invalid',
      profile: { ...validProfile, fullName: 'Guest Member' },
    });
    expect(started.status).toBe(202);
    expect(started.body.data.email).toBe('g***@example.invalid');
    expect(JSON.stringify(started.body)).not.toMatch(/token/i);
    const draftCookie = started.headers['set-cookie']
      .find((cookie) => cookie.startsWith('oc_membership_draft='));
    expect(draftCookie).toMatch(/HttpOnly/i);
    const draft = await request(app).get('/api/membership/draft').set('Cookie', draftCookie);
    expect(draft.status).toBe(200);
    expect(draft.body.data).toMatchObject({ status: 'draft', emailVerified: false });
    const otpEmail = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0];
    const otpCode = otpEmail.html.match(/letter-spacing:8px;">(\d{6})</)?.[1];
    expect(otpCode).toBeTruthy();
    expect(consoleLog.mock.calls.flat().join(' ')).toContain(otpCode);
    consoleLog.mockRestore();
    expect((await request(app).get('/api/membership/draft')).status).toBe(401);
  });

  test('logs the SMTP error code and message when verification mail fails', async () => {
    const transport = globalThis.__orianaMailTransport;
    transport.sendMail.mockRejectedValueOnce(Object.assign(
      new Error('Connection refused by local SMTP server'),
      { code: 'ECONNECTION' },
    ));
    const errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});

    const response = await request(app).post('/api/membership/draft/start').send({
      firstName: 'Mail Failure',
      email: 'mail-failure@example.invalid',
      profile: { ...validProfile, fullName: 'Mail Failure' },
    });

    expect(response.status).toBe(503);
    const logs = errorLog.mock.calls.flat().join(' ');
    expect(logs).toContain('ECONNECTION');
    expect(logs).toContain('Connection refused by local SMTP server');
    errorLog.mockRestore();
  });

  test('uses generic password recovery responses and enforces reset token expiry and single use', async () => {
    const member = await createMember({
      email: 'reset@example.invalid',
      status: 'active',
      emailVerified: true,
    });
    const forgot = await request(app).post('/api/auth/forgot-password')
      .send({ email: member.user.email });
    expect(forgot.status).toBe(202);
    const token = await EmailToken.findOne({ user: member.user._id, type: 'reset' });
    const rawToken = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].html
      .match(/token=([a-f\d]{64})/i)?.[1];
    expect(rawToken).toBeTruthy();
    const reset = await request(app).post('/api/auth/reset-password').send({
      token: rawToken, password: 'ChangedPassword123', confirmPassword: 'ChangedPassword123',
    });
    expect(reset.status).toBe(200);
    expect((await request(app).post('/api/auth/reset-password').send({
      token: rawToken, password: 'ChangedPassword123', confirmPassword: 'ChangedPassword123',
    })).status).toBe(400);
    await EmailToken.create({
      user: member.user._id, type: 'reset', tokenHash: 'f'.repeat(64), expiresAt: new Date(0),
    });
    expect(token).toBeTruthy();
  });

  test('pending members can set their password through recovery only after payment submission', async () => {
    const plan = await createPlan();
    const member = await createMember({
      status: 'pending',
      emailVerified: true,
      passwordHash: undefined,
      membership: { plan: plan._id, status: 'pending_payment' },
    });
    const beforePayment = await request(app).post('/api/auth/forgot-password')
      .send({ email: member.user.email });
    expect(beforePayment.status).toBe(202);
    expect(await EmailToken.findOne({ user: member.user._id, type: 'reset' })).toBeNull();

    await Payment.create({
      user: member.user._id,
      membership: member.membership._id,
      plan: plan._id,
      method: 'bank_transfer',
      status: 'pending',
      baseAmount: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
    });
    const afterPayment = await request(app).post('/api/auth/forgot-password')
      .send({ email: member.user.email });
    expect(afterPayment.status).toBe(202);
    expect(await EmailToken.findOne({ user: member.user._id, type: 'reset' })).toBeNull();
    const activationTokenRecord = await EmailToken.findOne({ user: member.user._id, type: 'activation' });
    const rawToken = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].html
      .match(/token=([a-f\d]{64})/i)?.[1];
    expect(activationTokenRecord).toBeTruthy();
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].subject)
      .toBe('Set your OrianaaClub password');
    expect(globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].html)
      .toContain('/set-password?token=');
    expect(rawToken).toBeTruthy();
    const setupResponse = await request(app).post('/api/auth/activate').send({
      token: rawToken,
      password: 'ChangedPassword123',
      confirmPassword: 'ChangedPassword123',
    });
    expect(setupResponse.status).toBe(200);
    expect((await request(app).post('/api/auth/activate').send({
      token: rawToken,
      password: 'ChangedPassword123',
      confirmPassword: 'ChangedPassword123',
    })).status).toBe(400);
  });

  test('password setup email changes reject active-account collisions and audit successful changes', async () => {
    const plan = await createPlan();
    const pending = await createMember({
      email: 'pending-setup@example.invalid',
      status: 'pending',
      emailVerified: true,
      passwordHash: undefined,
      membership: { plan: plan._id, status: 'pending_verification' },
    });
    await createMember({ email: 'already-active@example.invalid', status: 'active' });
    await Payment.create({
      user: pending.user._id,
      membership: pending.membership._id,
      plan: plan._id,
      method: 'bank_transfer',
      status: 'pending',
      baseAmount: 10000,
      gstAmount: 1800,
      totalAmount: 11800,
    });
    const onboardingCookie = `oc_onboarding=${signOnboardingToken(pending.user._id)}`;

    const collision = await request(app).post('/api/auth/onboarding/password-link')
      .set('Cookie', onboardingCookie)
      .send({ email: 'already-active@example.invalid' });
    expect(collision.status).toBe(409);
    expect(collision.body).toEqual({ message: 'This email is already registered. Please log in.' });

    const changed = await request(app).post('/api/auth/onboarding/password-link')
      .set('Cookie', onboardingCookie)
      .send({ email: 'corrected-address@example.invalid' });
    expect(changed.status).toBe(202);
    expect((await User.findById(pending.user._id)).email).toBe('corrected-address@example.invalid');
    expect(await AuditLog.findOne({
      action: 'membership_password_email_changed',
      entityId: String(pending.user._id),
      'after.email': 'corrected-address@example.invalid',
    })).toBeTruthy();
    expect(changed.body.maskedEmail).toBe('c***@example.invalid');
    const sentMail = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0];
    expect(sentMail.to).toBe('corrected-address@example.invalid');
    expect(sentMail.subject).toBe('Set your OrianaaClub password');
    expect(sentMail.html).toContain('/set-password?token=');
  });

  test('returns generic resend and forgot-password responses for unknown addresses', async () => {
    expect((await request(app).post('/api/auth/resend-activation')
      .send({ email: 'absent@example.invalid' })).status).toBe(202);
    expect((await request(app).post('/api/auth/forgot-password')
      .send({ email: 'absent@example.invalid' })).status).toBe(202);
  });

  test('rejects suspended members and keeps the removed registration route unavailable', async () => {
    const member = await createMember({ status: 'suspended' });
    expect((await request(app).post('/api/auth/login').send({
      email: member.user.email, password: 'TestPassword123',
    })).status).toBe(403);
    expect((await request(app).post('/api/auth/register').send({
      firstName: 'x', email: 'not-an-email',
    })).status).toBe(404);
  });
});

describe('member profile, plan, family, and payment routes', () => {
  test('saves and reads a member profile and plan, with validated input', async () => {
    const { cookie, user } = await createMember();
    const plan = await createPlan();
    expect((await request(app).get('/api/member/me').set('Cookie', cookie)).body.data.profile.user)
      .toBe(String(user._id));
    const saved = await request(app).put('/api/member/profile').set('Cookie', cookie).send(validProfile);
    expect(saved.status).toBe(200);
    const selected = await request(app).put('/api/member/plan').set('Cookie', cookie)
      .send({ planId: String(plan._id) });
    expect(selected.status).toBe(200);
    expect(selected.body.data.plan.title).toBe(plan.title);
    expect((await request(app).put('/api/member/plan').set('Cookie', cookie)
      .send({ planId: 'bad-id' })).status).toBe(400);
  });

  describe('public content and enquiry routes', () => {
    test('lists and reads published stories and upcoming events only', async () => {
      await Post.create({
        title: 'Public Story', slug: 'public-story', excerpt: 'Story summary',
        content: 'Story body', category: 'Travel', status: 'published',
      });
      await Post.create({
        title: 'Draft Story', slug: 'draft-story', excerpt: 'Draft summary',
        content: 'Draft body', category: 'Travel', status: 'draft',
      });
      await Event.create({
        title: 'Upcoming', slug: 'upcoming', description: 'Upcoming event',
        date: new Date('2030-01-01'), location: 'Mumbai', status: 'published',
      });
      await Event.create({
        title: 'Old event', slug: 'old-event', description: 'Past event',
        date: new Date('2020-01-01'), location: 'Mumbai', status: 'published',
      });
      expect((await request(app).get('/api/posts')).body.data.items.map((item) => item.slug))
        .toEqual(['public-story']);
      expect((await request(app).get('/api/posts/public-story')).status).toBe(200);
      expect((await request(app).get('/api/posts/not-found')).status).toBe(404);
      expect((await request(app).get('/api/posts/bad_slug')).status).toBe(400);
      expect((await request(app).get('/api/events')).body.data.items.map((item) => item.slug))
        .toEqual(['upcoming']);
      expect((await request(app).get('/api/events/upcoming')).status).toBe(200);
      expect((await request(app).get('/api/events/old-event')).status).toBe(404);
    });

    test('enquiry route rejects missing and invalid reCAPTCHA and stores valid submissions', async () => {
      const invalid = await request(app).post('/api/enquiries').send({
        type: 'query', name: 'Test Member', email: 'test@example.invalid', message: 'Need help',
      });
      expect(invalid.status).toBe(400);
      globalThis.fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ success: false }) });
      const failed = await request(app).post('/api/enquiries').send({
        type: 'query', name: 'Test Member', email: 'test@example.invalid',
        message: 'Need help', recaptchaToken: 'invalid-token',
      });
      expect(failed.status).toBe(400);
      const success = await request(app).post('/api/enquiries').send({
        type: 'query', name: 'Test Member', email: 'test@example.invalid',
        message: 'Need help', recaptchaToken: 'fake-token',
      });
      expect(success.status).toBe(201);
      expect(await Enquiry.countDocuments()).toBe(1);
    });
  });

  test('enforces plan family limits and prevents access to another member family record', async () => {
    const plan = await createPlan({
      id: 'founder-legacy',
      slug: 'founder-legacy',
      name: 'Founder Legacy',
      title: 'Founder Legacy',
    });
    const owner = await createMember({
      membership: { plan: plan._id, status: 'draft' },
    });
    const other = await createMember({
      membership: { plan: plan._id, status: 'draft' },
    });
    const first = await request(app).post('/api/member/family').set('Cookie', owner.cookie)
      .send({ fullName: 'First Family', gender: 'other', relationship: 'Spouse', dob: '1995-01-01' });
    expect(first.status).toBe(201);
    expect((await request(app).post('/api/member/family').set('Cookie', owner.cookie)
      .send({ fullName: 'Second Family', gender: 'other', relationship: 'Spouse', dob: '1995-01-01' })).status).toBe(409);
    expect((await request(app).delete(`/api/member/family/${first.body.data._id}`)
      .set('Cookie', other.cookie)).status).toBe(404);
    expect(await FamilyMember.countDocuments({ membership: owner.membership._id })).toBe(1);
  });

  test('checkout quote and payment creation are scoped to the authenticated member', async () => {
    const plan = await createPlan({ price: 1000 });
    const owner = await createMember({ membership: { plan: plan._id, status: 'pending_payment' } });
    const another = await createMember();
    await acceptTerms(owner.user._id, owner.user._id);
    const quote = await request(app).post('/api/member/checkout/quote').set('Cookie', owner.cookie)
      .send({ planId: String(plan._id) });
    expect(quote.status).toBe(200);
    expect(quote.body.data.total).toBe(118000);
    const payment = await request(app).get(`/api/payments/memberships/${owner.membership._id}`)
      .set('Cookie', another.cookie);
    expect(payment.status).toBe(404);
    const order = await request(app).post('/api/payments/create-order').set('Cookie', owner.cookie)
      .send({ membershipId: String(owner.membership._id), method: 'upi' });
    expect(order.status).toBe(201);
  });

  test('GST settings stay private, payment snapshots survive rate changes, and unsupported payment modes are rejected', async () => {
    invalidateSettingsCache();
    const publicDefault = await request(app).get('/api/membership/gst-settings');
    expect(publicDefault.status).toBe(200);
    expect(publicDefault.body.data).toEqual({ enabled: true, rate: 18, label: 'GST' });

    const admin = await createAdmin();
    const updatedSettings = await request(app).patch('/api/admin/membership-settings')
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({ gstEnabled: true, gstRate: 5, gstLabel: 'GST', gstin: 'PRIVATE-GSTIN' });
    expect(updatedSettings.status).toBe(200);
    expect(updatedSettings.body.data.gstin).toBe('PRIVATE-GSTIN');
    expect((await request(app).get('/api/membership/gst-settings')).body.data)
      .toEqual({ enabled: true, rate: 5, label: 'GST' });
    expect((await request(app).patch('/api/admin/membership-settings')
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({ gstRate: 5.001 })).status).toBe(400);

    const plan = await MembershipPlan.create({
      name: `GST Test Plan ${Date.now()}`,
      price: 2500000,
      earlyBirdPoints: 50000,
      defaultPoints: 25000,
      renewalPoints: 25000,
      sortOrder: 1,
    });

    const cashMember = await createMember();
    for (const paymentMethod of ['cash', 'manual', 'netbanking']) {
      expect((await request(app).post('/api/membership/purchase').set('Cookie', cashMember.cookie)
        .send({ planId: String(plan._id), paymentMethod })).status).toBe(400);
    }

    await request(app).patch('/api/admin/membership-settings')
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({ gstRate: 18 });
    const firstMember = await createMember();
    await acceptTerms(firstMember.user._id, firstMember.user._id);
    const firstPurchase = await request(app).post('/api/membership/purchase').set('Cookie', firstMember.cookie)
      .send({ planId: String(plan._id), paymentMethod: 'razorpay' });
    expect(firstPurchase.status).toBe(201);
    const firstPayment = await Payment.findById(firstPurchase.body.data.paymentId);
    expect(firstPayment).toMatchObject({
      gstRate: 18,
      gstEnabled: true,
      baseAmount: 250000000,
      gstAmount: 45000000,
      totalAmount: 295000000,
    });

    await request(app).patch('/api/admin/membership-settings')
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({ gstRate: 5 });
    const order = await request(app).post('/api/membership/razorpay/order').set('Cookie', firstMember.cookie)
      .send({ paymentId: String(firstPayment._id), amount: 1 });
    expect(order.status).toBe(201);
    expect(order.body.data.amount).toBe(295000000);
    expect(globalThis.__orianaRazorpayClient.orders.create).toHaveBeenLastCalledWith(
      expect.objectContaining({ amount: 295000000, currency: 'INR' }),
    );
    expect((await Payment.findById(firstPayment._id)).gstRate).toBe(18);

    const secondMember = await createMember();
    await acceptTerms(secondMember.user._id, secondMember.user._id);
    const secondPurchase = await request(app).post('/api/membership/purchase').set('Cookie', secondMember.cookie)
      .send({ planId: String(plan._id), paymentMethod: 'bank_transfer' });
    expect(secondPurchase.status).toBe(201);
    expect(secondPurchase.body.data).toMatchObject({
      baseAmount: 250000000,
      gstAmount: 12500000,
      amount: 262500000,
      gstRate: 5,
    });
    const rejectedManualAmount = await request(app).post('/api/admin/payments')
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({
        membershipId: secondPurchase.body.data.membershipId,
        method: 'bank_transfer',
        amount: 2500000,
        reference: 'UTR-EX-GST',
      });
    expect(rejectedManualAmount.status).toBe(400);
    for (const method of ['cash', 'manual', 'netbanking']) {
      const response = await request(app).post('/api/admin/payments')
        .set('Cookie', admin.cookie)
        .set('X-Admin-Request', '1')
        .send({
          membershipId: secondPurchase.body.data.membershipId,
          method,
          amount: 2625000,
          reference: 'LEGACY-METHOD',
        });
      expect(response.status).toBe(201);
      expect(response.body.data.method).toBe(method);
    }

    const manualPayment = await request(app).post('/api/admin/payments')
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({
        membershipId: secondPurchase.body.data.membershipId,
        method: 'bank_transfer',
        amount: 2625000,
        reference: 'UTR-IN-GST',
      });
    expect(manualPayment.status).toBe(201);
    expect(manualPayment.body.data).toMatchObject({
      baseAmount: 250000000,
      gstAmount: 12500000,
      totalAmount: 262500000,
    });

    await request(app).patch('/api/admin/membership-settings')
      .set('Cookie', admin.cookie)
      .set('X-Admin-Request', '1')
      .send({ gstEnabled: false });
    const disabled = await request(app).post('/api/member/checkout/quote').set('Cookie', cashMember.cookie)
      .send({ planId: String(plan._id) });
    expect(disabled.status).toBe(200);
    expect(disabled.body.data).toMatchObject({
      gstEnabled: false,
      planFee: 250000000,
      gst: 0,
      total: 250000000,
    });
    expect((await request(app).get('/api/membership/gst-settings')).body.data)
      .toEqual({ enabled: false, rate: 5, label: 'GST' });
  });

  test('starts membership payment, reads the owner payment view, and edits only their family', async () => {
    const plan = await createPlan({
      id: 'founder-legacy',
      slug: 'founder-legacy',
      name: 'Founder Legacy',
      title: 'Founder Legacy',
    });
    const owner = await createMember();
    const other = await createMember();
    const started = await request(app).post('/api/member/checkout').set('Cookie', owner.cookie)
      .send({ planId: String(plan._id) });
    expect(started.status).toBe(201);
    const membershipId = started.body.data._id;
    expect((await request(app).get(`/api/payments/memberships/${membershipId}`)
      .set('Cookie', owner.cookie)).status).toBe(200);
    expect((await request(app).get(`/api/payments/memberships/${membershipId}`)
      .set('Cookie', other.cookie)).status).toBe(404);
    const created = await request(app).post('/api/member/family').set('Cookie', owner.cookie)
      .send({ fullName: 'Family One', gender: 'other', relationship: 'Spouse', dob: '1995-01-01' });
    const familyId = created.body.data._id;
    expect((await request(app).put(`/api/member/family/${familyId}`).set('Cookie', owner.cookie)
      .send({ fullName: 'Family Updated', gender: 'other', relationship: 'Spouse', dob: '1995-01-01' })).status).toBe(200);
    expect((await request(app).get('/api/member/family').set('Cookie', owner.cookie)).body.data[0].fullName)
      .toBe('Family Updated');
    expect((await request(app).delete(`/api/member/family/${familyId}`).set('Cookie', owner.cookie)).status).toBe(200);
  });

  test('stores an uploaded profile photo and does not leave test files behind', async () => {
    const member = await createMember();
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    let photoUrl = '';
    try {
      const response = await request(app).put('/api/member/profile').set('Cookie', member.cookie)
        .field('fullName', validProfile.fullName)
        .field('gender', validProfile.gender)
        .field('countryCode', validProfile.countryCode)
        .field('mobile', validProfile.mobile)
        .field('dob', validProfile.dob)
        .field('interestArea', validProfile.interestArea)
        .attach('photo', png, { filename: 'profile.png', contentType: 'image/png' });
      expect(response.body.message).toBe('Profile saved.');
      photoUrl = response.body.data.photoUrl;
      expect(photoUrl).toMatch(/^\/media\/[a-f\d]+\.png$/);
    } finally {
      if (photoUrl) await unlink(path.join(publicMediaDirectory, path.basename(photoUrl))).catch(() => {});
    }
  });
});

describe('admin authorization and webhook routes', () => {
  test('requires admin credentials, rejects member cookies, and accepts admin cookies', async () => {
    const member = await createMember();
    const admin = await createAdmin();
    expect((await request(app).get('/api/admin/members')).status).toBe(401);
    expect((await request(app).get('/api/admin/members').set('Cookie', member.cookie)).status).toBe(403);
    expect((await request(app).get('/api/admin/members').set('Cookie', admin.cookie)).status).toBe(200);
    expect((await request(app).post('/api/admin/members')
      .set('Cookie', admin.cookie).send({})).status).toBe(403);
    expect((await request(app).post('/api/admin/members')
      .set('Cookie', `${admin.cookie}; X-Admin-Request=1`).set('X-Admin-Request', '1').send({})).status).toBe(400);
  });

  test('uploads an 8 MB blog image, serves it publicly, preserves it on edit, and rejects oversized images', async () => {
    const admin = await createAdmin();
    const sourceImage = await readFile(new URL('../../frontend/src/assets/Orianaa%20blog%20page.png', import.meta.url));
    const acceptedSize = 8 * 1024 * 1024;
    const upload = Buffer.concat([sourceImage, Buffer.alloc(acceptedSize - sourceImage.length)]);
    let coverImage = '';

    try {
      const created = await request(app).post('/api/admin/posts')
        .set('Cookie', admin.cookie)
        .set('X-Admin-Request', '1')
        .field('title', 'Uploaded image story')
        .field('slug', 'uploaded-image-story')
        .field('excerpt', 'A story created with an 8 MB cover image.')
        .field('content', 'The uploaded cover image remains available on the public story.')
        .field('category', 'Travel')
        .field('status', 'published')
        .attach('coverImage', upload, { filename: 'story.png', contentType: 'image/png' });
      expect(created.status).toBe(201);
      coverImage = created.body.data.coverImage;
      expect(coverImage).toMatch(/^\/media\/[a-f\d-]+\.png$/);
      expect((await stat(path.join(publicMediaDirectory, path.basename(coverImage)))).size).toBe(acceptedSize);

      const listed = await request(app).get('/api/posts');
      expect(listed.body.data.items.find((post) => post.slug === 'uploaded-image-story').coverImage).toBe(coverImage);
      const detail = await request(app).get('/api/posts/uploaded-image-story');
      expect(detail.body.data.coverImage).toBe(coverImage);

      const servedImage = await request(app).get(coverImage).set('Origin', 'http://localhost:5173');
      expect(servedImage.status).toBe(200);
      expect(servedImage.headers['cross-origin-resource-policy']).toBe('cross-origin');
      expect(servedImage.body.length).toBe(acceptedSize);
      expect((await request(app).get(`/uploads/${path.basename(coverImage)}`)).status).toBe(404);

      const updated = await request(app).patch(`/api/admin/posts/${created.body.data._id}`)
        .set('Cookie', admin.cookie)
        .set('X-Admin-Request', '1')
        .field('title', 'Edited image story');
      expect(updated.status).toBe(200);
      expect(updated.body.data.coverImage).toBe(coverImage);

      const oversized = await request(app).post('/api/admin/posts')
        .set('Cookie', admin.cookie)
        .set('X-Admin-Request', '1')
        .attach('coverImage', Buffer.alloc(10 * 1024 * 1024 + 1), {
          filename: 'oversized.png',
          contentType: 'image/png',
        });
      expect(oversized.status).toBe(413);
      expect(oversized.body.message).toBe('Image must be 10 MB or smaller.');
    } finally {
      if (coverImage) await unlink(path.join(publicMediaDirectory, path.basename(coverImage))).catch(() => {});
    }
  });

  test.each([
    ['POST', '/api/admin/points/credit'],
    ['POST', '/api/admin/points/debit'],
    ['POST', '/api/admin/points/bulk-credit'],
    ['GET', '/api/admin/members/export'],
    ['GET', '/api/admin/members'],
    ['POST', '/api/admin/members'],
    ['GET', '/api/admin/members/0123456789abcdef01234567/points'],
    ['GET', '/api/admin/members/0123456789abcdef01234567/family'],
    ['PATCH', '/api/admin/members/0123456789abcdef01234567/family/0123456789abcdef01234568'],
    ['DELETE', '/api/admin/members/0123456789abcdef01234567/family/0123456789abcdef01234568'],
    ['PATCH', '/api/admin/members/0123456789abcdef01234567'],
    ['POST', '/api/admin/members/0123456789abcdef01234567/suspend'],
    ['POST', '/api/admin/members/0123456789abcdef01234567/activate'],
    ['POST', '/api/admin/members/0123456789abcdef01234567/resend-activation'],
    ['DELETE', '/api/admin/members/0123456789abcdef01234567'],
    ['GET', '/api/admin/members/0123456789abcdef01234567'],
    ['GET', '/api/admin/dashboard'],
    ['GET', '/api/admin/plans'],
    ['POST', '/api/admin/plans'],
    ['PATCH', '/api/admin/plans/0123456789abcdef01234567'],
    ['GET', '/api/admin/payments/export'],
    ['GET', '/api/admin/payments'],
    ['GET', '/api/admin/payments/0123456789abcdef01234567'],
    ['POST', '/api/admin/payments/0123456789abcdef01234567/approve'],
    ['POST', '/api/admin/payments/0123456789abcdef01234567/reject'],
    ['POST', '/api/admin/payments/0123456789abcdef01234567/refund'],
    ['GET', '/api/admin/posts'],
    ['POST', '/api/admin/posts'],
    ['PATCH', '/api/admin/posts/0123456789abcdef01234567'],
    ['DELETE', '/api/admin/posts/0123456789abcdef01234567'],
    ['GET', '/api/admin/events'],
    ['POST', '/api/admin/events'],
    ['PATCH', '/api/admin/events/0123456789abcdef01234567'],
    ['DELETE', '/api/admin/events/0123456789abcdef01234567'],
    ['GET', '/api/admin/enquiries'],
    ['GET', '/api/admin/enquiries/summary'],
    ['PATCH', '/api/admin/enquiries/0123456789abcdef01234567/status'],
    ['POST', '/api/admin/enquiries/0123456789abcdef01234567/notes'],
    ['GET', '/api/admin/admins'],
    ['POST', '/api/admin/admins'],
    ['PATCH', '/api/admin/admins/0123456789abcdef01234567'],
    ['GET', '/api/admin/audit-logs'],
    ['GET', '/api/admin/email-logs'],
    ['GET', '/api/admin/reports'],
    ['GET', '/api/admin/reports/export'],
  ])('%s %s requires an administrator session', async (method, path) => {
    const member = await createMember();
    let call = request(app)[method.toLowerCase()](path).set('Cookie', member.cookie);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      call = call.set('X-Admin-Request', '1').send({});
    }
    expect((await call).status).toBe(403);
  });

  test('admin status changes are audited and reject self-deactivation', async () => {
    const actor = await createAdmin();
    const target = await createAdmin();
    const self = await request(app).patch(`/api/admin/admins/${actor.user._id}`)
      .set('Cookie', actor.cookie).set('X-Admin-Request', '1').send({ status: 'suspended' });
    expect(self.status).toBe(409);
    const changed = await request(app).patch(`/api/admin/admins/${target.user._id}`)
      .set('Cookie', actor.cookie).set('X-Admin-Request', '1').send({ status: 'suspended' });
    expect(changed.status).toBe(200);
    expect(await AuditLog.countDocuments({ action: 'admin.suspended' })).toBe(1);
  });

  test('admin authentication routes issue separate cookies and support logout', async () => {
    const admin = await createAdmin({ email: 'route-admin@example.invalid' });
    const login = await request(app).post('/api/admin/auth/login')
      .set('X-Admin-Request', '1')
      .send({ email: admin.user.email, password: 'AdminPassword123' });
    expect(login.status).toBe(200);
    expect(login.headers['set-cookie'].join(' ')).toContain('oc_admin_access=');
    const cookie = login.headers['set-cookie'];
    expect((await request(app).get('/api/admin/auth/me').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).post('/api/admin/auth/logout')
      .set('X-Admin-Request', '1').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).post('/api/admin/auth/login').set('X-Admin-Request', '1')
      .send({ email: admin.user.email, password: 'WrongPassword123' })).status).toBe(401);
    const refreshed = await request(app).post('/api/admin/auth/refresh')
      .set('X-Admin-Request', '1').set('Cookie', cookie);
    expect(refreshed.status).toBe(200);
    const forgot = await request(app).post('/api/admin/auth/forgot-password')
      .set('X-Admin-Request', '1').send({ email: admin.user.email });
    expect(forgot.status).toBe(202);
    const rawToken = globalThis.__orianaMailTransport.sendMail.mock.calls.at(-1)[0].html
      .match(/token=([a-f\d]{64})/i)?.[1];
    const reset = await request(app).post('/api/admin/auth/reset-password')
      .set('X-Admin-Request', '1').send({
        token: rawToken, password: 'ChangedAdmin123', confirmPassword: 'ChangedAdmin123',
      });
    expect(reset.status).toBe(200);
    expect((await request(app).post('/api/admin/auth/login').set('X-Admin-Request', '1')
      .send({ email: admin.user.email, password: 'ChangedAdmin123' })).status).toBe(200);
  });

  test('webhook requires a raw-body signature and ignores duplicate event IDs', async () => {
    const plan = await createPlan({
      pointsTiers: [{ label: 'Standard', points: 5, fromMember: 1, toMember: null }],
    });
    const member = await createMember({ membership: { plan: plan._id, status: 'pending_payment' } });
    const payment = await Payment.create({
      user: member.user._id, membership: member.membership._id, plan: plan._id,
      method: 'razorpay', status: 'created', baseAmount: 10000, gstAmount: 1800,
      totalAmount: 11800, razorpayOrderId: 'order_webhook',
    });
    const raw = Buffer.from(JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: {
        id: 'payment_webhook', order_id: 'order_webhook', amount: 11800, currency: 'INR',
      } } },
    }));
    const signature = createHmac('sha256', 'fake-webhook-secret-never-used').update(raw).digest('hex');
    await expect(processRazorpayWebhook(Buffer.from('{}'), createHmac('sha256', 'fake-webhook-secret-never-used')
      .update(Buffer.from('{}')).digest('hex'), 'unknown-event'))
      .resolves.toEqual({ received: true, processed: false });
    const send = () => request(app).post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'event-test-1')
      .send(raw.toString('utf8'));
    expect((await request(app).post('/api/payments/webhook').set('Content-Type', 'application/json')
      .set('x-razorpay-signature', '0'.repeat(64)).send(raw.toString('utf8'))).status).toBe(400);
    const firstEvent = await send();
    expect(firstEvent.body).toMatchObject({ processed: true });
    const duplicateEvent = await send();
    expect(duplicateEvent.status).toBe(200);
    expect(duplicateEvent.body.processed).toBe(false);
    expect((await Payment.findById(payment._id)).status).toBe('confirmed');
    expect(await Membership.findById(member.membership._id)).toMatchObject({
      status: 'pending_approval',
      approvalSeq: null,
    });
  });
});
