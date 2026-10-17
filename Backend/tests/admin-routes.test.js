import request from 'supertest';
import { createAdmin, createMember, createPlan } from './helpers/factories.js';
import { createApp } from './helpers/createApp.js';
import AuditLog from '../src/models/AuditLog.js';
import Membership from '../src/models/Membership.js';
import Payment from '../src/models/Payment.js';
import PointsTransaction from '../src/models/PointsTransaction.js';
import User from '../src/models/User.js';

const app = createApp();

function adminRequest(admin, method, path) {
  return request(app)[method](path).set('Cookie', admin.cookie).set('X-Admin-Request', '1');
}

// Admin success paths verify the same privileged operations protected by the route matrix.
describe('admin member and plan routes', () => {
  test('creates, lists, updates, suspends, exports, and soft-deletes a manual member', async () => {
    const admin = await createAdmin();
    const plan = await createPlan({ slug: 'admin-member-plan' });
    const payload = {
      user: { firstName: 'Manual', email: 'manual-route@example.invalid' },
      profile: {
        fullName: 'Manual Route', gender: 'other', countryCode: '+91', mobile: '9000000002',
        dob: '1990-01-01', interestArea: 'Travel',
      },
      planSlug: plan.slug,
    };
    const created = await adminRequest(admin, 'post', '/api/admin/members').send(payload);
    expect(created.status).toBe(201);
    const userId = created.body.data.user._id;
    expect((await adminRequest(admin, 'get', '/api/admin/members')).status).toBe(200);
    expect((await adminRequest(admin, 'get', `/api/admin/members/${userId}`)).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/members/${userId}`).send({
      firstName: 'Changed',
    })).status).toBe(200);
    expect((await adminRequest(admin, 'post', `/api/admin/members/${userId}/activate`)).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/members/export')).headers['content-type'])
      .toContain('text/csv');
    expect(await AuditLog.countDocuments({ entityType: 'member' })).toBeGreaterThan(0);
    expect((await adminRequest(admin, 'delete', `/api/admin/members/${userId}`)).status).toBe(200);
    expect((await User.findById(userId)).deletedAt).not.toBeNull();
  });

  test('creates, lists, updates and audits membership plans', async () => {
    const admin = await createAdmin();
    const body = {
      id: 'api-test-plan', slug: 'api-test-plan', title: 'API Test Plan',
      price: 1000, gstPercent: 18, planFee: 1000, pointsTiers: [],
      maxFamilyMembers: 2, isActive: true, isFeatured: false, sortOrder: 1,
    };
    const created = await adminRequest(admin, 'post', '/api/admin/plans').send(body);
    expect(created.status).toBe(201);
    const planId = created.body.data._id;
    expect((await adminRequest(admin, 'get', '/api/admin/plans')).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/plans/${planId}`)
      .send({ title: 'Updated API Plan' })).status).toBe(200);
    expect(await AuditLog.countDocuments({ entityType: 'plan' })).toBeGreaterThan(0);
  });

  test('admin-created offline memberships save GST-inclusive payment snapshots', async () => {
    const admin = await createAdmin();
    const plan = await createPlan({
      price: 1000,
      planFee: 847,
      gst: 153,
      pointsTiers: [{ label: 'Initial', points: 100, fromMember: 1, toMember: null }],
    });
    const created = await adminRequest(admin, 'post', '/api/admin/members').send({
      user: { firstName: 'Offline GST', email: 'offline-gst@example.invalid' },
      profile: {
        fullName: 'Offline GST Member', gender: 'other', countryCode: '+91', mobile: '9000000008',
        dob: '1990-01-01', interestArea: 'Travel',
      },
      planSlug: plan.slug,
      offlinePayment: {
        method: 'bank_transfer',
        reference: 'UTR-ADMIN-GST',
        amountPaise: 118000,
        note: 'GST inclusive offline payment',
      },
    });
    expect(created.status).toBe(201);
    const payment = await Payment.findOne({ user: created.body.data.user._id });
    expect(payment).toMatchObject({
      method: 'bank_transfer',
      reference: 'UTR-ADMIN-GST',
      baseAmount: 100000,
      gstRate: 18,
      gstEnabled: true,
      gstAmount: 18000,
      totalAmount: 118000,
    });
  });

  test('membership settings omit cancellation rules and expose no refund-rule route', async () => {
    const admin = await createAdmin();
    const settings = await adminRequest(admin, 'get', '/api/admin/membership-settings');
    expect(settings.status).toBe(200);
    expect(settings.body.data).not.toHaveProperty('cancellationPolicy');
    expect((await adminRequest(admin, 'get', '/api/admin/refund-rules')).status).toBe(404);
  });

  test('invites an administrator and lists the pending admin without exposing a password', async () => {
    const actor = await createAdmin();
    const invited = await adminRequest(actor, 'post', '/api/admin/admins')
      .send({ firstName: 'Invited', email: 'invited-admin@example.invalid' });
    expect(invited.status).toBe(201);
    expect(invited.body.data.admin).not.toHaveProperty('passwordHash');
    expect((await adminRequest(actor, 'get', '/api/admin/admins?status=pending&search=Invited'))
      .body.data.items.map((item) => item.email)).toContain('invited-admin@example.invalid');
    expect(await AuditLog.countDocuments({ action: 'admin.create' })).toBe(1);
  });
});

describe('admin points, content, enquiry and reports routes', () => {
  test('credits, debits, bulk-credits, and reads a member points ledger', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'active', pointsBalance: 0 },
    });
    const membershipId = String(member.membership._id);
    const credit = await adminRequest(admin, 'post', '/api/admin/points/credit').send({
      membershipId, amount: 20, category: 'adjustment', reason: 'Admin award',
    });
    expect(credit.status).toBe(200);
    expect((await adminRequest(admin, 'post', '/api/admin/points/debit').send({
      membershipId, amount: 2, category: 'adjustment', reason: 'Correction',
    })).status).toBe(200);
    expect((await adminRequest(admin, 'post', '/api/admin/points/bulk-credit').send({
      membershipIds: [membershipId], amount: 3, reason: 'Campaign',
    })).status).toBe(200);
    expect((await adminRequest(admin, 'get', `/api/admin/members/${member.user._id}/points`)).status).toBe(200);
    expect(await AuditLog.countDocuments({ entityType: 'membership' })).toBe(3);
  });

  test('publishes and removes a post and event with an audit record for every change', async () => {
    const admin = await createAdmin();
    const post = await adminRequest(admin, 'post', '/api/admin/posts').send({
      title: 'Admin Story', slug: 'admin-story', excerpt: 'Story excerpt',
      content: 'Story body', category: 'Travel', status: 'published',
    });
    expect(post.status).toBe(201);
    const postId = post.body.data._id;
    expect((await adminRequest(admin, 'get', '/api/admin/posts')).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/posts/${postId}`)
      .send({ title: 'Updated Story' })).status).toBe(200);
    expect((await adminRequest(admin, 'delete', `/api/admin/posts/${postId}`)).status).toBe(200);

    const event = await adminRequest(admin, 'post', '/api/admin/events').send({
      title: 'Admin Event', slug: 'admin-event', description: 'Event description',
      date: '2030-01-01', location: 'Mumbai', status: 'published',
    });
    expect(event.status).toBe(201);
    const eventId = event.body.data._id;
    expect((await adminRequest(admin, 'get', '/api/admin/events')).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/events/${eventId}`)
      .send({ status: 'cancelled' })).status).toBe(200);
    expect((await adminRequest(admin, 'delete', `/api/admin/events/${eventId}`)).status).toBe(200);
    expect(await AuditLog.countDocuments()).toBe(6);
  });

  test('updates enquiry status and notes, reads logs, and exports reports', async () => {
    const admin = await createAdmin();
    const enquiry = await request(app).post('/api/enquiries').send({
      type: 'query', name: 'Enquiry User', email: 'enquiry@example.invalid',
      message: 'Question', recaptchaToken: 'fake-token',
    });
    expect(enquiry.status).toBe(201);
    const id = enquiry.body.data.id;
    expect((await adminRequest(admin, 'get', '/api/admin/enquiries?status=contacted&search=Enquiry&from=2020-01-01&to=2030-01-01')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/enquiries/summary')).status).toBe(200);
    expect((await adminRequest(admin, 'patch', `/api/admin/enquiries/${id}/status`)
      .send({ status: 'contacted' })).status).toBe(200);
    expect((await adminRequest(admin, 'post', `/api/admin/enquiries/${id}/notes`)
      .send({ note: 'Called member' })).status).toBe(201);
    expect((await adminRequest(admin, 'get', '/api/admin/audit-logs')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/email-logs')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/reports')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/reports/export?report=members-by-plan')).headers['content-type'])
      .toContain('text/csv');
    expect((await adminRequest(admin, 'get', '/api/admin/reports/export?report=revenue-by-month')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/reports/export?report=points-by-month')).status).toBe(200);
  });
});

describe('admin payments routes', () => {
  test('approves and rejects bank transfers and rejects a duplicate UTR', async () => {
    await Payment.init();
    const admin = await createAdmin();
    const plan = await createPlan({ pointsTiers: [{ label: 'Standard', points: 10, fromMember: 1, toMember: null }] });
    const member = await createMember({ membership: { plan: plan._id, status: 'pending_payment' } });
    const values = {
      user: member.user._id, membership: member.membership._id, plan: plan._id,
      method: 'bank_transfer', status: 'pending_verification',
      baseAmount: 10000, gstAmount: 1800, totalAmount: 11800, utr: 'UTR-UNIQUE-1',
    };
    const payment = await Payment.create(values);
    await expect(Payment.create(values)).rejects.toMatchObject({ code: 11000 });
    expect((await adminRequest(admin, 'post', `/api/admin/payments/${payment._id}/approve`)).status).toBe(200);
    const rejectedPayment = await Payment.create({
      ...values, utr: 'UTR-UNIQUE-2', status: 'pending_verification',
    });
    expect((await adminRequest(admin, 'post', `/api/admin/payments/${rejectedPayment._id}/reject`)
      .send({ reason: 'Invalid transfer' })).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/payments')).status).toBe(200);
    expect((await adminRequest(admin, 'get', '/api/admin/payments/export')).headers['content-type'])
      .toContain('text/csv');
    expect((await adminRequest(admin, 'get', `/api/admin/payments/${payment._id}`)).status).toBe(200);
  });

  test('refunds a Razorpay payment with optional points reversal', async () => {
    const admin = await createAdmin();
    const plan = await createPlan();
    const member = await createMember({
      membership: { plan: plan._id, status: 'active', pointsBalance: 5 },
    });
    const payment = await Payment.create({
      user: member.user._id, membership: member.membership._id, plan: plan._id,
      method: 'razorpay', status: 'paid', baseAmount: 10000, gstAmount: 1800,
      totalAmount: 11800, razorpayPaymentId: 'payment_refund_1', invoiceNumber: 'INV-TEST-1',
    });
    const withoutReversal = await adminRequest(admin, 'post', `/api/admin/payments/${payment._id}/refund`)
      .send({ amount: 1000, reason: 'Partial refund' });
    expect(withoutReversal.status).toBe(200);

    await PointsTransaction.create({
      user: member.user._id, membership: member.membership._id, type: 'credit',
      amount: 5, category: 'membership_award', reason: 'Award', balanceAfter: 5,
      idempotencyKey: 'refund-award',
    });
    const second = await Payment.create({
      user: member.user._id, membership: member.membership._id, plan: plan._id,
      method: 'razorpay', status: 'paid', baseAmount: 10000, gstAmount: 1800,
      totalAmount: 11800, razorpayPaymentId: 'payment_refund_2', invoiceNumber: 'INV-TEST-2',
    });
    const withReversal = await adminRequest(admin, 'post', `/api/admin/payments/${second._id}/refund`)
      .send({ amount: 11800, reason: 'Full refund', reversePoints: true });
    expect(withReversal.status).toBe(200);
    expect((await Membership.findById(member.membership._id)).pointsBalance).toBe(0);
    expect(globalThis.__orianaRazorpayClient.payments.refund).toHaveBeenCalledTimes(2);
  });
});
